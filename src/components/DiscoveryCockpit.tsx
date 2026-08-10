import {
  type CSSProperties,
  type KeyboardEvent,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DiscoveryBrandLogo as BrandLogo } from "./discovery/DiscoveryBrandLogo";
import { DiscoveryBlockArrow as BlockArrow } from "./discovery/DiscoveryBlockArrow";
import { DiscoveryBlockLoader as BlockLoader } from "./discovery/DiscoveryBlockLoader";
import {
  buildReportPreview,
  calculateCoverage,
  calculateJourneyProgress,
  containsSensitiveDataCue,
  createInitialSnapshot,
  DISCOVERY_LONG_TEXT_MAX_LENGTH,
  DISCOVERY_MESSAGE_MAX_LENGTH,
  DISCOVERY_SHORT_TEXT_MAX_LENGTH,
  discoveryReducer,
  getDiscoveryQuestionIdsFrom,
  getMilestones,
  getQuestions,
  isUnknownValue,
  type DiscoveryCommand,
  type DiscoveryQuestion,
  type DiscoverySnapshot,
  type DiscoveryValue,
} from "@/lib/discovery";
import {
  createBrowserDiscoveryRepository,
  createBrowserPrintExporter,
  appendBoundedDraft,
  localDiscoveryAgent,
  type ChatPatch,
  type DiscoveryRepository,
} from "@/lib/discovery-client";
import {
  LEAD_CONSENT_VERSION,
  type FullDiagnosticReport,
  type LeadResponse,
} from "@/lib/lead-contract";
import {
  CONTACT_EMAIL_PATTERN_SOURCE,
  CONTACT_FIELD_LIMITS,
  isContactTextWithinLimits,
  isValidContactEmail,
  normalizeContactEmail,
} from "@/lib/contact-contract";
import {
  resolveRequestIdentity,
  type RequestIdentity,
} from "@/lib/request-identity";

const STORAGE_KEY = "nnco.signal.discovery.v2";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_TRANSCRIPTION_BYTES = 4 * 1024 * 1024;
const MAX_RECORDING_MS = 60_000;
const transcriptionEnabled =
  import.meta.env.PUBLIC_TRANSCRIPTION_ENABLED === "true";
const LEAD_SUBMISSION_ERROR_MESSAGE =
  "That did not go through. Email us at general@nnco.ai and we will send it manually.";
type VoiceState =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"
  | "error";
type JourneyDirection = "forward" | "back";
const ANALYSIS_MESSAGE = "That is everything we need. Building the analysis.";
const milestones = getMilestones();
const chapterMilestones = milestones.map((milestone) => milestone.id);
const REVIEW_CHAPTER = chapterMilestones.indexOf("review");

function answerFor(snapshot: DiscoverySnapshot, questionId: string) {
  return snapshot.answers[questionId]?.value;
}

function hasCaptured(value: DiscoveryValue | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function displayValue(
  snapshot: DiscoverySnapshot,
  questionById: Map<string, DiscoveryQuestion>,
  questionId: string,
) {
  const value = answerFor(snapshot, questionId);
  if (!hasCaptured(value) || isUnknownValue(value)) return "Not known yet";
  const question = questionById.get(questionId);
  const values = Array.isArray(value) ? value : [value];
  return values
    .map((item) => {
      const option = question?.options?.find(
        (candidate) => candidate.value === String(item),
      );
      return option?.label ?? String(item);
    })
    .join(", ");
}

function boundReportText(value: string, maximumCharacters: number) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maximumCharacters) return normalized;
  const candidate = normalized.slice(0, Math.max(1, maximumCharacters - 1)).trimEnd();
  const wordBoundary = candidate.lastIndexOf(" ");
  const bounded =
    wordBoundary >= Math.floor(maximumCharacters * 0.72)
      ? candidate.slice(0, wordBoundary)
      : candidate;
  return `${bounded}…`;
}

function displayReportValue(
  snapshot: DiscoverySnapshot,
  questionById: Map<string, DiscoveryQuestion>,
  questionId: string,
  maximumCharacters: number,
) {
  return boundReportText(
    displayValue(snapshot, questionById, questionId),
    maximumCharacters,
  );
}

function deriveJourneyPosition(
  snapshot: DiscoverySnapshot,
  questions: DiscoveryQuestion[],
) {
  if (snapshot.activeMilestone === "review" || snapshot.status === "review") {
    return { chapter: REVIEW_CHAPTER, questionIndex: 0 };
  }
  for (let chapterIndex = 0; chapterIndex < REVIEW_CHAPTER; chapterIndex += 1) {
    const milestone = chapterMilestones[chapterIndex];
    const chapterQuestions = questions.filter(
      (question) => question.milestone === milestone,
    );
    const unanswered = chapterQuestions.findIndex(
      (question) =>
        question.required && !hasCaptured(answerFor(snapshot, question.id)),
    );
    if (unanswered >= 0) {
      return { chapter: chapterIndex, questionIndex: unanswered };
    }
  }
  return { chapter: REVIEW_CHAPTER, questionIndex: 0 };
}

function validChatPatch(patch: ChatPatch, question?: DiscoveryQuestion) {
  if (!question) return false;
  if (patch.kind === "observation") {
    return (
      typeof patch.value === "string" &&
      patch.value.trim().length > 0 &&
      patch.value.length <= DISCOVERY_LONG_TEXT_MAX_LENGTH &&
      !containsSensitiveDataCue(patch.value)
    );
  }
  if (question.fieldType === "single_select") {
    return (
      typeof patch.value === "string" &&
      Boolean(question.options?.some((option) => option.value === patch.value))
    );
  }
  if (question.fieldType === "multi_select") {
    return (
      Array.isArray(patch.value) &&
      patch.value.length > 0 &&
      patch.value.every((value) =>
        question.options?.some((option) => option.value === value),
      )
    );
  }
  if (question.fieldType === "number") {
    return typeof patch.value === "number" && Number.isFinite(patch.value);
  }
  const maximum =
    question.fieldType === "long_text"
      ? DISCOVERY_LONG_TEXT_MAX_LENGTH
      : DISCOVERY_SHORT_TEXT_MAX_LENGTH;
  return (
    typeof patch.value === "string" &&
    patch.value.trim().length > 0 &&
    patch.value.length <= maximum &&
    !containsSensitiveDataCue(patch.value)
  );
}

function QuestionField({
  question,
  value,
  draftValue,
  invalid,
  labelledBy,
  describedBy,
  onAnswer,
  onDraft,
  onCommitDraft,
}: {
  question: DiscoveryQuestion;
  value: DiscoveryValue | undefined;
  draftValue?: string;
  invalid: boolean;
  labelledBy: string;
  describedBy?: string;
  onAnswer: (value: DiscoveryValue) => void;
  onDraft?: (value: string) => void;
  onCommitDraft?: (value: string) => void;
}) {
  if (question.fieldType === "single_select") {
    const options = question.options ?? [];
    const hasSelectedOption = options.some((option) => option.value === value);
    const moveRadioFocus = (
      event: KeyboardEvent<HTMLButtonElement>,
      currentIndex: number,
    ) => {
      let nextIndex: number | null = null;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        nextIndex = (currentIndex + 1) % options.length;
      } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        nextIndex = (currentIndex - 1 + options.length) % options.length;
      } else if (event.key === "Home") {
        nextIndex = 0;
      } else if (event.key === "End") {
        nextIndex = options.length - 1;
      }
      if (nextIndex === null || !options[nextIndex]) return;
      event.preventDefault();
      onAnswer(options[nextIndex].value);
      const radios = event.currentTarget.parentElement?.querySelectorAll<
        HTMLButtonElement
      >('[role="radio"]');
      radios?.[nextIndex]?.focus();
    };

    return (
      <div
        className="discovery-options"
        role="radiogroup"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-required={question.required || undefined}
        aria-invalid={invalid}
      >
        {options.map((option, index) => {
          const selected = value === option.value;
          return (
            <button
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (!hasSelectedOption && index === 0) ? 0 : -1}
              className={selected ? "is-selected" : ""}
              key={option.value}
              onClick={() => onAnswer(option.value)}
              onKeyDown={(event) => moveRadioFocus(event, index)}
            >
              <span>
                <strong>{option.label}</strong>
                {option.description ? <small>{option.description}</small> : null}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.fieldType === "multi_select") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div
        className="discovery-options discovery-options--multi"
        role="group"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-invalid={invalid}
      >
        {question.options?.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              type="button"
              aria-pressed={active}
              className={active ? "is-selected" : ""}
              key={option.value}
              onClick={() =>
                onAnswer(
                  active
                    ? selected.filter((item) => item !== option.value)
                    : [...selected, option.value],
                )
              }
            >
              <span><strong>{option.label}</strong></span>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.fieldType === "long_text") {
    const longTextValue =
      draftValue ??
      (typeof value === "string" && !isUnknownValue(value) ? value : "");

    return (
      <AutoGrowLongText
        resetKey={question.id}
        maxLength={DISCOVERY_LONG_TEXT_MAX_LENGTH}
        value={longTextValue}
        placeholder={question.placeholder}
        labelledBy={labelledBy}
        describedBy={describedBy}
        required={question.required}
        invalid={invalid}
        onDraft={onDraft}
        onCommitDraft={onCommitDraft}
      />
    );
  }

  return (
    <input
      type={question.fieldType === "number" ? "number" : "text"}
      maxLength={DISCOVERY_SHORT_TEXT_MAX_LENGTH}
      value={
        question.fieldType === "short_text"
          ? (draftValue ??
            (!isUnknownValue(value) && typeof value === "string" ? value : ""))
          : !isUnknownValue(value) &&
              (typeof value === "string" || typeof value === "number")
          ? value
          : ""
      }
      placeholder={question.placeholder}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-required={question.required || undefined}
      aria-invalid={invalid}
      onChange={(event) =>
        question.fieldType === "number"
          ? onAnswer(Number(event.target.value))
          : onDraft?.(event.target.value)
      }
      onBlur={(event) => {
        if (question.fieldType !== "number") {
          onCommitDraft?.(event.target.value);
        }
      }}
    />
  );
}

function resizeLongTextArea(textarea: HTMLTextAreaElement) {
  const styles = window.getComputedStyle(textarea);
  const minimumHeight = Number.parseFloat(styles.minHeight) || 176;
  const lineHeight = Number.parseFloat(styles.lineHeight) || 24;
  const paddingBottom = Number.parseFloat(styles.paddingBottom) || 0;
  const borderHeight =
    (Number.parseFloat(styles.borderTopWidth) || 0) +
    (Number.parseFloat(styles.borderBottomWidth) || 0);

  textarea.style.height = "0px";
  textarea.style.minHeight = "0px";
  textarea.style.paddingTop = "0px";

  const contentHeight = Math.max(
    lineHeight,
    textarea.scrollHeight - paddingBottom,
  );
  const targetHeight = Math.max(
    minimumHeight,
    Math.ceil(contentHeight + paddingBottom + borderHeight),
  );
  const paddingTop = Math.max(
    0,
    targetHeight - contentHeight - paddingBottom - borderHeight,
  );

  textarea.style.minHeight = "";
  textarea.style.paddingTop = `${paddingTop}px`;
  textarea.style.height = `${targetHeight}px`;
  textarea.scrollTop = 0;
}

function AutoGrowLongText({
  resetKey,
  value,
  maxLength,
  placeholder,
  labelledBy,
  describedBy,
  required,
  invalid,
  onDraft,
  onCommitDraft,
}: {
  resetKey: string;
  value: string;
  maxLength: number;
  placeholder?: string;
  labelledBy: string;
  describedBy?: string;
  required: boolean;
  invalid: boolean;
  onDraft?: (value: string) => void;
  onCommitDraft?: (value: string) => void;
}) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resize = useCallback(() => {
    if (textareaRef.current) resizeLongTextArea(textareaRef.current);
  }, []);

  useLayoutEffect(() => {
    resize();
  }, [resetKey, resize, value]);

  useEffect(() => {
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, [resize]);

  return (
    <textarea
      ref={textareaRef}
      rows={1}
      maxLength={maxLength}
      value={value}
      placeholder={placeholder}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-required={required || undefined}
      aria-invalid={invalid}
      onChange={(event) => {
        onDraft?.(event.target.value);
        resizeLongTextArea(event.currentTarget);
      }}
      onBlur={(event) => onCommitDraft?.(event.target.value)}
    />
  );
}

export function DiscoveryCockpit() {
  const [snapshot, setSnapshot] = useState<DiscoverySnapshot>(() =>
    createInitialSnapshot(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [chapter, setChapter] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [journeyDirection, setJourneyDirection] =
    useState<JourneyDirection>("forward");
  const [notice, setNotice] = useState("");
  const [invalidQuestionId, setInvalidQuestionId] = useState<string | null>(null);
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [editingFromReview, setEditingFromReview] = useState(false);
  const [persistLocally, setPersistLocally] = useState(true);
  const [saveState, setSaveState] = useState(
    "Saved in this browser. You can close this and come back.",
  );
  const [saveConflict, setSaveConflict] = useState(false);
  const [talkOpen, setTalkOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [voiceError, setVoiceError] = useState("");
  const [voiceAnnouncement, setVoiceAnnouncement] = useState("");
  const [agentReply, setAgentReply] = useState("");
  const [pendingChat, setPendingChat] = useState<{
    message: string;
    patches: ChatPatch[];
    caseId: string;
    revision: number;
    mutationEpoch: number;
  } | null>(null);
  const [isAgentBusy, setIsAgentBusy] = useState(false);
  const [leadForm, setLeadForm] = useState({
    workEmail: "",
    organisation: "",
    name: "",
    consent: false,
  });
  const [leadSubmission, setLeadSubmission] = useState<{
    status: "idle" | "submitting" | "error" | "confirmed";
    message: string;
  }>({ status: "idle", message: "" });
  const [fullReport, setFullReport] = useState<FullDiagnosticReport | null>(null);

  const snapshotRef = useRef(snapshot);
  const activeContentRef = useRef<HTMLElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const fullReportHeadingRef = useRef<HTMLHeadingElement>(null);
  const chatInputRef = useRef<HTMLTextAreaElement>(null);
  const focusChatInputAfterProposalEditRef = useRef(false);
  const agentAbortRef = useRef<AbortController | null>(null);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const voiceCancelledRef = useRef(false);
  const mountedRef = useRef(true);
  const leadAbortRef = useRef<AbortController | null>(null);
  const leadSubmissionMutexRef = useRef(false);
  const leadContactEpochRef = useRef(0);
  const leadRequestIdentityRef = useRef<RequestIdentity | null>(null);
  const agentRequestRef = useRef(0);
  const leadRequestEpochRef = useRef(0);
  const mutationEpochRef = useRef(0);
  const persistenceEpochRef = useRef(0);
  const localRepositoryRef = useRef<DiscoveryRepository | null>(null);
  const sessionRepositoryRef = useRef<DiscoveryRepository | null>(null);
  const persistedRevisionRef = useRef<{
    local: number | null;
    session: number | null;
  }>({ local: null, session: null });

  const dispatch = useCallback((action: DiscoveryCommand) => {
    mutationEpochRef.current += 1;
    setSnapshot((current) =>
      discoveryReducer(current, {
        ...action,
        occurredAt: new Date().toISOString(),
      }),
    );
  }, []);

  const cancelVoiceCapture = useCallback((resetState = true) => {
    voiceCancelledRef.current = true;
    voiceAbortRef.current?.abort();
    voiceAbortRef.current = null;
    if (voiceTimerRef.current !== null) {
      window.clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    const recorder = voiceRecorderRef.current;
    voiceRecorderRef.current = null;
    if (recorder && recorder.state !== "inactive") {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      recorder.stop();
    }
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
    if (resetState && mountedRef.current) {
      setVoiceState("idle");
      setVoiceError("");
      setVoiceAnnouncement("");
    }
  }, []);

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(
    () => {
      mountedRef.current = true;
      setVoiceSupported(
        transcriptionEnabled &&
          Boolean(navigator.mediaDevices?.getUserMedia) &&
          typeof MediaRecorder !== "undefined",
      );
      return () => {
        mountedRef.current = false;
        cancelVoiceCapture(false);
        agentAbortRef.current?.abort();
        leadAbortRef.current?.abort();
        leadSubmissionMutexRef.current = false;
      };
    },
    [cancelVoiceCapture],
  );

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      try {
        try {
          localRepositoryRef.current = createBrowserDiscoveryRepository(
            window.localStorage,
            STORAGE_KEY,
            STORAGE_TTL_MS,
          );
        } catch {
          localRepositoryRef.current = null;
        }
        try {
          sessionRepositoryRef.current = createBrowserDiscoveryRepository(
            window.sessionStorage,
            STORAGE_KEY,
            STORAGE_TTL_MS,
          );
        } catch {
          sessionRepositoryRef.current = null;
        }

        const [local, session] = await Promise.all([
          localRepositoryRef.current?.load() ?? null,
          sessionRepositoryRef.current?.load() ?? null,
        ]);
        if (cancelled) return;
        persistedRevisionRef.current = {
          local: local?.ok ? local.revision : null,
          session: session?.ok ? session.revision : null,
        };
        const candidates = [
          local?.ok && local.value
            ? { source: "local", value: local.value }
            : null,
          session?.ok && session.value
            ? { source: "session", value: session.value }
            : null,
        ]
          .filter(
            (
              item,
            ): item is { source: string; value: DiscoverySnapshot } =>
              Boolean(item),
          )
          .sort(
            (a, b) =>
              Date.parse(b.value.updatedAt) - Date.parse(a.value.updatedAt) ||
              b.value.revision - a.value.revision,
          );
        const restored = candidates[0];
        if (restored) {
          setSnapshot(restored.value);
          setPersistLocally(restored.source === "local");
          const position = deriveJourneyPosition(
            restored.value,
            getQuestions(restored.value),
          );
          setChapter(position.chapter);
          setQuestionIndex(position.questionIndex);
          if (restored.value.status === "lead_submitted") {
            setLeadSubmission({
              status: "idle",
              message:
                "Contact confirmation is not stored in this browser. Submit the form again to open the complete diagnostic.",
            });
          }
          setSaveState("Progress restored");
          return;
        }

        const requested = new URLSearchParams(window.location.search).get(
          "sector",
        );
        if (
          requested === "finance" ||
          requested === "insurance" ||
          requested === "healthcare" ||
          requested === "other"
        ) {
          setSnapshot((current) =>
            discoveryReducer(current, {
              type: "SET_PROFILE",
              field: "sector",
              value: requested,
              occurredAt: new Date().toISOString(),
            }),
          );
          setChapter(0);
        }
      } catch {
        if (!cancelled) {
          setSaveState("Keep this tab open");
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    };
    void start();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || saveConflict) return;
    const epoch = persistenceEpochRef.current + 1;
    persistenceEpochRef.current = epoch;
    const controller = new AbortController();
    const persist = async () => {
      setSaveState("Saving");
      const name = persistLocally ? "local" : "session";
      const otherName = persistLocally ? "session" : "local";
      const target = persistLocally
        ? localRepositoryRef.current
        : sessionRepositoryRef.current;
      const other = persistLocally
        ? sessionRepositoryRef.current
        : localRepositoryRef.current;
      const result = await target?.save(
        snapshot,
        persistedRevisionRef.current[name],
        controller.signal,
      );
      if (result?.ok) {
        persistedRevisionRef.current[name] = result.revision;
      }
      if (controller.signal.aborted || epoch !== persistenceEpochRef.current) return;
      if (result?.ok) {
        const cleared = await other?.clear(controller.signal);
        if (cleared?.ok) persistedRevisionRef.current[otherName] = null;
        setSaveState(
          persistLocally
            ? "Saved in this browser. You can close this and come back."
            : "Saved in this tab.",
        );
      } else if (result?.reason === "conflict") {
        setSaveState("Newer version in another tab");
        setSaveConflict(true);
      } else {
        setSaveState("Keep this tab open");
      }
    };
    void persist();
    return () => controller.abort();
  }, [hydrated, persistLocally, saveConflict, snapshot]);

  useEffect(() => {
    if (snapshot.status !== "analyzing") return;
    const timer = window.setTimeout(() => {
      dispatch({ type: "SET_STATUS", status: "preview_ready" });
    }, 820);
    return () => window.clearTimeout(timer);
  }, [dispatch, snapshot.status]);

  const questions = useMemo(() => getQuestions(snapshot), [snapshot]);
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const report = useMemo(() => buildReportPreview(snapshot), [snapshot]);
  const reportPreparedDate = useMemo(
    () =>
      new Intl.DateTimeFormat("en", {
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date(report.generatedAt)),
    [report.generatedAt],
  );
  const coverage = useMemo(() => calculateCoverage(snapshot), [snapshot]);
  const activeIds =
    chapter < REVIEW_CHAPTER
      ? questions
          .filter(
            (question) => question.milestone === chapterMilestones[chapter],
          )
          .map((question) => question.id)
      : [];
  const activeQuestion = questionById.get(activeIds[questionIndex] ?? "");
  const journeyProgress = calculateJourneyProgress(
    snapshot,
    activeQuestion?.id,
    chapter === REVIEW_CHAPTER,
  );

  useEffect(() => {
    if (
      !hydrated ||
      snapshot.status === "analyzing" ||
      snapshot.status === "preview_ready" ||
      snapshot.status === "lead_submitted"
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      activeContentRef.current?.scrollIntoView({
        block: "center",
        behavior: "auto",
      });
      activeContentRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chapter, hydrated, questionIndex, snapshot.status]);

  useEffect(() => {
    if (
      !hydrated ||
      fullReport ||
      (snapshot.status !== "preview_ready" &&
        snapshot.status !== "lead_submitted")
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      previewHeadingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fullReport, hydrated, snapshot.status]);

  useEffect(() => {
    if (!hydrated || !fullReport) return;
    const frame = window.requestAnimationFrame(() => {
      fullReportHeadingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [fullReport, hydrated]);

  useEffect(() => {
    if (!focusChatInputAfterProposalEditRef.current || pendingChat) return;
    focusChatInputAfterProposalEditRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      chatInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pendingChat]);

  const invalidateLeadResult = () => {
    leadAbortRef.current?.abort();
    leadAbortRef.current = null;
    leadSubmissionMutexRef.current = false;
    leadRequestEpochRef.current += 1;
    setFullReport(null);
    leadRequestIdentityRef.current = null;
    setLeadSubmission({ status: "idle", message: "" });
  };

  const updateLeadForm = (update: Partial<typeof leadForm>) => {
    leadContactEpochRef.current += 1;
    if (leadSubmissionMutexRef.current) {
      leadAbortRef.current?.abort();
      leadAbortRef.current = null;
      leadSubmissionMutexRef.current = false;
      leadRequestEpochRef.current += 1;
      setLeadSubmission({ status: "idle", message: "" });
    }
    setLeadForm((current) => ({ ...current, ...update }));
  };

  const setAnswer = (questionId: string, value: DiscoveryValue) => {
    if (
      typeof value === "string" &&
      value.trim() &&
      !isUnknownValue(value) &&
      containsSensitiveDataCue(value)
    ) {
      setInvalidQuestionId(questionId);
      setNotice("Remove personal or confidential information before continuing.");
      return;
    }
    invalidateLeadResult();
    setPendingChat(null);
    setInvalidQuestionId(null);
    setNotice("");
    setTextDrafts((current) => {
      if (!Object.hasOwn(current, questionId)) return current;
      const next = { ...current };
      delete next[questionId];
      return next;
    });
    dispatch({
      type: "ANSWER_QUESTION",
      questionId,
      value,
      source: "form",
      confidence: isUnknownValue(value) ? 0.35 : 0.9,
    });
  };

  const setDraft = (questionId: string, value: string) => {
    setTextDrafts((current) => ({ ...current, [questionId]: value }));
  };

  const commitDraft = (questionId: string, value: string) => {
    if (containsSensitiveDataCue(value)) {
      setInvalidQuestionId(questionId);
      setNotice("Remove personal or confidential information before continuing.");
      return false;
    }
    setAnswer(questionId, value);
    return true;
  };

  const moveToChapter = (
    nextChapter: number,
    nextQuestion = 0,
    direction: JourneyDirection = "forward",
  ) => {
    if (leadSubmissionMutexRef.current || leadAbortRef.current) {
      invalidateLeadResult();
    }
    const safeChapter = Math.max(0, Math.min(REVIEW_CHAPTER, nextChapter));
    cancelVoiceCapture();
    setJourneyDirection(direction);
    setChapter(safeChapter);
    setQuestionIndex(nextQuestion);
    setTalkOpen(false);
    setPendingChat(null);
    setAgentReply("");
    dispatch({
      type: "SET_MILESTONE",
      milestone: chapterMilestones[safeChapter],
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const advance = () => {
    if (!activeQuestion) return;
    const hasDraft = Object.hasOwn(textDrafts, activeQuestion.id);
    const effectiveValue = hasDraft
      ? textDrafts[activeQuestion.id]
      : answerFor(snapshot, activeQuestion.id);
    if (
      hasDraft &&
      !commitDraft(activeQuestion.id, textDrafts[activeQuestion.id] ?? "")
    ) {
      return;
    }
    if (activeQuestion.required && !hasCaptured(effectiveValue)) {
      setInvalidQuestionId(activeQuestion.id);
      setNotice("We need this one to make the analysis useful.");
      return;
    }
    if (editingFromReview) {
      setEditingFromReview(false);
      moveToChapter(REVIEW_CHAPTER, 0, "forward");
      return;
    }
    if (questionIndex < activeIds.length - 1) {
      setJourneyDirection("forward");
      setQuestionIndex((current) => current + 1);
      setNotice("");
      return;
    }
    moveToChapter(chapter + 1);
  };

  const back = () => {
    if (chapter === 0 && questionIndex === 0) return;
    const targetChapter = questionIndex === 0 ? chapter - 1 : chapter;
    const targetChapterIds = questions
      .filter(
        (question) => question.milestone === chapterMilestones[targetChapter],
      )
      .map((question) => question.id);
    const targetQuestionIndex =
      questionIndex === 0
        ? Math.max(0, targetChapterIds.length - 1)
        : questionIndex - 1;
    const targetQuestionId = targetChapterIds[targetQuestionIndex];
    if (!targetQuestionId) return;

    const clearedQuestionIds = new Set(
      getDiscoveryQuestionIdsFrom(targetQuestionId, snapshot),
    );
    invalidateLeadResult();
    agentAbortRef.current?.abort();
    agentAbortRef.current = null;
    agentRequestRef.current += 1;
    cancelVoiceCapture();
    setTextDrafts((current) =>
      Object.fromEntries(
        Object.entries(current).filter(
          ([questionId]) => !clearedQuestionIds.has(questionId),
        ),
      ),
    );
    setChatInput("");
    setTalkOpen(false);
    setPendingChat(null);
    setAgentReply("");
    setIsAgentBusy(false);
    setInvalidQuestionId(null);
    setNotice("");
    setJourneyDirection("back");
    setChapter(targetChapter);
    setQuestionIndex(targetQuestionIndex);
    dispatch({
      type: "TRUNCATE_FROM_QUESTION",
      questionId: targetQuestionId,
      milestone: chapterMilestones[targetChapter],
    });
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const markUnknown = () => {
    if (!activeQuestion?.allowUnknown) return;
    setAnswer(activeQuestion.id, "Unknown / validate next");
    if (editingFromReview) {
      setEditingFromReview(false);
      moveToChapter(REVIEW_CHAPTER, 0, "forward");
      return;
    }
    if (questionIndex < activeIds.length - 1) {
      setJourneyDirection("forward");
      setQuestionIndex((current) => current + 1);
    } else {
      moveToChapter(chapter + 1);
    }
  };

  const transcribeRecording = async (audio: Blob, mimeType: string) => {
    if (audio.size > MAX_TRANSCRIPTION_BYTES) {
      setVoiceState("error");
      const message = "That recording is larger than 4 MB. Try a shorter one.";
      setVoiceError(message);
      setVoiceAnnouncement(message);
      return;
    }
    if (audio.size === 0) {
      setVoiceState("error");
      const message = "No audio was captured. Try again.";
      setVoiceError(message);
      setVoiceAnnouncement(message);
      return;
    }

    const controller = new AbortController();
    voiceAbortRef.current?.abort();
    voiceAbortRef.current = controller;
    setVoiceState("transcribing");
    setVoiceError("");
    setVoiceAnnouncement("Transcribing the recording.");
    const extension = mimeType.startsWith("audio/mp4")
      ? "m4a"
      : mimeType.startsWith("audio/mpeg")
        ? "mp3"
        : mimeType.startsWith("audio/wav")
          ? "wav"
          : "webm";
    const body = new FormData();
    body.append("audio", audio, `recording.${extension}`);

    try {
      const response = await fetch("/api/transcriptions", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const payload = (await response.json().catch(() => null)) as
        | { text?: unknown; error?: { message?: unknown } }
        | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.error?.message === "string"
            ? payload.error.message
            : "The recording could not be transcribed. Try again.",
        );
      }
      const transcript =
        typeof payload?.text === "string"
          ? payload.text.trim().slice(0, DISCOVERY_MESSAGE_MAX_LENGTH)
          : "";
      if (!transcript) {
        throw new Error("No speech was detected. Try again.");
      }
      if (!controller.signal.aborted && mountedRef.current) {
        setChatInput((current) => {
          return appendBoundedDraft(
            current,
            transcript,
            DISCOVERY_MESSAGE_MAX_LENGTH,
          );
        });
        setVoiceState("idle");
        setVoiceAnnouncement(
          "Transcript added to the editable draft. Review it before submitting.",
        );
      }
    } catch (error) {
      if (!controller.signal.aborted && mountedRef.current) {
        const message =
          error instanceof Error
            ? error.message
            : "Voice transcription is temporarily unavailable.";
        setVoiceState("error");
        setVoiceError(message);
        setVoiceAnnouncement(message);
      }
    } finally {
      if (voiceAbortRef.current === controller) {
        voiceAbortRef.current = null;
      }
    }
  };

  const stopVoiceRecording = () => {
    const recorder = voiceRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    if (voiceTimerRef.current !== null) {
      window.clearTimeout(voiceTimerRef.current);
      voiceTimerRef.current = null;
    }
    setVoiceState("transcribing");
    setVoiceAnnouncement("Transcribing the recording.");
    recorder.stop();
    voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
    voiceStreamRef.current = null;
  };

  const startVoiceRecording = async () => {
    if (!voiceSupported || voiceState === "requesting") return;
    voiceAbortRef.current?.abort();
    voiceAbortRef.current = null;
    voiceCancelledRef.current = false;
    setVoiceState("requesting");
    setVoiceError("");
    setVoiceAnnouncement("Waiting for microphone permission.");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      if (mountedRef.current && !voiceCancelledRef.current) {
        const message =
          "Microphone access was not available. You can continue by typing.";
        setVoiceState("error");
        setVoiceError(message);
        setVoiceAnnouncement(message);
      }
      return;
    }

    if (!mountedRef.current || voiceCancelledRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const mimeType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
    ].find((candidate) => MediaRecorder.isTypeSupported(candidate));
    if (!mimeType) {
      stream.getTracks().forEach((track) => track.stop());
      const message =
        "This browser cannot record a supported audio format. You can continue by typing.";
      setVoiceState("error");
      setVoiceError(message);
      setVoiceAnnouncement(message);
      return;
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      const message =
        "Audio recording could not start. You can continue by typing.";
      setVoiceState("error");
      setVoiceError(message);
      setVoiceAnnouncement(message);
      return;
    }

    const chunks: Blob[] = [];
    voiceStreamRef.current = stream;
    voiceRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = () => {
      voiceCancelledRef.current = true;
      if (voiceTimerRef.current !== null) {
        window.clearTimeout(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
      voiceRecorderRef.current = null;
      if (mountedRef.current) {
        const message =
          "Audio recording stopped unexpectedly. You can continue by typing.";
        setVoiceState("error");
        setVoiceError(message);
        setVoiceAnnouncement(message);
      }
    };
    recorder.onstop = () => {
      voiceRecorderRef.current = null;
      if (voiceTimerRef.current !== null) {
        window.clearTimeout(voiceTimerRef.current);
        voiceTimerRef.current = null;
      }
      voiceStreamRef.current?.getTracks().forEach((track) => track.stop());
      voiceStreamRef.current = null;
      if (voiceCancelledRef.current || !mountedRef.current) return;
      const audio = new Blob(chunks, { type: recorder.mimeType || mimeType });
      void transcribeRecording(audio, recorder.mimeType || mimeType);
    };

    try {
      recorder.start(1_000);
    } catch {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.onerror = null;
      voiceRecorderRef.current = null;
      voiceStreamRef.current = null;
      stream.getTracks().forEach((track) => track.stop());
      const message =
        "Audio recording could not start. You can continue by typing.";
      setVoiceState("error");
      setVoiceError(message);
      setVoiceAnnouncement(message);
      return;
    }
    setVoiceState("recording");
    setVoiceAnnouncement("Recording. Stops automatically after 60 seconds.");
    voiceTimerRef.current = window.setTimeout(
      stopVoiceRecording,
      MAX_RECORDING_MS,
    );
  };

  const submitTalk = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatInput
      .trim()
      .slice(0, DISCOVERY_MESSAGE_MAX_LENGTH);
    if (!message || isAgentBusy || pendingChat) return;
    if (containsSensitiveDataCue(message)) {
      setNotice("Remove personal or confidential information before continuing.");
      return;
    }
    const requestId = agentRequestRef.current + 1;
    agentRequestRef.current = requestId;
    agentAbortRef.current?.abort();
    const controller = new AbortController();
    agentAbortRef.current = controller;
    const boundary = {
      caseId: snapshot.caseId,
      revision: snapshot.revision,
      milestone: snapshot.activeMilestone,
      mutationEpoch: mutationEpochRef.current,
    };
    const currentBoundary = () => {
      const current = snapshotRef.current;
      return (
        !controller.signal.aborted &&
        agentRequestRef.current === requestId &&
        current.caseId === boundary.caseId &&
        current.revision === boundary.revision &&
        current.activeMilestone === boundary.milestone &&
        mutationEpochRef.current === boundary.mutationEpoch
      );
    };
    setIsAgentBusy(true);
    setAgentReply("");
    try {
      const patches: ChatPatch[] = [];
      let reply = "";
      for await (const event of localDiscoveryAgent.streamTurn(
        {
          message,
          questions: activeQuestion ? [activeQuestion] : questions,
          snapshot,
        },
        controller.signal,
      )) {
        if (!currentBoundary()) return;
        if (event.type === "patches") patches.push(...event.patches);
        if (event.type === "reply_delta") reply += event.delta;
      }
      if (!currentBoundary()) return;
      dispatch({ type: "ADD_MESSAGE", role: "user", content: message });
      dispatch({ type: "ADD_MESSAGE", role: "agent", content: reply });
      setAgentReply(reply);
      const safePatches = patches.filter((patch) =>
        validChatPatch(patch, questionById.get(patch.questionId)),
      );
      if (safePatches.length) {
        setPendingChat({
          message,
          patches: safePatches,
          caseId: boundary.caseId,
          revision: snapshot.revision + 2,
          mutationEpoch: mutationEpochRef.current,
        });
      } else if (patches.length) {
        setAgentReply("Those details could not be added safely. Please answer the question directly.");
      }
      setChatInput("");
    } finally {
      if (agentRequestRef.current === requestId) {
        setIsAgentBusy(false);
        agentAbortRef.current = null;
      }
    }
  };

  const usePendingDetails = () => {
    if (!pendingChat) return;
    const current = snapshotRef.current;
    if (
      current.caseId !== pendingChat.caseId ||
      current.revision !== pendingChat.revision ||
      mutationEpochRef.current !== pendingChat.mutationEpoch
    ) {
      setPendingChat(null);
      setAgentReply("The answers changed, so that proposal was discarded.");
      return;
    }
    const safePatches = pendingChat.patches.filter((patch) =>
      validChatPatch(patch, questionById.get(patch.questionId)),
    );
    if (!safePatches.length) {
      setPendingChat(null);
      setAgentReply("Those details could not be added safely.");
      return;
    }
    invalidateLeadResult();
    dispatch({
      type: "APPLY_CHAT_PROPOSAL",
      answers: safePatches
        .filter((patch) => patch.kind === "answer")
        .map((patch) => ({
          questionId: patch.questionId,
          value: patch.value,
          confidence: patch.confidence,
        })),
      observations: safePatches
        .filter((patch) => patch.kind === "observation")
        .map((patch) => ({
          questionId: patch.questionId,
          statement: String(patch.value),
          confidence: patch.confidence,
        })),
    });
    setPendingChat(null);
    setAgentReply("Added to your answers. You can edit anything before the preview.");
  };

  const editPendingDetails = () => {
    if (!pendingChat) return;
    focusChatInputAfterProposalEditRef.current = true;
    setChatInput(pendingChat.message);
    setPendingChat(null);
    setAgentReply("");
  };

  const generateReport = () => {
    dispatch({ type: "SET_STATUS", status: "analyzing" });
  };

  const submitLead = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (leadSubmissionMutexRef.current) return;
    const leadName = leadForm.name.trim();
    if (
      !isValidContactEmail(leadForm.workEmail) ||
      !isContactTextWithinLimits(
        leadForm.organisation,
        CONTACT_FIELD_LIMITS.organisation,
      ) ||
      (leadName.length > 0 &&
        !isContactTextWithinLimits(
          leadForm.name,
          CONTACT_FIELD_LIMITS.name,
        )) ||
      !leadForm.consent
    ) {
      setLeadSubmission({
        status: "error",
        message: LEAD_SUBMISSION_ERROR_MESSAGE,
      });
      return;
    }
    leadSubmissionMutexRef.current = true;

    const submittedSnapshot = snapshotRef.current;
    const submittedContact = {
      workEmail: normalizeContactEmail(leadForm.workEmail),
      organisation: leadForm.organisation.trim(),
      ...(leadName ? { name: leadName } : {}),
    };
    const unsignedPayload = {
      schemaVersion: 1 as const,
      caseId: submittedSnapshot.caseId,
      caseRevision: submittedSnapshot.revision,
      contact: submittedContact,
      consent: {
        accepted: leadForm.consent,
        version: LEAD_CONSENT_VERSION,
      },
      snapshot: submittedSnapshot,
    };
    const payloadSignature = JSON.stringify(unsignedPayload);
    const requestIdentity = resolveRequestIdentity(
      leadRequestIdentityRef.current,
      payloadSignature,
      () => window.crypto.randomUUID(),
    );
    leadRequestIdentityRef.current = requestIdentity;

    const requestEpoch = leadRequestEpochRef.current + 1;
    leadRequestEpochRef.current = requestEpoch;
    const boundary = {
      caseId: submittedSnapshot.caseId,
      revision: submittedSnapshot.revision,
      mutationEpoch: mutationEpochRef.current,
      contactEpoch: leadContactEpochRef.current,
      payloadSignature,
      requestId: requestIdentity.requestId,
      requestEpoch,
    };
    const controller = new AbortController();
    leadAbortRef.current?.abort();
    leadAbortRef.current = controller;
    setLeadSubmission({ status: "submitting", message: "" });
    try {
      const response = await fetch("/api/lead-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          ...unsignedPayload,
          requestId: requestIdentity.requestId,
        }),
      });
      const result = (await response.json()) as LeadResponse;
      const current = snapshotRef.current;
      const boundaryChanged =
        controller.signal.aborted ||
        leadRequestEpochRef.current !== boundary.requestEpoch ||
        mutationEpochRef.current !== boundary.mutationEpoch ||
        leadContactEpochRef.current !== boundary.contactEpoch ||
        leadRequestIdentityRef.current?.payloadSignature !==
          boundary.payloadSignature ||
        current.caseId !== boundary.caseId ||
        current.revision !== boundary.revision;
      if (boundaryChanged) return;
      if (
        !response.ok ||
        !result.ok ||
        result.caseId !== boundary.caseId ||
        result.requestId !== boundary.requestId
      ) {
        if (
          !result.ok &&
          result.error.code === "IDEMPOTENCY_CONFLICT"
        ) {
          leadRequestIdentityRef.current = null;
        }
        setLeadSubmission({
          status: "error",
          message: LEAD_SUBMISSION_ERROR_MESSAGE,
        });
        return;
      }
      setFullReport(result.fullReport);
      dispatch({
        type: "CONFIRM_LEAD_REQUEST",
        handoffId: result.handoffId,
        confirmedAt: result.confirmedAt,
      });
      setLeadSubmission({
        status: "confirmed",
        message: "Unlocked. The full report is also on its way to your inbox.",
      });
    } catch {
      if (!controller.signal.aborted) {
        setLeadSubmission({
          status: "error",
          message: LEAD_SUBMISSION_ERROR_MESSAGE,
        });
      }
    } finally {
      if (leadAbortRef.current === controller) leadAbortRef.current = null;
      if (leadRequestEpochRef.current === boundary.requestEpoch) {
        leadSubmissionMutexRef.current = false;
      }
    }
  };

  if (!hydrated) {
    return (
      <main className="discovery-app discovery-loading" aria-live="polite">
        <BlockLoader />
      </main>
    );
  }

  if (snapshot.status === "analyzing") {
    return (
      <main className="discovery-app discovery-analysis" aria-live="polite">
        <BlockLoader size="large" />
        <p>{ANALYSIS_MESSAGE}</p>
      </main>
    );
  }

  if (
    snapshot.status === "preview_ready" ||
    snapshot.status === "lead_submitted"
  ) {
    return (
      <main
        className={`discovery-app discovery-preview${fullReport ? " is-unlocked" : ""}`}
      >
        <header className="discovery-preview-toolbar">
          <BrandLogo priority />
          <div>
            <button
              type="button"
              onClick={() => createBrowserPrintExporter(window).exportPreview()}
            >
              Download as PDF <BlockArrow />
            </button>
            <button
              type="button"
              onClick={() => moveToChapter(REVIEW_CHAPTER)}
            >
              Edit answers
            </button>
          </div>
        </header>

        <div className="discovery-report-pages" id="report-preview">
          <article className="discovery-report-page" aria-label="Report page 1">
            <header>
              <span>NNCO</span>
              <span>Workflow diagnostic</span>
            </header>
            <div className="discovery-report-title">
              <span>Page 1</span>
              <h1 ref={previewHeadingRef} tabIndex={-1}>
                Workflow diagnostic
              </h1>
              <p>{boundReportText(report.scope.focus, 160)}</p>
              <small>
                Prepared for {leadForm.organisation || report.scope.organisation},{" "}
                {reportPreparedDate}
              </small>
            </div>
            <section className="discovery-report-scope">
              <span>Scope</span>
              <dl>
                <div><dt>Sector</dt><dd>{report.scope.sector}</dd></div>
                <div><dt>Organisation</dt><dd>{report.scope.organisation}</dd></div>
              </dl>
            </section>
            <section className="discovery-work-map">
              <span>The workflow as you described it</span>
              <div>
                <article>
                  <small>Inputs</small>
                  <p>
                    {displayReportValue(
                      snapshot,
                      questionById,
                      "workflow.inputs",
                      150,
                    )}
                  </p>
                </article>
                <article>
                  <small>Workflow</small>
                  <p>
                    {displayReportValue(
                      snapshot,
                      questionById,
                      "workflow.scope",
                      180,
                    )}
                  </p>
                </article>
                <article>
                  <small>Systems</small>
                  <p>
                    {displayReportValue(
                      snapshot,
                      questionById,
                      "readiness.systems",
                      150,
                    )}
                  </p>
                </article>
              </div>
            </section>
            <section className="discovery-delivery-block">
              <span>Evidence basis</span>
              <p>
                This is the process as you mapped it, in the order it runs.
                Everything below is derived from these answers.
              </p>
            </section>
            <footer><span>Prepared by NNCO. Not a formal assessment. nnco.ai</span><span>1 / 6</span></footer>
          </article>

          <article
            className={`discovery-report-page${
              fullReport ? "" : " discovery-report-page--final"
            }`}
            aria-label="Report page 2"
          >
            <header>
              <span>NNCO</span>
              <span>Where the time goes</span>
            </header>
            <div className="discovery-report-title">
              <span>Page 2</span>
              <h2>Where the time goes</h2>
              <p>
                The steps that consume attention without requiring judgement,
                and the points where work waits for someone else.
              </p>
            </div>
            <ol className="discovery-priorities">
              {report.problems.slice(0, 3).map((problem, index) => (
                <li key={problem.id}>
                  <span>0{index + 1}</span>
                  <div>
                    <h3>{boundReportText(problem.title, 88)}</h3>
                    <small>What we heard</small>
                    <p>{boundReportText(problem.finding, 230)}</p>
                    <dl>
                      <div><dt>Impact</dt><dd>{problem.impact}</dd></div>
                      <div><dt>Readiness</dt><dd>{problem.feasibility}</dd></div>
                      <div><dt>Evidence</dt><dd>Your input / not verified</dd></div>
                    </dl>
                  </div>
                </li>
              ))}
            </ol>
            <footer><span>Prepared by NNCO. Not a formal assessment. nnco.ai</span><span>2 / 6</span></footer>
          </article>
        </div>

        {!fullReport ? (
          <section className="discovery-gate">
            <div>
              <span>Pages three to six</span>
              <h2>The rest of the analysis</h2>
              <p>
                Pages three to six cover what AI could take over, the
                constraints on each candidate and a suggested sequence. Tell us
                where to send them.
              </p>
            </div>
            <form onSubmit={submitLead}>
              <label>
                Name
                <input
                  type="text"
                  minLength={CONTACT_FIELD_LIMITS.name.minLength}
                  maxLength={CONTACT_FIELD_LIMITS.name.maxLength}
                  autoComplete="name"
                  value={leadForm.name}
                  onChange={(event) =>
                    updateLeadForm({ name: event.target.value })
                  }
                />
              </label>
              <label>
                Work email
                <input
                  type="email"
                  required
                  maxLength={CONTACT_FIELD_LIMITS.workEmail.maxLength}
                  pattern={CONTACT_EMAIL_PATTERN_SOURCE}
                  autoComplete="email"
                  value={leadForm.workEmail}
                  onChange={(event) =>
                    updateLeadForm({ workEmail: event.target.value })
                  }
                />
              </label>
              <label>
                Organisation
                <input
                  type="text"
                  required
                  minLength={CONTACT_FIELD_LIMITS.organisation.minLength}
                  maxLength={CONTACT_FIELD_LIMITS.organisation.maxLength}
                  autoComplete="organization"
                  value={leadForm.organisation}
                  onChange={(event) =>
                    updateLeadForm({ organisation: event.target.value })
                  }
                />
              </label>
              <label className="discovery-consent">
                <input
                  type="checkbox"
                  required
                  checked={leadForm.consent}
                  onChange={(event) =>
                    updateLeadForm({ consent: event.target.checked })
                  }
                />
                <span>
                  I agree that NNCO may use these details and this diagnostic to
                  prepare the complete report and contact me about the result.{" "}
                  <a href="/privacy">Privacy</a>
                </span>
              </label>
              <p className="discovery-gate-note">
                We will send the full report and one reply from a person. No
                sequence, no newsletter.
              </p>
              {leadSubmission.message && !fullReport ? (
                <p
                  className={`discovery-error${
                    leadSubmission.status === "error" ? " is-error" : ""
                  }`}
                  role={leadSubmission.status === "error" ? "alert" : "status"}
                >
                  {leadSubmission.message}
                </p>
              ) : null}
              <button
                className="discovery-primary"
                type="submit"
                disabled={leadSubmission.status === "submitting"}
              >
                {leadSubmission.status === "submitting"
                  ? "Sending"
                  : "Send me the full report"}{" "}
                <BlockArrow />
              </button>
            </form>
          </section>
        ) : (
          <section
            className="discovery-full-report"
            aria-label="Complete diagnostic report"
          >
            <article className="discovery-report-page" aria-label="Report page 3">
              <header>
                <span>NNCO</span>
                <span>What AI could take over</span>
              </header>
              <div className="discovery-report-title discovery-report-title--compact">
                <span>Page 3</span>
                <h2 ref={fullReportHeadingRef} tabIndex={-1}>
                  What AI could take over
                </h2>
                <p>
                  Per step: what a system could do, what would stay with a
                  person, and what it would need access to.
                </p>
              </div>
              <ol className="discovery-route-list">
                {fullReport.solutionOptions.map((option, index) => (
                  <li key={option.id}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>{boundReportText(option.title, 84)}</h3>
                      <p>{boundReportText(option.principle, 150)}</p>
                    </div>
                    <dl>
                      <div>
                        <dt>Stays with a person</dt>
                        <dd>Approval at material decision points</dd>
                      </div>
                      <div>
                        <dt>Needs access to</dt>
                        <dd>
                          {boundReportText(
                            option.dataAndIntegrations.join(" · "),
                            160,
                          )}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
              <footer>
                <span>Prepared by NNCO. Not a formal assessment. nnco.ai</span>
                <span>3 / 6</span>
              </footer>
            </article>

            <article
              className="discovery-report-page"
              aria-label="Report page 4"
            >
              <header>
                <span>NNCO</span>
                <span>Constraints</span>
              </header>
              <div className="discovery-report-title discovery-report-title--compact">
                <span>Page 4</span>
                <h2>Constraints</h2>
                <p>
                  The data, access and evidence questions each candidate would
                  have to answer before it could be deployed.
                </p>
              </div>
              <section className="discovery-delivery-block">
                <span>Systems</span>
                <p>
                  {displayReportValue(
                    snapshot,
                    questionById,
                    "readiness.systems",
                    360,
                  )}
                </p>
              </section>
              <section className="discovery-delivery-block">
                <span>Controls</span>
                <p>
                  {displayReportValue(
                    snapshot,
                    questionById,
                    "readiness.constraints",
                    360,
                  )}
                </p>
              </section>
              <section className="discovery-delivery-block">
                <span>Questions to verify</span>
                <p>
                  {boundReportText(
                    Array.from(
                      new Set(
                        fullReport.solutionOptions.flatMap(
                          (option) => option.risks,
                        ),
                      ),
                    ).join(" "),
                    520,
                  )}
                </p>
              </section>
              <footer>
                <span>Prepared by NNCO. Not a formal assessment. nnco.ai</span>
                <span>4 / 6</span>
              </footer>
            </article>

            <article className="discovery-report-page" aria-label="Report page 5">
              <header>
                <span>NNCO</span>
                <span>Sequence</span>
              </header>
              <div className="discovery-report-title discovery-report-title--compact">
                <span>Page 5</span>
                <h2>Sequence</h2>
                <p>
                  A suggested order, with the reason each item sits where it
                  does.
                </p>
              </div>
              <section className="discovery-delivery-block">
                <span>Recommended next step</span>
                <p>{boundReportText(fullReport.recommendedNextStep, 420)}</p>
              </section>
              <ol className="discovery-report-roadmap">
                {fullReport.roadmap.slice(0, 3).map((step, index) => (
                  <li key={step.window}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <small>{boundReportText(step.window, 32)}</small>
                    <strong>{boundReportText(step.objective, 90)}</strong>
                    <p>{boundReportText(step.output, 150)}</p>
                  </li>
                ))}
              </ol>
              <footer>
                <span>Prepared by NNCO. Not a formal assessment. nnco.ai</span>
                <span>5 / 6</span>
              </footer>
            </article>

            <article
              className="discovery-report-page discovery-report-page--final"
              aria-label="Report page 6"
            >
              <header>
                <span>NNCO</span>
                <span>Limits of this analysis</span>
              </header>
              <div className="discovery-report-title discovery-report-title--compact">
                <span>Page 6</span>
                <h2>What this analysis cannot tell you</h2>
                <p>
                  Written from your answers alone, without seeing the systems
                  or the data. The parts below would need to be checked before
                  anything is committed.
                </p>
              </div>
              <section className="discovery-delivery-block">
                <span>Not verified</span>
                <p>
                  Volumes, exception frequency, data quality, access paths,
                  control ownership and the behaviour of the workflow on real
                  cases.
                </p>
              </section>
              <section className="discovery-delivery-block">
                <span>What happens next</span>
                <p>
                  This is a diagnostic, not an audit. An audit looks at the
                  systems, the data and the constraints directly, and produces
                  a plan you can commit budget to.
                </p>
              </section>
              <div className="discovery-report-closing">
                <a href="/contact">Book a 30-minute call <BlockArrow /></a>
              </div>
              <footer>
                <span>Prepared by NNCO. Not a formal assessment. nnco.ai</span>
                <span>6 / 6</span>
              </footer>
            </article>
          </section>
        )}
      </main>
    );
  }

  const activeQuestionKey = activeQuestion?.id.replaceAll(".", "-") ?? "";
  const activeQuestionLabelId = activeQuestionKey
    ? `discovery-question-${activeQuestionKey}-label`
    : "";
  const activeQuestionHelpId = activeQuestionKey
    ? `discovery-question-${activeQuestionKey}-help`
    : "";
  const activeQuestionHelp = activeQuestion
    ? activeQuestion.help ??
      (activeQuestion.fieldType === "short_text" ||
      activeQuestion.fieldType === "long_text"
        ? "A sentence is enough. Detail helps but is not required."
        : undefined)
    : undefined;
  const activeQuestionDescription = [
    activeQuestionHelp ? activeQuestionHelpId : "",
    invalidQuestionId === activeQuestion?.id && notice
      ? "discovery-question-notice"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const voiceStatusMessage = voiceAnnouncement || voiceError;

  const talkThrough =
    chapter < REVIEW_CHAPTER ? (
      <details
        className="discovery-talk"
        open={talkOpen}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          setTalkOpen(open);
          if (!open) cancelVoiceCapture();
        }}
      >
        <summary>
          <span>Ask a question about any step. It goes into the same case.</span>
          <span className="discovery-disclosure-indicator" aria-hidden="true">
            <BlockArrow direction="down" />
          </span>
        </summary>
        <div>
          <p id="discovery-talk-help">
            Describe this question in your own words. We will propose details
            for you to approve.
          </p>
          <form onSubmit={submitTalk}>
            <textarea
              ref={chatInputRef}
              rows={3}
              maxLength={DISCOVERY_MESSAGE_MAX_LENGTH}
              value={chatInput}
              disabled={isAgentBusy || Boolean(pendingChat)}
              placeholder="Describe what happens without names or private records."
              aria-label="Describe this answer in your own words"
              aria-describedby={
                voiceSupported
                  ? "discovery-talk-help discovery-voice-disclosure"
                  : "discovery-talk-help"
              }
              onChange={(event) => setChatInput(event.target.value)}
            />
            <div className="discovery-talk-actions">
              {voiceSupported ? (
                <button
                  className="discovery-voice-button"
                  type="button"
                  aria-pressed={voiceState === "recording"}
                  disabled={
                    voiceState === "requesting" ||
                    voiceState === "transcribing" ||
                    isAgentBusy ||
                    Boolean(pendingChat)
                  }
                  onClick={
                    voiceState === "recording"
                      ? stopVoiceRecording
                      : startVoiceRecording
                  }
                >
                  {voiceState === "recording"
                    ? "Stop"
                    : voiceState === "transcribing"
                      ? "Transcribing"
                      : "Speak"}
                </button>
              ) : null}
              <button
                type="submit"
                disabled={
                  !chatInput.trim() || isAgentBusy || Boolean(pendingChat)
                }
              >
                {isAgentBusy ? "Working" : "Suggest details"} <BlockArrow />
              </button>
            </div>
          </form>
          {voiceSupported ? (
            <p
              className="discovery-voice-disclosure"
              id="discovery-voice-disclosure"
            >
              Audio is sent to OpenAI for transcription and is not stored by
              this site. The transcript remains an editable draft and is saved
              only when you submit it with Suggest details. Do not include
              personal or confidential information.
            </p>
          ) : null}
          {voiceSupported ? (
            <p
              className={`${voiceState === "error"
                ? "discovery-voice-error"
                : "discovery-voice-status"}${
                voiceStatusMessage ? "" : " sr-only"
              }`}
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              {voiceStatusMessage}
            </p>
          ) : null}
          {pendingChat ? (
            <div className="discovery-proposal">
              <span>Proposed summary</span>
              {pendingChat.patches.map((patch, index) => (
                <p key={`${patch.questionId}-${index}`}>
                  <strong>
                    {questionById.get(patch.questionId)?.shortLabel ??
                      "Additional detail"}
                  </strong>
                  {": "}
                  {Array.isArray(patch.value)
                    ? patch.value.join(", ")
                    : String(patch.value)}
                </p>
              ))}
              <div>
                <button type="button" onClick={editPendingDetails}>Edit</button>
                <button type="button" onClick={usePendingDetails}>
                  Use these details
                </button>
              </div>
            </div>
          ) : agentReply ? (
            <p className="discovery-talk-reply">{agentReply}</p>
          ) : null}
        </div>
      </details>
    ) : null;
  return (
    <main className="discovery-app discovery-intake">
      <section className="discovery-canvas">
        <div className="discovery-interaction">
          <aside className="discovery-section-index" aria-label="Discovery sections">
            <ol>
              {milestones.map((milestone, index) => (
                <li
                  key={milestone.id}
                  className={chapter === index ? "is-active" : undefined}
                  aria-current={chapter === index ? "step" : undefined}
                >
                  <span>{milestone.label}</span>
                  <small>{milestone.description}</small>
                </li>
              ))}
            </ol>
          </aside>

          <div className="discovery-form-column">
            {chapter < REVIEW_CHAPTER && activeQuestion ? (
              <article
                key={activeQuestion.id}
                ref={(node) => {
                  activeContentRef.current = node;
                }}
                className={`discovery-question discovery-step-motion is-${journeyDirection}`}
                data-question-id={activeQuestion.id}
                tabIndex={-1}
              >
                <h1 id={activeQuestionLabelId}>{activeQuestion.prompt}</h1>
                {activeQuestionHelp ? (
                  <p id={activeQuestionHelpId}>{activeQuestionHelp}</p>
                ) : null}
                <QuestionField
                  question={activeQuestion}
                  value={answerFor(snapshot, activeQuestion.id)}
                  draftValue={
                    Object.hasOwn(textDrafts, activeQuestion.id)
                      ? textDrafts[activeQuestion.id]
                      : undefined
                  }
                  invalid={invalidQuestionId === activeQuestion.id}
                  labelledBy={activeQuestionLabelId}
                  describedBy={activeQuestionDescription || undefined}
                  onAnswer={(value) => setAnswer(activeQuestion.id, value)}
                  onDraft={(value) => setDraft(activeQuestion.id, value)}
                  onCommitDraft={(value) =>
                    commitDraft(activeQuestion.id, value)
                  }
                />
              </article>
            ) : null}

            {talkThrough}

            {chapter === REVIEW_CHAPTER ? (
              <div
                ref={(node) => {
                  activeContentRef.current = node;
                }}
                className={`discovery-review discovery-step-motion is-${journeyDirection}`}
                tabIndex={-1}
              >
                <header>
                  <h1>Check what you told us before we analyse it.</h1>
                  <p>Nothing below has been independently verified.</p>
                </header>
                {[
                  {
                    title: "Context",
                    items: [
                      "context.organisationType",
                      "context.sizeBand",
                      "context.sector",
                      "context.role",
                      "context.focusArea",
                    ],
                  },
                  {
                    title: "Workflow",
                    items: [
                      "workflow.scope",
                      "workflow.handoffs",
                      "workflow.inputs",
                    ],
                  },
                  {
                    title: "Friction",
                    items: [
                      "friction.repetition",
                      "friction.exceptions",
                      "friction.impact",
                    ],
                  },
                  {
                    title: "Constraints",
                    items: [
                      "readiness.systems",
                      "readiness.constraints",
                      "goal.outcome",
                      "goal.horizon",
                      "goal.investmentPosture",
                    ],
                  },
                ]
                  .map((summary) => ({
                    ...summary,
                    items: summary.items.filter((id) => {
                      const question = questionById.get(id);
                      return (
                        Boolean(question) &&
                        (question?.required ||
                          hasCaptured(answerFor(snapshot, id)))
                      );
                    }),
                  }))
                  .filter((summary) => summary.items.length > 0)
                  .map((summary) => (
                  <article key={summary.title}>
                    <div>
                      <span>{summary.title}</span>
                      {summary.items.map((questionId) => (
                        <div className="discovery-review-value" key={questionId}>
                          <p>{displayValue(snapshot, questionById, questionId)}</p>
                          <button
                            type="button"
                            onClick={() => {
                              const target = questionById.get(questionId);
                              if (!target) return;
                              const targetChapter = chapterMilestones.indexOf(
                                target.milestone,
                              );
                              const targetIndex = questions
                                .filter(
                                  (question) =>
                                    question.milestone === target.milestone,
                                )
                                .findIndex(
                                  (question) => question.id === questionId,
                                );
                              setEditingFromReview(true);
                              moveToChapter(
                                targetChapter,
                                targetIndex,
                                "back",
                              );
                            }}
                          >
                            Edit
                          </button>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
                <button
                  className="discovery-primary"
                  type="button"
                  disabled={!coverage.readyForPreview}
                  onClick={generateReport}
                >
                  Build preview <BlockArrow />
                </button>
              </div>
            ) : null}

            {notice ? (
              <p
                className="discovery-notice"
                id="discovery-question-notice"
                role="alert"
              >
                {notice}
              </p>
            ) : null}

            {chapter < REVIEW_CHAPTER ? (
              <div className="discovery-actions">
                <button
                  type="button"
                  onClick={() => {
                    if (editingFromReview) {
                      setEditingFromReview(false);
                      moveToChapter(REVIEW_CHAPTER, 0, "forward");
                    } else {
                      back();
                    }
                  }}
                >
                  {editingFromReview ? "Back to review" : "Back"}
                </button>
                <div>
                  {activeQuestion?.allowUnknown ? (
                    <button type="button" onClick={markUnknown}>
                      Skip
                    </button>
                  ) : null}
                  <button
                    className="discovery-primary"
                    type="button"
                    onClick={advance}
                  >
                    Next <BlockArrow />
                  </button>
                </div>
              </div>
            ) : null}

            {chapter < REVIEW_CHAPTER ? (
              <p className="discovery-privacy">{saveState}</p>
            ) : null}
          </div>
        </div>
        <div
          className="discovery-progress"
          style={
            {
              "--discovery-progress": `${journeyProgress}%`,
            } as CSSProperties
          }
        >
          <div className="discovery-progress-labels">
            <span id="discovery-progress-label">
              Progress {Math.round(journeyProgress)}%
            </span>
          </div>
          <div
            className="discovery-progress-track"
            role="progressbar"
            aria-labelledby="discovery-progress-label"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={journeyProgress}
            aria-valuetext={`${journeyProgress}% complete`}
          >
            <span aria-hidden="true" />
          </div>
        </div>
      </section>
    </main>
  );
}
