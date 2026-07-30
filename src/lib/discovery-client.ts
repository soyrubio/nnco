import {
  calculateCoverage,
  containsSensitiveDataCue,
  getQuestions,
  isDiscoverySnapshot,
  isUnknownValue,
  proposeChatPatches,
  type ChatEvidencePatch,
  type DiscoveryQuestion,
  type DiscoverySnapshot,
  type DiscoveryValue,
} from "./discovery.ts";

export type ChatPatch = ChatEvidencePatch;

export type AgentEvent =
  | { type: "patches"; patches: ChatPatch[] }
  | { type: "reply_delta"; delta: string }
  | { type: "complete" };

export interface DiscoveryAgent {
  streamTurn(
    input: {
      message: string;
      questions: DiscoveryQuestion[];
      snapshot: DiscoverySnapshot;
    },
    signal: AbortSignal,
  ): AsyncIterable<AgentEvent>;
}

export type RepositoryFailure =
  | "conflict"
  | "invalid"
  | "unavailable"
  | "aborted";

export type RepositoryResult<T> =
  | { ok: true; value: T; revision: number | null }
  | { ok: false; reason: RepositoryFailure; revision: number | null };

export interface DiscoveryRepository {
  load(): Promise<RepositoryResult<DiscoverySnapshot | null>>;
  save(
    snapshot: DiscoverySnapshot,
    expectedRevision: number | null,
    signal?: AbortSignal,
  ): Promise<RepositoryResult<DiscoverySnapshot>>;
  clear(signal?: AbortSignal): Promise<RepositoryResult<null>>;
}

export interface ReportExporter {
  exportPreview(): Promise<void>;
}

function hasAnswer(value: DiscoveryValue | undefined): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string")
    return value.trim().length > 0 && !isUnknownValue(value);
  return value !== null && value !== undefined;
}

function localReply(
  message: string,
  snapshot: DiscoverySnapshot,
  mapped: boolean,
): string {
  const normalized = message.toLocaleLowerCase("en");
  const segment = snapshot.profile.sector;
  const unanswered = getQuestions(snapshot).filter(
    (question) =>
      question.required && !hasAnswer(snapshot.answers[question.id]?.value),
  );

  if (containsSensitiveDataCue(normalized)) {
    return "Please remove personal, patient, customer or confidential data. A category-level description is enough for this diagnostic.";
  }
  if (/\b(skip|don'?t know|not sure|unknown)\b/.test(normalized)) {
    return "That is a valid answer. I’ll keep it as a validation item rather than force a guess.";
  }
  if (!segment) {
    return "Choose Banking, Insurance, Healthcare or Other so the questions match the workflow.";
  }
  if (
    segment === "healthcare" &&
    /\b(patient|clinical|diagnos|prescription)\b/.test(normalized)
  ) {
    return "Keep this at workflow level and do not include patient records. Which step creates the delay, and which decision must remain with authorised clinical staff?";
  }
  if (
    segment === "finance" &&
    /\b(pdf|spreadsheet|email|reconcil|report|portal)\b/.test(normalized)
  ) {
    return "That points to a source-to-output lineage issue. Which step requires manual normalisation or re-keying, and how are exceptions approved today?";
  }
  if (/\b(manual|copy|paste|repeat|re-key|rekey)\b/.test(normalized)) {
    return mapped
      ? "I mapped that as proposed manual-work evidence. Review it before accepting, then add how often it occurs or what happens when it is missed."
      : "I could not map that safely. Name the manual step and its consequence.";
  }
  if (/\b(error|exception|delay|bottleneck|fail)\b/.test(normalized)) {
    return mapped
      ? "I mapped that as proposed friction evidence. Review it before accepting; who detects it and where is it recorded?"
      : "That sounds relevant, but I could not assign it safely. Name the exception and consequence.";
  }
  const next = unanswered[0];
  if (next) {
    return mapped
      ? `Mapped into proposed evidence. Review it before accepting. To strengthen the diagnostic: ${next.prompt}`
      : `I did not record that. Try answering this directly: ${next.prompt}`;
  }
  if (calculateCoverage(snapshot).readyForPreview) {
    return "The evidence is sufficient for a first diagnostic preview. Unknowns will stay clearly marked for validation.";
  }
  return mapped
    ? "Mapped into proposed details. Review each item before accepting it."
    : "I did not record that. Rephrase it or answer the question directly.";
}

export const localDiscoveryAgent: DiscoveryAgent = {
  async *streamTurn(input, signal) {
    if (signal.aborted) return;
    const patches = proposeChatPatches(input);
    if (patches.length > 0) {
      yield { type: "patches", patches };
    }
    if (signal.aborted) return;
    yield {
      type: "reply_delta",
      delta: localReply(input.message, input.snapshot, patches.length > 0),
    };
    if (signal.aborted) return;
    yield { type: "complete" };
  },
};

export function createBrowserDiscoveryRepository(
  storage: Storage,
  key: string,
  ttlMs: number,
): DiscoveryRepository {
  const readEnvelope = (): {
    expiresAt: number;
    snapshot: DiscoverySnapshot;
  } | null => {
    const saved = storage.getItem(key);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as {
      expiresAt?: number;
      snapshot?: unknown;
    };
    if (
      typeof parsed.expiresAt !== "number" ||
      !Number.isFinite(parsed.expiresAt) ||
      parsed.expiresAt <= Date.now() ||
      !isDiscoverySnapshot(parsed.snapshot)
    ) {
      storage.removeItem(key);
      return null;
    }
    return { expiresAt: parsed.expiresAt, snapshot: parsed.snapshot };
  };

  return {
    async load() {
      try {
        const envelope = readEnvelope();
        return {
          ok: true,
          value: envelope?.snapshot ?? null,
          revision: envelope?.snapshot.revision ?? null,
        };
      } catch {
        try {
          storage.removeItem(key);
        } catch {
          // Storage can be unavailable in private contexts.
        }
        return { ok: false, reason: "invalid", revision: null };
      }
    },
    async save(snapshot, expectedRevision, signal) {
      try {
        if (signal?.aborted) {
          return { ok: false, reason: "aborted", revision: null };
        }
        const current = readEnvelope();
        const actualRevision = current?.snapshot.revision ?? null;
        if (actualRevision !== expectedRevision) {
          return {
            ok: false,
            reason: "conflict",
            revision: actualRevision,
          };
        }
        if (signal?.aborted) {
          return { ok: false, reason: "aborted", revision: null };
        }
        storage.setItem(
          key,
          JSON.stringify({
            expiresAt: Date.now() + ttlMs,
            snapshot,
          }),
        );
        return { ok: true, value: snapshot, revision: snapshot.revision };
      } catch {
        return { ok: false, reason: "unavailable", revision: null };
      }
    },
    async clear(signal) {
      try {
        if (signal?.aborted) {
          return { ok: false, reason: "aborted", revision: null };
        }
        storage.removeItem(key);
        return { ok: true, value: null, revision: null };
      } catch {
        return { ok: false, reason: "unavailable", revision: null };
      }
    },
  };
}

export function createBrowserPrintExporter(target: Window): ReportExporter {
  return {
    async exportPreview() {
      target.print();
    },
  };
}
