import { createHash, randomUUID } from "node:crypto";
import {
  buildManualCompanyContext,
  isCompanyContext,
  isDiscoverySubmission,
  isDiscoveryReleasePayload,
  normalizeWebsiteInput,
  reclassifyCompanyContext,
  type DiscoveryReleaseErrorResponse,
  type DiscoveryReleasePayload,
  type DiscoveryReleaseReport,
  type DiscoveryReleaseResponse,
} from "../lib/discovery-release.ts";
import {
  isValidContactEmail,
  normalizeContactEmail,
} from "../lib/contact-contract.ts";
import { isValidRequestId } from "../lib/request-identity.ts";
import {
  claimLeadAnalysis,
  LeadRepositoryError,
  persistLead,
  readLeadAnalysis,
  releaseLeadAnalysisClaim,
  saveLeadAnalysis,
  type LeadAnalysisReplay,
  type LeadRecord,
} from "./lead-repository.ts";
import {
  isSameOrigin,
  readBoundedBody,
} from "./request-guards.ts";
import {
  type OpenAiStructuredEnvironment,
} from "./openai-structured.ts";
import {
  verifyDiscoveryContextToken,
} from "./discovery-context-token.ts";
import {
  checkDiscoveryRateLimit,
  trustedClientKey,
  type DiscoveryRateLimitEnvironment,
} from "./discovery-rate-limit.ts";

import { generateDiscoveryReport } from "./discovery-report.ts";

const MAX_BODY_BYTES = 64 * 1024;
const IP_HOURLY_LIMIT = 5;
const IP_DAILY_LIMIT = 20;
const EMAIL_DAILY_LIMIT = 3;
const PROJECT_DAILY_LIMIT = 100;
const HOUR_MS = 60 * 60 * 1_000;
const DAY_MS = 24 * HOUR_MS;

type AnalysisEnvironment = OpenAiStructuredEnvironment & DiscoveryRateLimitEnvironment & {
  NODE_ENV?: string;
  DISCOVERY_CONTEXT_SIGNING_SECRET?: string;
};
type FetchLike = typeof fetch;

interface AnalysisOptions {
  env?: AnalysisEnvironment;
  fetchImpl?: FetchLike;
  now?: number;
}

const globalAnalysisState = globalThis as typeof globalThis & {
  __nncoDiscoveryAnalysisHourlyLimits?: Map<string, number[]>;
  __nncoDiscoveryAnalysisDailyLimits?: Map<string, number[]>;
  __nncoDiscoveryAnalysisEmailLimits?: Map<string, number[]>;
  __nncoDiscoveryAnalysisProjectLimits?: Map<string, number[]>;
};
const hourlyLimits =
  globalAnalysisState.__nncoDiscoveryAnalysisHourlyLimits ??
  new Map<string, number[]>();
const dailyLimits =
  globalAnalysisState.__nncoDiscoveryAnalysisDailyLimits ??
  new Map<string, number[]>();
const emailLimits =
  globalAnalysisState.__nncoDiscoveryAnalysisEmailLimits ??
  new Map<string, number[]>();
const projectLimits =
  globalAnalysisState.__nncoDiscoveryAnalysisProjectLimits ??
  new Map<string, number[]>();
globalAnalysisState.__nncoDiscoveryAnalysisHourlyLimits = hourlyLimits;
globalAnalysisState.__nncoDiscoveryAnalysisDailyLimits = dailyLimits;
globalAnalysisState.__nncoDiscoveryAnalysisEmailLimits = emailLimits;
globalAnalysisState.__nncoDiscoveryAnalysisProjectLimits = projectLimits;

export async function handleDiscoveryAnalysisRequest(
  request: Request,
  clientAddress?: string,
  options: AnalysisOptions = {},
): Promise<Response> {
  if (!isSameOrigin(request)) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "The request origin could not be verified.",
      false,
    );
  }
  const now = options.now ?? Date.now();
  const env = options.env ?? process.env;

  const body = await readBoundedBody(request, MAX_BODY_BYTES);
  if (!body.ok) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      body.reason === "too_large"
        ? "The diagnostic request is too large."
        : "The request could not be read.",
      false,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body.bytes));
  } catch {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "The request could not be read.",
      false,
    );
  }
  if (
    !isDiscoverySubmission(parsed) ||
    !isValidRequestId(parsed.requestId) ||
    !isValidContactEmail(parsed.workEmail)
  ) {
    return errorResponse(
      400,
      "VALIDATION_ERROR",
      "Check the diagnostic and contact fields before retrying.",
      false,
    );
  }
  const submission = parsed;
  let company;
  try {
    // Verify the signature even for a replay. Expiry is enforced below when
    // no matching completed analysis exists, so a safe retry can still replay.
    company = submission.contextToken
      ? verifyDiscoveryContextToken(submission.contextToken, env, now, { allowExpiredForReplay: true })
      : buildManualCompanyContext(submission.sector);
  } catch {
    return errorResponse(503, "CONFIGURATION_ERROR", "The diagnostic context service is not configured.", false);
  }
  if (!isCompanyContext(company)) {
    return errorResponse(400, "VALIDATION_ERROR", "The company information could not be verified. Research the website again.", false);
  }
  company = reclassifyCompanyContext(company, submission.sector);
  const payload: DiscoveryReleasePayload = {
    schemaVersion: 1,
    requestId: submission.requestId,
    website: company.website,
    situation: "",
    company,
    companyContextToken: submission.contextToken,
    answers: {
      ...submission.answers,
      ...(submission.answers.context ? { context: Object.fromEntries(Object.entries(submission.answers.context).map(([key, value]) => [key, value.trim()])) } : {}),
    },
    contact: { workEmail: submission.workEmail, organisation: company.website ? company.name : "Not provided" },
    competitorView: { enabled: submission.includeCompetitors, names: [] },
    consent: submission.consent,
  };
  if (!isDiscoveryReleasePayload(payload)) {
    return errorResponse(400, "VALIDATION_ERROR", "Check the diagnostic answers before retrying.", false);
  }
  const confirmedAt = new Date(now).toISOString();
  const snapshot = {
    schemaVersion: 1,
    kind: "discovery-release",
    sourcePath: "/discovery",
    website: payload.website
      ? normalizeWebsiteInput(payload.website)?.toString()
      : null,
    situation: payload.situation.trim(),
    company: payload.company,
    answers: payload.answers,
    competitorView: payload.competitorView,
  };
  const record: LeadRecord = {
    requestId: payload.requestId,
    handoffId: randomUUID(),
    caseId: `DISCOVERY-${payload.requestId}`,
    caseRevision: 1,
    workEmail: normalizeContactEmail(payload.contact.workEmail),
    organisation: payload.contact.organisation.trim(),
    name: payload.contact.name?.trim() || null,
    consentVersion: payload.consent.version,
    consentedAt: confirmedAt,
    requestHash: createHash("sha256")
      .update(
        canonicalJson({
          snapshot,
          contact: {
            workEmail: normalizeContactEmail(payload.contact.workEmail),
            organisation: payload.contact.organisation.trim(),
            name: payload.contact.name?.trim() || null,
          },
          consentVersion: payload.consent.version,
        }),
      )
      .digest("hex"),
    snapshot,
  };

  try {
    const replay = await readLeadAnalysis(record.requestId, record.requestHash);
    if (replay) {
      return completedAnalysisResponse(replay);
    }

    if (payload.website) {
      let signedCompany;
      try {
        signedCompany = verifyDiscoveryContextToken(
          payload.companyContextToken ?? "",
          env,
          now,
        );
      } catch {
        return errorResponse(
          503,
          "CONFIGURATION_ERROR",
          "The diagnostic context service is not configured.",
          false,
        );
      }
      if (!signedCompany) {
        return errorResponse(
          400,
          "VALIDATION_ERROR",
          "The company context has expired or could not be verified. Read the website again.",
          false,
        );
      }
    }

    let retryAfter: number | null;
    try {
      const clientKey = trustedClientKey(
        request,
        clientAddress,
        env.NODE_ENV === "production",
      );
      retryAfter =
        (await checkDiscoveryRateLimit({
          env,
          key: clientKey,
          limit: IP_HOURLY_LIMIT,
          localStore: hourlyLimits,
          now,
          scope: "analysis-ip-hour",
          windowMs: HOUR_MS,
        })) ??
        (await checkDiscoveryRateLimit({
          env,
          key: clientKey,
          limit: IP_DAILY_LIMIT,
          localStore: dailyLimits,
          now,
          scope: "analysis-ip-day",
          windowMs: DAY_MS,
        }));
    } catch {
      return errorResponse(
        503,
        "CONFIGURATION_ERROR",
        "Report protection is temporarily unavailable.",
        true,
      );
    }
    if (retryAfter !== null) {
      const response = errorResponse(
        429,
        "RATE_LIMITED",
        "Too many report requests. Wait before trying again.",
        true,
      );
      response.headers.set("Retry-After", String(retryAfter));
      return response;
    }

    const persisted = await persistLead(record);
    if (!env.OPENAI_API_KEY?.trim()) {
      return errorResponse(
        503,
        "CONFIGURATION_ERROR",
        "The analysis service is not configured.",
        false,
      );
    }
    const claim = await claimLeadAnalysis(record.requestId, record.requestHash);
    if (claim.state === "completed") {
      return completedAnalysisResponse({
        ...claim.analysis,
        handoffId: persisted.record.handoffId,
        persistence: persisted.persistence,
      });
    }
    if (claim.state === "pending") {
      const response = errorResponse(
        503,
        "ANALYSIS_UNAVAILABLE",
        "This report is already being prepared. Retry shortly to receive the same result.",
        true,
      );
      response.headers.set("Retry-After", "2");
      return response;
    }
    let emailRetry: number | null;
    try {
      emailRetry = await checkDiscoveryRateLimit({
        env,
        key: normalizeContactEmail(payload.contact.workEmail),
        limit: EMAIL_DAILY_LIMIT,
        localStore: emailLimits,
        now,
        scope: "analysis-email-day",
        windowMs: DAY_MS,
      });
    } catch {
      await releaseLeadAnalysisClaim(
        record.requestId,
        record.requestHash,
        claim.claimToken,
      );
      return errorResponse(
        503,
        "CONFIGURATION_ERROR",
        "Report protection is temporarily unavailable.",
        true,
      );
    }
    if (emailRetry !== null) {
      await releaseLeadAnalysisClaim(
        record.requestId,
        record.requestHash,
        claim.claimToken,
      );
      const response = errorResponse(
        429,
        "RATE_LIMITED",
        "This email has already requested several reports today.",
        true,
      );
      response.headers.set("Retry-After", String(emailRetry));
      return response;
    }
    let projectRetry: number | null;
    try {
      projectRetry = await checkDiscoveryRateLimit({
        env,
        key: "project",
        limit: PROJECT_DAILY_LIMIT,
        localStore: projectLimits,
        now,
        scope: "analysis-project-day",
        windowMs: DAY_MS,
      });
    } catch {
      await releaseLeadAnalysisClaim(
        record.requestId,
        record.requestHash,
        claim.claimToken,
      );
      return errorResponse(
        503,
        "CONFIGURATION_ERROR",
        "Report protection is temporarily unavailable.",
        true,
      );
    }
    if (projectRetry !== null) {
      await releaseLeadAnalysisClaim(
        record.requestId,
        record.requestHash,
        claim.claimToken,
      );
      const response = errorResponse(
        429,
        "RATE_LIMITED",
        "The daily report capacity has been reached. Please retry later.",
        true,
      );
      response.headers.set("Retry-After", String(projectRetry));
      return response;
    }
    let report: DiscoveryReleaseReport;
    try {
      report = await generateDiscoveryReport(payload, confirmedAt, {
        env,
        fetchImpl: options.fetchImpl ?? fetch,
      });
    } catch {
      await releaseLeadAnalysisClaim(
        record.requestId,
        record.requestHash,
        claim.claimToken,
      );
      return errorResponse(
        503,
        "ANALYSIS_UNAVAILABLE",
        "The analysis could not be completed. Your request was saved and can be retried.",
        true,
      );
    }

    const completed = await saveLeadAnalysis(
      record.requestId,
      record.requestHash,
      claim.claimToken,
      {
        confirmedAt: persisted.record.consentedAt,
        analysisMode: "ai",
        report,
      },
    );
    const responseBody: DiscoveryReleaseResponse = {
      ok: true,
      report: completed.report as DiscoveryReleaseReport,
    };
    return Response.json(responseBody, {
      status: persisted.created ? 201 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (error instanceof LeadRepositoryError) {
      const status =
        error.code === "IDEMPOTENCY_CONFLICT"
          ? 409
          : error.code === "CONFIGURATION_ERROR"
            ? 500
            : 503;
      return errorResponse(
        status,
        error.code,
        error.code === "IDEMPOTENCY_CONFLICT"
          ? "This retry key belongs to another request. Refresh and try again."
          : error.code === "CONFIGURATION_ERROR"
            ? "The handoff service is not configured."
            : "The request could not be stored.",
        error.code === "HANDOFF_UNAVAILABLE",
      );
    }
    return errorResponse(
      503,
      "HANDOFF_UNAVAILABLE",
      "The request could not be stored.",
      true,
    );
  }
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function completedAnalysisResponse(
  replay: LeadAnalysisReplay,
): Response {
  const responseBody: DiscoveryReleaseResponse = {
    ok: true,
    report: replay.report as DiscoveryReleaseReport,
  };
  return Response.json(responseBody, {
    status: 200,
    headers: { "Cache-Control": "no-store" },
  });
}

function errorResponse(
  status: number,
  code: DiscoveryReleaseErrorResponse["error"]["code"],
  message: string,
  retryable: boolean,
): Response {
  return Response.json(
    { ok: false, error: { code, message, retryable } } satisfies DiscoveryReleaseResponse,
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
