import {
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
  containsSensitiveDataCue,
  createInitialSnapshot,
  discoveryReducer,
  getDiscoveryQuestionIdsFrom,
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
  localDiscoveryAgent,
  type ChatPatch,
  type DiscoveryRepository,
} from "@/lib/discovery-client";
import {
  LEAD_CONSENT_VERSION,
  type FullDiagnosticReport,
  type IndicativeRange,
  type LeadResponse,
} from "@/lib/lead-contract";

const STORAGE_KEY = "nnc.signal.discovery.v2";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1_000;
const MAX_TRANSCRIPTION_BYTES = 4 * 1024 * 1024;
const MAX_RECORDING_MS = 60_000;
const transcriptionEnabled =
  import.meta.env.PUBLIC_TRANSCRIPTION_ENABLED === "true";
type VoiceState =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"
  | "error";
type JourneyDirection = "forward" | "back";
const analysisLines = [
  "Structuring the workflow",
  "Testing impact",
  "Preparing your preview",
] as const;
const chapterMilestones = ["context", "workflow", "review"] as const;
const REVIEW_CHAPTER = 2;

function getDiagnosticQuestionIds(questions: DiscoveryQuestion[]) {
  return questions
    .filter((question) => question.id !== "context.sector")
    .map((question) => question.id);
}

function answerFor(snapshot: DiscoverySnapshot, questionId: string) {
  return snapshot.answers[questionId]?.value;
}

function hasCaptured(value: DiscoveryValue | undefined) {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function formatRange(range: IndicativeRange) {
  const amount = new Intl.NumberFormat("en", {
    style: "currency",
    currency: range.currency,
    maximumFractionDigits: 0,
  });
  return `${amount.format(range.min)} to ${amount.format(range.max)} ${
    range.unit === "monthly" ? "per month" : "one-off"
  }`;
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
  if (!hasCaptured(snapshot.answers["context.sector"]?.value)) {
    return { chapter: 0, questionIndex: 0 };
  }
  if (snapshot.activeMilestone === "review" || snapshot.status === "review") {
    return { chapter: REVIEW_CHAPTER, questionIndex: 0 };
  }
  const byId = new Map(questions.map((question) => [question.id, question]));
  const ids = getDiagnosticQuestionIds(questions);
  const unanswered = ids.findIndex((id) => {
    const question = byId.get(id);
    return question?.required && !hasCaptured(answerFor(snapshot, id));
  });
  return {
    chapter: 1,
    questionIndex: unanswered >= 0 ? unanswered : 0,
  };
}

function validChatPatch(patch: ChatPatch, question?: DiscoveryQuestion) {
  if (!question) return false;
  if (patch.kind === "observation") {
    return (
      typeof patch.value === "string" &&
      patch.value.trim().length > 0 &&
      patch.value.length <= 1_200 &&
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
  const maximum = question.fieldType === "long_text" ? 1_200 : 240;
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
    const selectionLimit = question.maxSelections ?? Number.POSITIVE_INFINITY;
    return (
      <div
        className="discovery-options discovery-options--multi"
        role="group"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        aria-required={question.required || undefined}
        aria-invalid={invalid}
      >
        {question.options?.map((option) => {
          const active = selected.includes(option.value);
          const atSelectionLimit =
            !active && selected.length >= selectionLimit;
          return (
            <button
              type="button"
              aria-pressed={active}
              className={active ? "is-selected" : ""}
              disabled={atSelectionLimit}
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
        maxLength={1_200}
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
      maxLength={240}
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
  const [persistLocally, setPersistLocally] = useState(false);
  const [, setSaveState] = useState("Saved in this tab");
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
  const [analysisStage, setAnalysisStage] = useState(0);
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
  const [leadRequestId, setLeadRequestId] = useState("");
  const [fullReport, setFullReport] = useState<FullDiagnosticReport | null>(null);

  const snapshotRef = useRef(snapshot);
  const activeContentRef = useRef<HTMLElement>(null);
  const previewHeadingRef = useRef<HTMLHeadingElement>(null);
  const agentAbortRef = useRef<AbortController | null>(null);
  const voiceAbortRef = useRef<AbortController | null>(null);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceStreamRef = useRef<MediaStream | null>(null);
  const voiceTimerRef = useRef<number | null>(null);
  const voiceCancelledRef = useRef(false);
  const mountedRef = useRef(true);
  const leadAbortRef = useRef<AbortController | null>(null);
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
      };
    },
    [cancelVoiceCapture],
  );

  useEffect(() => {
    let cancelled = false;
    const start = async () => {
      localRepositoryRef.current = createBrowserDiscoveryRepository(
        window.localStorage,
        STORAGE_KEY,
        STORAGE_TTL_MS,
      );
      sessionRepositoryRef.current = createBrowserDiscoveryRepository(
        window.sessionStorage,
        STORAGE_KEY,
        STORAGE_TTL_MS,
      );
      const [local, session] = await Promise.all([
        localRepositoryRef.current.load(),
        sessionRepositoryRef.current.load(),
      ]);
      if (cancelled) return;
      persistedRevisionRef.current = {
        local: local.ok ? local.revision : null,
        session: session.ok ? session.revision : null,
      };
      const candidates = [
        local.ok && local.value ? { source: "local", value: local.value } : null,
        session.ok && session.value
          ? { source: "session", value: session.value }
          : null,
      ]
        .filter(
          (
            item,
          ): item is { source: string; value: DiscoverySnapshot } => Boolean(item),
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
      } else {
        const requested = new URLSearchParams(window.location.search).get("sector");
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
          setChapter(1);
        }
      }
      setHydrated(true);
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
        setSaveState(persistLocally ? "Saved for 24 hours" : "Saved in this tab");
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
      if (analysisStage < analysisLines.length - 1) {
        setAnalysisStage((current) => current + 1);
      } else {
        dispatch({ type: "SET_STATUS", status: "preview_ready" });
      }
    }, 820);
    return () => window.clearTimeout(timer);
  }, [analysisStage, dispatch, snapshot.status]);

  const questions = useMemo(() => getQuestions(snapshot), [snapshot]);
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );
  const report = useMemo(() => buildReportPreview(snapshot), [snapshot]);
  const coverage = useMemo(() => calculateCoverage(snapshot), [snapshot]);
  const diagnosticQuestionIds = useMemo(
    () => getDiagnosticQuestionIds(questions),
    [questions],
  );
  const activeIds =
    chapter === 0
      ? ["context.sector"]
      : chapter === 1
        ? diagnosticQuestionIds
        : [];
  const activeQuestion = questionById.get(activeIds[questionIndex] ?? "");

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
    if (!hydrated || snapshot.status !== "preview_ready") return;
    const frame = window.requestAnimationFrame(() => {
      previewHeadingRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [hydrated, snapshot.status]);

  const invalidateLeadResult = () => {
    leadAbortRef.current?.abort();
    leadAbortRef.current = null;
    leadRequestEpochRef.current += 1;
    setFullReport(null);
    setLeadRequestId("");
    setLeadSubmission({ status: "idle", message: "" });
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
      setNotice("Add an answer or choose Not sure yet.");
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
    moveToChapter(REVIEW_CHAPTER);
  };

  const back = () => {
    const targetChapter =
      chapter === 1 && questionIndex === 0 ? 0 : Math.max(0, chapter);
    const targetQuestionIndex =
      targetChapter === 0 ? 0 : Math.max(0, questionIndex - 1);
    const targetQuestionId =
      targetChapter === 0
        ? "context.sector"
        : diagnosticQuestionIds[targetQuestionIndex];
    if (!targetQuestionId) return;

    const clearedQuestionIds = new Set(
      getDiscoveryQuestionIdsFrom(targetQuestionId),
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

  const chooseSector = (value: DiscoveryValue) => {
    setAnswer("context.sector", value);
    moveToChapter(1);
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
      moveToChapter(REVIEW_CHAPTER);
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
        typeof payload?.text === "string" ? payload.text.trim() : "";
      if (!transcript) {
        throw new Error("No speech was detected. Try again.");
      }
      if (!controller.signal.aborted && mountedRef.current) {
        setChatInput((current) => {
          const draft = current.trim();
          return draft ? `${draft}\n${transcript}` : transcript;
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
    const message = chatInput.trim();
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
    setChatInput(pendingChat.message);
    setPendingChat(null);
  };

  const generateReport = () => {
    setAnalysisStage(0);
    dispatch({ type: "SET_STATUS", status: "analyzing" });
  };

  const submitLead = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (leadSubmission.status === "submitting") return;
    const requestId = leadRequestId || window.crypto.randomUUID();
    if (!leadRequestId) setLeadRequestId(requestId);
    const submittedSnapshot = snapshotRef.current;
    const requestEpoch = leadRequestEpochRef.current + 1;
    leadRequestEpochRef.current = requestEpoch;
    const boundary = {
      caseId: submittedSnapshot.caseId,
      revision: submittedSnapshot.revision,
      mutationEpoch: mutationEpochRef.current,
      requestId,
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
          schemaVersion: 1,
          requestId,
          caseId: submittedSnapshot.caseId,
          caseRevision: submittedSnapshot.revision,
          contact: {
            workEmail: leadForm.workEmail,
            organisation: leadForm.organisation,
            name: leadForm.name || undefined,
          },
          consent: {
            accepted: leadForm.consent,
            version: LEAD_CONSENT_VERSION,
          },
          snapshot: submittedSnapshot,
        }),
      });
      const result = (await response.json()) as LeadResponse;
      const current = snapshotRef.current;
      const boundaryChanged =
        controller.signal.aborted ||
        leadRequestEpochRef.current !== boundary.requestEpoch ||
        mutationEpochRef.current !== boundary.mutationEpoch ||
        current.caseId !== boundary.caseId ||
        current.revision !== boundary.revision;
      if (boundaryChanged) return;
      if (
        !response.ok ||
        !result.ok ||
        result.caseId !== boundary.caseId ||
        result.requestId !== boundary.requestId
      ) {
        setLeadSubmission({
          status: "error",
          message: !result.ok
            ? result.error.message
            : "The server confirmation did not match this diagnostic.",
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
        message: "The complete diagnostic is ready below.",
      });
    } catch {
      if (!controller.signal.aborted) {
        setLeadSubmission({
          status: "error",
          message: "The request could not be confirmed. Please try again.",
        });
      }
    } finally {
      if (leadAbortRef.current === controller) leadAbortRef.current = null;
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
        <p key={analysisStage}>{analysisLines[analysisStage]}</p>
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
              Export PDF <BlockArrow />
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
              <span>Operational diagnosis</span>
            </header>
            <div className="discovery-report-title">
              <span>Page 1</span>
              <h1 ref={previewHeadingRef} tabIndex={-1}>
                {boundReportText(report.scope.focus, 72)}
              </h1>
              <p>{boundReportText(report.summary, 430)}</p>
            </div>
            <section className="discovery-report-scope">
              <span>Scope</span>
              <dl>
                <div><dt>Sector</dt><dd>{report.scope.sector}</dd></div>
                <div><dt>Organisation</dt><dd>{report.scope.organisation}</dd></div>
              </dl>
            </section>
            <section className="discovery-work-map">
              <span>Current work</span>
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
            <section className="discovery-readiness">
              <span>Readiness</span>
              <div><strong>{report.readiness.band}</strong><p>{report.readiness.statement}</p></div>
            </section>
            <footer><span>Your input / not verified</span><span>1 / 2</span></footer>
          </article>

          <article
            className={`discovery-report-page${
              fullReport ? "" : " discovery-report-page--final"
            }`}
            aria-label="Report page 2"
          >
            <header>
              <span>NNCO</span>
              <span>Top priorities</span>
            </header>
            <div className="discovery-report-title">
              <span>Page 2</span>
              <h2>Three priorities to validate next.</h2>
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
            <footer><span>Your input / not verified</span><span>2 / 2</span></footer>
          </article>
        </div>

        {!fullReport ? (
          <section className="discovery-gate">
            <div>
              <span>Complete diagnostic</span>
              <h2>Solutions, what they require, and estimated time and cost.</h2>
              <p>
                The complete report shows practical options, systems involved,
                and the first next step.
              </p>
            </div>
            <form onSubmit={submitLead}>
              <label>
                Work email
                <input
                  type="email"
                  required
                  autoComplete="email"
                  value={leadForm.workEmail}
                  onChange={(event) =>
                    setLeadForm((current) => ({
                      ...current,
                      workEmail: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Organisation
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={160}
                  autoComplete="organization"
                  value={leadForm.organisation}
                  onChange={(event) =>
                    setLeadForm((current) => ({
                      ...current,
                      organisation: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Name
                <input
                  type="text"
                  maxLength={120}
                  autoComplete="name"
                  value={leadForm.name}
                  onChange={(event) =>
                    setLeadForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="discovery-consent">
                <input
                  type="checkbox"
                  required
                  checked={leadForm.consent}
                  onChange={(event) =>
                    setLeadForm((current) => ({
                      ...current,
                      consent: event.target.checked,
                    }))
                  }
                />
                <span>
                  I agree that NNCO may use these details and this diagnostic to
                  prepare the complete report and contact me about the result.
                </span>
              </label>
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
                  ? "Preparing"
                  : "Get the complete diagnostic"}{" "}
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
                <span>Solution routes</span>
              </header>
              <div className="discovery-report-title discovery-report-title--compact">
                <span>Page 3</span>
                <h2>Practical routes forward.</h2>
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
                        <dt>Effort</dt>
                        <dd>{option.effort}</dd>
                      </div>
                      <div>
                        <dt>Timing</dt>
                        <dd>
                          {option.timingWeeks.min} to {option.timingWeeks.max} weeks
                        </dd>
                      </div>
                      <div>
                        <dt>Indicative price</dt>
                        <dd>
                          {boundReportText(
                            option.indicativeRanges.length
                              ? option.indicativeRanges.map(formatRange).join(" · ")
                              : "Validate after evidence review",
                            105,
                          )}
                        </dd>
                      </div>
                    </dl>
                  </li>
                ))}
              </ol>
              <footer>
                <span>Indicative / not an offer</span>
                <span>3 / 4</span>
              </footer>
            </article>

            <article
              className="discovery-report-page discovery-report-page--final"
              aria-label="Report page 4"
            >
              <header>
                <span>NNCO</span>
                <span>Recommended path</span>
              </header>
              <div className="discovery-report-title discovery-report-title--compact">
                <span>Page 4</span>
                <h2>A 90-day path to decision.</h2>
              </div>
              <section className="discovery-delivery-block">
                <span>Recommended next step</span>
                <p>{boundReportText(fullReport.recommendedNextStep, 360)}</p>
              </section>
              <section className="discovery-delivery-block">
                <span>Delivery model</span>
                <div>
                  <p>{boundReportText(fullReport.deliveryModel, 300)}</p>
                  <small>
                    Investment posture:{" "}
                    {boundReportText(fullReport.investmentPosture.label, 90)}
                  </small>
                </div>
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
                <span>Validate before implementation</span>
                <span>4 / 4</span>
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
  const activeQuestionDescription = [
    activeQuestion?.help ? activeQuestionHelpId : "",
    invalidQuestionId === activeQuestion?.id && notice
      ? "discovery-question-notice"
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const voiceStatusMessage = voiceAnnouncement || voiceError;

  const talkThrough =
    chapter === 1 ? (
      <details
        className="discovery-talk"
        open={talkOpen}
        onToggle={(event) => {
          const open = event.currentTarget.open;
          setTalkOpen(open);
          if (!open) cancelVoiceCapture();
        }}
      >
        <summary>Choose an option or describe it</summary>
        <div>
          <p id="discovery-talk-help">
            Describe this question in your own words. We will propose details
            for you to approve.
          </p>
          <form onSubmit={submitTalk}>
            <textarea
              rows={3}
              maxLength={1_200}
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
  void talkThrough;

  return (
    <main className="discovery-app discovery-intake">
      <section className="discovery-canvas">
        <div className="discovery-interaction">
          <aside className="discovery-section-index" aria-label="Discovery sections">
            <p>
              {chapter === 0
                ? "Sector"
                : chapter === REVIEW_CHAPTER
                  ? "Review"
                  : `Question ${questionIndex + 1} of ${diagnosticQuestionIds.length}`}
            </p>
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
                <h2 id={activeQuestionLabelId}>{activeQuestion.prompt}</h2>
                {activeQuestion.help ? (
                  <p id={activeQuestionHelpId}>{activeQuestion.help}</p>
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
                  onAnswer={(value) =>
                    chapter === 0
                      ? chooseSector(value)
                      : setAnswer(activeQuestion.id, value)
                  }
                  onDraft={(value) => setDraft(activeQuestion.id, value)}
                  onCommitDraft={(value) =>
                    commitDraft(activeQuestion.id, value)
                  }
                />
              </article>
            ) : null}

            {chapter === REVIEW_CHAPTER ? (
              <div
                ref={(node) => {
                  activeContentRef.current = node;
                }}
                className={`discovery-review discovery-step-motion is-${journeyDirection}`}
                tabIndex={-1}
              >
                <header>
                  <h1>Review what we heard.</h1>
                  <p>Nothing below has been independently verified.</p>
                </header>
                {[
                  {
                    title: "Workflow",
                    items: [
                      "workflow.scope",
                      "workflow.volumeBand",
                      "workflow.effortBand",
                    ],
                  },
                  {
                    title: "Capacity loss",
                    items: ["friction.repetition"],
                  },
                  {
                    title: "Operating environment",
                    items: ["workflow.inputs", "readiness.constraints"],
                  },
                  {
                    title: "Priority result",
                    items: ["goal.outcome"],
                  },
                ]
                  .map((summary) => ({
                    ...summary,
                    items: summary.items.filter((id) => questionById.has(id)),
                  }))
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
                              setEditingFromReview(true);
                              moveToChapter(
                                1,
                                diagnosticQuestionIds.indexOf(questionId),
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

            {chapter === 1 ? (
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
                      Not sure yet
                    </button>
                  ) : null}
                  <button
                    className="discovery-primary"
                    type="button"
                    onClick={advance}
                  >
                    Continue <BlockArrow />
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </main>
  );
}
