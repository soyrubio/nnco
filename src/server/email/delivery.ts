import { timingSafeEqual } from "node:crypto";
import { Buffer } from "node:buffer";
import {
  supabaseAdminConfig,
  type SupabaseAdminEnvironment,
} from "../supabase-admin.ts";
import {
  isDiscoveryReleaseReport,
  type DiscoveryReleaseReport,
} from "../../lib/discovery-release.ts";

export interface EmailEnvironment extends SupabaseAdminEnvironment {
  EMAIL_DELIVERY_ENABLED?: string;
  EMAIL_DISPATCH_SECRET?: string;
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  EMAIL_REPLY_TO?: string;
  EMAIL_LEAD_TO?: string;
}
export interface EmailMessage {
  from: string;
  to: string[];
  reply_to: string;
  subject: string;
  text: string;
  attachments?: { filename: string; content: string }[];
}
interface EmailJob {
  id: string;
  lead_id: string;
  kind: "lead" | "report";
  attempts: number;
  lock_token: string;
  message: EmailMessage | null;
}
interface EmailLead {
  work_email: string;
  organisation: string;
  name: string | null;
  created_at: string;
  snapshot: {
    kind: string;
    website?: string;
    message?: string;
    sector?: string;
    area?: string;
    company?: { name?: string };
    answers?: Record<string, unknown>;
  };
  analysis_result: { report: DiscoveryReleaseReport } | null;
}
export interface DeliveryOptions {
  fetchImpl?: typeof fetch;
  renderPdf: (
    report: DiscoveryReleaseReport,
    company: string,
  ) => Promise<Uint8Array>;
  now?: () => number;
}

function authorized(request: Request, secret: string | undefined): boolean {
  if (!secret || secret.length < 32) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(request.headers.get("authorization") ?? "");
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/** Called only by the authenticated Supabase schedule; never by a browser. */
export async function deliverEmail(
  request: Request,
  env: EmailEnvironment,
  options: DeliveryOptions,
): Promise<Response> {
  const respond = (status: number, result: string) =>
    Response.json(
      { result },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  if (request.method !== "POST") return respond(405, "method_not_allowed");
  if (!authorized(request, env.EMAIL_DISPATCH_SECRET))
    return respond(401, "unauthorized");
  if (env.EMAIL_DELIVERY_ENABLED !== "true") return respond(200, "disabled");
  const config = supabaseAdminConfig(env);
  if (!config || !env.RESEND_API_KEY?.trim())
    return respond(503, "configuration_error");
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? Date.now;
  const db = async (path: string, init: RequestInit = {}) => {
    const response = await fetchImpl(`${config.url}/rest/v1/${path}`, {
      ...init,
      headers: { ...config.headers, Prefer: "return=representation" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) throw new Error("storage_unavailable");
    return response.json();
  };
  let job: EmailJob | undefined;
  const update = async (patch: Record<string, unknown>) => {
    const rows = await db(
      `email_jobs?id=eq.${job!.id}&lock_token=eq.${job!.lock_token}&status=eq.processing`,
      {
        method: "PATCH",
        body: JSON.stringify(patch),
      },
    );
    if (!Array.isArray(rows) || rows.length !== 1)
      throw new Error("lease_lost");
    return rows[0] as EmailJob;
  };
  try {
    [job] = await db("rpc/claim_email_job", { method: "POST", body: "{}" });
    if (!job) return respond(200, "idle");
    if (!job.message) {
      const [lead] = (await db(
        `lead_requests?id=eq.${job.lead_id}&select=work_email,organisation,name,created_at,snapshot,analysis_result`,
      )) as EmailLead[];
      if (!lead) throw new Error("lead_unavailable");
      job.message = await buildMessage(job.kind, lead, env, options.renderPdf);
      // Persist before send so a crash cannot change the attachment or recipient on retry.
      job.message = (await update({ message: job.message })).message;
    }
    const response = await fetchImpl("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `nnco-email/${job.id}`,
      },
      body: JSON.stringify(job.message),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      await update({
        status: retryable && job.attempts < 8 ? "pending" : "failed",
        available_at: new Date(now() + retryDelay(job.attempts)).toISOString(),
        last_error: `resend_http_${response.status}`,
        locked_at: null,
        lock_token: null,
      });
      return respond(
        200,
        retryable ? "retry_scheduled_or_exhausted" : "failed",
      );
    }
    const result = (await response.json()) as { id?: string };
    if (!result.id) throw new Error("missing_provider_id");
    await update({
      status: "accepted",
      provider_id: result.id,
      accepted_at: new Date(now()).toISOString(),
      message: null,
      last_error: null,
      locked_at: null,
      lock_token: null,
    });
    return respond(200, "accepted");
  } catch {
    if (job) {
      // Network failures may occur after Resend accepted the message. Keep its key and bytes.
      try {
        await update({
          status: job.attempts < 8 ? "pending" : "failed",
          available_at: new Date(
            now() + retryDelay(job.attempts),
          ).toISOString(),
          last_error: "delivery_unavailable",
          locked_at: null,
          lock_token: null,
        });
      } catch {
        /* An expired lease is recovered by the next schedule. */
      }
    }
    return respond(503, "delivery_unavailable");
  }
}

export function retryDelay(attempts: number): number {
  return Math.min(60, 2 ** Math.max(0, attempts - 1)) * 60_000;
}

async function buildMessage(
  kind: EmailJob["kind"],
  lead: EmailLead,
  env: EmailEnvironment,
  renderPdf: DeliveryOptions["renderPdf"],
): Promise<EmailMessage> {
  const company = lead.snapshot.company?.name || lead.organisation;
  const base = {
    from: env.EMAIL_FROM || "NNCo. Discovery <discovery@nnco.ai>",
    reply_to: env.EMAIL_REPLY_TO || "marek@nnco.ai",
  };
  if (kind === "lead") {
    const details = [
      lead.snapshot.kind === "contact-enquiry"
        ? "New contact enquiry"
        : "New Discovery submission",
      `Received: ${lead.created_at}`,
      `Name: ${lead.name || "Not provided"}`,
      `Email: ${lead.work_email}`,
      `Organisation: ${company || "Not provided"}`,
      lead.snapshot.website && `Website: ${lead.snapshot.website}`,
      lead.snapshot.sector && `Sector: ${lead.snapshot.sector}`,
      lead.snapshot.area && `Area: ${lead.snapshot.area}`,
      lead.snapshot.message && `Message: ${lead.snapshot.message}`,
      lead.snapshot.answers &&
        `Answers:\n${JSON.stringify(lead.snapshot.answers, null, 2)}`,
      lead.snapshot.kind === "discovery-release" &&
        "The submission was saved. Report generation may still be in progress.",
    ].filter(Boolean);
    return {
      ...base,
      to: [env.EMAIL_LEAD_TO || "marek@nnco.ai"],
      reply_to: lead.work_email,
      subject:
        lead.snapshot.kind === "contact-enquiry"
          ? "NNCo. — new contact enquiry"
          : "NNCo. — new Discovery lead",
      text: details.join("\n\n"),
    };
  }
  const report = lead.analysis_result?.report;
  if (!isDiscoveryReleaseReport(report) || report.schemaVersion !== 2)
    throw new Error("invalid_report");
  const pdf = await renderPdf(report, company);
  return {
    ...base,
    to: [lead.work_email],
    subject: "Your NNCo. Opportunity Discovery report",
    text: "Your Opportunity Discovery report is attached. It explains the supplied context and potential areas for improvement with AI.\n\nThis automated report is not a formal assessment. For a formal assessment, reply to this email to contact Marek at NNCo.",
    attachments: [
      {
        filename: "NNCo-Opportunity-Discovery.pdf",
        content: Buffer.from(pdf).toString("base64"),
      },
    ],
  };
}
