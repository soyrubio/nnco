import { DiscoveryBrandLogo as BrandLogo } from "./discovery/DiscoveryBrandLogo";
import { DiscoveryBlockArrow as BlockArrow } from "./discovery/DiscoveryBlockArrow";
import { DiscoveryBlockLoader as BlockLoader } from "./discovery/DiscoveryBlockLoader";
import {
  type SyntheticEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  buildReportPreview,
  calculateCoverage,
  containsSensitiveDataCue,
  createInitialSnapshot,
  discoveryReducer,
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
  localDiscoveryAgent,
  type ChatPatch,
  type DiscoveryRepository,
} from "@/lib/discovery-client";
import {
  LEAD_CONSENT_VERSION,
  type FullDiagnosticReport,
  type IndicativeRange,
  type LeadResponse,
  type SolutionKind,
} from "@/lib/lead-contract";

const STORAGE_KEY = "nnc.signal.discovery.v2";
const STORAGE_TTL_MS = 24 * 60 * 60 * 1_000;
const analysisStages = [
  "Structuring evidence",
  "Evaluating impact",
  "Testing feasibility",
  "Assembling report",
];

type ExperienceMode = "guided" | "interview";

function hasAnswer(value: DiscoveryValue | undefined): boolean {
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.trim().length > 0;
  return value !== null && value !== undefined;
}

function answerFor(snapshot: DiscoverySnapshot, questionId: string) {
  return snapshot.answers[questionId]?.value;
}

function percent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatPatchValue(
  question: DiscoveryQuestion | undefined,
  value: DiscoveryValue,
) {
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

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function shortCaseId(caseId: string) {
  return caseId.replace("SIGNAL-", "").slice(-10);
}

function formatRange(range: IndicativeRange) {
  const format = new Intl.NumberFormat("en", {
    style: "currency",
    currency: range.currency,
    maximumFractionDigits: 0,
  });
  return `${format.format(range.min)} to ${format.format(range.max)} ${
    range.unit === "monthly" ? "per month" : "one-off"
  }`;
}

function solutionKindLabel(kind: SolutionKind) {
  const labels: Record<SolutionKind, string> = {
    saas: "Existing SaaS",
    "agent-skill": "Agent or skill",
    "workflow-automation": "Workflow automation",
    integration: "Systems integration",
    custom: "Custom implementation",
    "process-change": "Process change",
  };
  return labels[kind];
}

function preferredScrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

function QuestionField({
  question,
  value,
  onAnswer,
  draftValue,
  onDraft,
  onCommitDraft,
  invalid,
}: {
  question: DiscoveryQuestion;
  value: DiscoveryValue | undefined;
  onAnswer: (value: DiscoveryValue) => void;
  draftValue?: string;
  onDraft: (value: string) => void;
  onCommitDraft: (value: string) => void;
  invalid: boolean;
}) {
  const selectedValues = Array.isArray(value) ? value : [];
  const unknown = isUnknownValue(value);

  if (question.fieldType === "single_select") {
    return (
      <div
        className="dc-option-grid"
        role="radiogroup"
        aria-label={question.prompt}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "discovery-notice" : undefined}
      >
        {question.options?.map((option, index, options) => {
          const selected = value === option.value;
          return (
            <button
              className={`dc-option${selected ? " is-selected" : ""}`}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (!hasAnswer(value) && index === 0) ? 0 : -1}
              key={option.value}
              onClick={() => onAnswer(option.value)}
              onKeyDown={(event) => {
                if (
                  event.key !== "ArrowRight" &&
                  event.key !== "ArrowDown" &&
                  event.key !== "ArrowLeft" &&
                  event.key !== "ArrowUp"
                ) {
                  return;
                }
                event.preventDefault();
                const direction =
                  event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
                const nextIndex = (index + direction + options.length) % options.length;
                onAnswer(options[nextIndex].value);
                const radios =
                  event.currentTarget.parentElement?.querySelectorAll<HTMLElement>(
                    '[role="radio"]',
                  );
                radios?.[nextIndex]?.focus();
              }}
            >
              <span>{option.label}</span>
              {option.description ? <small>{option.description}</small> : null}
              <i aria-hidden="true">{selected ? "✓" : "+"}</i>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.fieldType === "multi_select") {
    return (
      <div
        className="dc-option-grid dc-option-grid--multi"
        role="group"
        aria-label={question.prompt}
        data-invalid={invalid || undefined}
        aria-describedby={invalid ? "discovery-notice" : undefined}
      >
        {question.options?.map((option) => {
          const selected = selectedValues.includes(option.value);
          return (
            <button
              className={`dc-option${selected ? " is-selected" : ""}`}
              type="button"
              aria-pressed={selected}
              key={option.value}
              onClick={() =>
                onAnswer(
                  selected
                    ? selectedValues.filter((item) => item !== option.value)
                    : [...selectedValues, option.value],
                )
              }
            >
              <span>{option.label}</span>
              <i aria-hidden="true">{selected ? "✓" : "+"}</i>
            </button>
          );
        })}
      </div>
    );
  }

  if (question.fieldType === "long_text") {
    return (
      <textarea
        className="dc-textarea"
        rows={5}
        maxLength={1_200}
        value={
          draftValue ??
          (typeof value === "string" && !unknown ? value : "")
        }
        placeholder={question.placeholder}
        aria-label={question.prompt}
        aria-invalid={invalid || undefined}
        aria-describedby={invalid ? "discovery-notice" : undefined}
        onChange={(event) => onDraft(event.target.value)}
        onBlur={(event) => onCommitDraft(event.target.value)}
      />
    );
  }

  return (
    <input
      className="dc-input"
      type={question.fieldType === "number" ? "number" : "text"}
      maxLength={question.fieldType === "number" ? undefined : 240}
      value={
        question.fieldType === "short_text"
          ? (draftValue ??
            (!unknown && typeof value === "string" ? value : ""))
          : !unknown && (typeof value === "string" || typeof value === "number")
          ? value
          : ""
      }
      placeholder={question.placeholder}
      aria-label={question.prompt}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid ? "discovery-notice" : undefined}
      onChange={(event) => {
        if (question.fieldType === "number") {
          onAnswer(Number(event.target.value));
        } else {
          onDraft(event.target.value);
        }
      }}
      onBlur={(event) => {
        if (question.fieldType !== "number") onCommitDraft(event.target.value);
      }}
    />
  );
}

export function DiscoveryCockpit() {
  const [snapshot, setSnapshot] = useState<DiscoverySnapshot>(() =>
    createInitialSnapshot(),
  );
  const [hydrated, setHydrated] = useState(false);
  const [mode, setMode] = useState<ExperienceMode>("guided");
  const [chatInput, setChatInput] = useState("");
  const [isAgentBusy, setIsAgentBusy] = useState(false);
  const [agentDraft, setAgentDraft] = useState("");
  const [pendingChat, setPendingChat] = useState<{
    message: string;
    answers: ChatPatch[];
  } | null>(null);
  const [analysisStage, setAnalysisStage] = useState(0);
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadRequestId, setLeadRequestId] = useState("");
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
  const [persistLocally, setPersistLocally] = useState(false);
  const [showMobileAgent, setShowMobileAgent] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [contextNotice, setContextNotice] = useState("");
  const [invalidQuestionId, setInvalidQuestionId] = useState<string | null>(null);
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const chatEndRef = useRef<HTMLDivElement>(null);
  const mobileAgentRef = useRef<HTMLTextAreaElement>(null);
  const mobileAgentDialogRef = useRef<HTMLElement>(null);
  const mobileAgentToggleRef = useRef<HTMLButtonElement>(null);
  const leadDialogRef = useRef<HTMLElement>(null);
  const leadCloseRef = useRef<HTMLButtonElement>(null);
  const leadTriggerRef = useRef<HTMLButtonElement>(null);
  const localRepositoryRef = useRef<DiscoveryRepository | null>(null);
  const sessionRepositoryRef = useRef<DiscoveryRepository | null>(null);
  const snapshotRef = useRef(snapshot);
  const agentAbortRef = useRef<AbortController | null>(null);
  const leadAbortRef = useRef<AbortController | null>(null);
  const agentRequestRef = useRef(0);
  const mutationEpochRef = useRef(0);
  const persistenceEpochRef = useRef(0);
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

  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  useEffect(
    () => () => {
      agentAbortRef.current?.abort();
      leadAbortRef.current?.abort();
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    const hydrationTask = window.setTimeout(async () => {
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
      const localResult = await localRepositoryRef.current.load();
      const sessionResult = await sessionRepositoryRef.current.load();
      if (cancelled) return;
      persistedRevisionRef.current = {
        local: localResult.ok ? localResult.revision : null,
        session: sessionResult.ok ? sessionResult.revision : null,
      };
      const candidates = [
        localResult.ok && localResult.value
          ? { source: "local" as const, snapshot: localResult.value }
          : null,
        sessionResult.ok && sessionResult.value
          ? { source: "session" as const, snapshot: sessionResult.value }
          : null,
      ].filter(
        (
          candidate,
        ): candidate is {
          source: "local" | "session";
          snapshot: DiscoverySnapshot;
        } => Boolean(candidate),
      );
      candidates.sort((left, right) => {
        const timeDelta =
          Date.parse(right.snapshot.updatedAt) -
          Date.parse(left.snapshot.updatedAt);
        return timeDelta || right.snapshot.revision - left.snapshot.revision;
      });
      const restoredCandidate = candidates[0] ?? null;
      const restored = restoredCandidate?.snapshot ?? null;
      setPersistLocally(restoredCandidate?.source === "local");

      if (restored) {
        setSnapshot(restored);
        setContextNotice(
          `Progress restored / ${shortCaseId(restored.caseId)} / ${restored.activeMilestone}`,
        );
      } else {
        const requestedSector = new URLSearchParams(window.location.search).get(
          "sector",
        );
        if (
          requestedSector === "finance" ||
          requestedSector === "healthcare" ||
          requestedSector === "other"
        ) {
          setSnapshot((current) =>
            discoveryReducer(current, {
              type: "SET_PROFILE",
              field: "sector",
              value: requestedSector,
              occurredAt: new Date().toISOString(),
            }),
          );
        }
      }
      setHydrated(true);
    }, 0);

    return () => {
      cancelled = true;
      window.clearTimeout(hydrationTask);
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const epoch = persistenceEpochRef.current + 1;
    persistenceEpochRef.current = epoch;
    const controller = new AbortController();
    const persist = async () => {
      const targetName = persistLocally ? "local" : "session";
      const otherName = persistLocally ? "session" : "local";
      const target = persistLocally
        ? localRepositoryRef.current
        : sessionRepositoryRef.current;
      const other = persistLocally
        ? sessionRepositoryRef.current
        : localRepositoryRef.current;
      const expectedRevision = persistedRevisionRef.current[targetName];
      const saved = await target?.save(
        snapshot,
        expectedRevision,
        controller.signal,
      );
      if (saved?.ok) {
        persistedRevisionRef.current[targetName] = saved.revision;
      }
      if (
        controller.signal.aborted ||
        persistenceEpochRef.current !== epoch
      ) {
        return;
      }
      if (saved?.ok) {
        const cleared = await other?.clear(controller.signal);
        if (
          !controller.signal.aborted &&
          persistenceEpochRef.current === epoch &&
          cleared?.ok
        ) {
          persistedRevisionRef.current[otherName] = null;
        }
        return;
      }
      if (saved?.reason === "conflict") {
        setContextNotice(
          "A newer saved revision exists in another tab. This tab was not written; reload before continuing.",
        );
        return;
      }
      if (persistLocally) {
        setPersistLocally(false);
        setContextNotice(
          "The 24-hour save failed. The last session copy was retained.",
        );
      } else {
        setContextNotice(
          persistedRevisionRef.current.local !== null
            ? "Session storage is unavailable. The last 24-hour device copy was retained."
            : "Browser storage is unavailable. Keep this tab open to avoid losing progress.",
        );
      }
    };
    void persist();
    return () => {
      controller.abort();
    };
  }, [hydrated, persistLocally, snapshot]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1180px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (!showMobileAgent || !isMobile) return;
    mobileAgentRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const keepFocusInAgent = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowMobileAgent(false);
        mobileAgentToggleRef.current?.focus();
        return;
      }
      if (
        event.key !== "Tab" ||
        !mobileAgentDialogRef.current
      ) {
        return;
      }
      const controls = Array.from(
        mobileAgentDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled])',
        ),
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", keepFocusInAgent);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", keepFocusInAgent);
    };
  }, [isMobile, showMobileAgent]);

  useEffect(() => {
    if (!showLeadForm) return;
    leadCloseRef.current?.focus();
    const keepFocusInDialog = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowLeadForm(false);
        leadTriggerRef.current?.focus();
        return;
      }
      if (event.key !== "Tab" || !leadDialogRef.current) return;
      const controls = Array.from(
        leadDialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled])',
        ),
      );
      if (!controls.length) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", keepFocusInDialog);
    return () => window.removeEventListener("keydown", keepFocusInDialog);
  }, [showLeadForm]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: "nearest" });
  }, [snapshot.messages.length]);

  useEffect(() => {
    if (snapshot.status !== "analyzing") return;
    const timer = window.setTimeout(() => {
      if (analysisStage < analysisStages.length - 1) {
        setAnalysisStage((stage) => stage + 1);
      } else {
        dispatch({ type: "SET_STATUS", status: "preview_ready" });
      }
    }, 720);
    return () => window.clearTimeout(timer);
  }, [analysisStage, dispatch, snapshot.status]);

  const questions = useMemo(() => getQuestions(snapshot), [snapshot]);
  const milestones = useMemo(() => getMilestones(), []);
  const coverage = useMemo(() => calculateCoverage(snapshot), [snapshot]);
  const report = useMemo(() => buildReportPreview(snapshot), [snapshot]);
  const activeMilestoneIndex = milestones.findIndex(
    (milestone) => milestone.id === snapshot.activeMilestone,
  );
  const activeQuestions = questions.filter(
    (question) => question.milestone === snapshot.activeMilestone,
  );
  const completedMilestones = useMemo(
    () =>
      new Set(
        milestones
          .filter((milestone) => {
            if (milestone.id === "review") return coverage.readyForPreview;
            const required = questions.filter(
              (question) =>
                question.milestone === milestone.id && question.required,
            );
            return (
              required.length > 0 &&
              required.every((question) =>
                hasAnswer(answerFor(snapshot, question.id)),
              )
            );
          })
          .map((milestone) => milestone.id),
      ),
    [coverage.readyForPreview, milestones, questions, snapshot],
  );
  const evidenceForMilestone = snapshot.evidence.filter((evidence) => {
    const question = questions.find((item) => item.id === evidence.questionId);
    return question?.milestone === snapshot.activeMilestone;
  });

  const setQuestionAnswer = (questionId: string, value: DiscoveryValue) => {
    const question = questions.find((item) => item.id === questionId);
    if (
      question &&
      (question.fieldType === "short_text" ||
        question.fieldType === "long_text") &&
      typeof value === "string" &&
      value !== "Unknown / validate next" &&
      containsSensitiveDataCue(value)
    ) {
      setInvalidQuestionId(questionId);
      setContextNotice(
        "Possible personal or confidential identifier detected. It was not saved. Use categories and workflow descriptions only; this is a best-effort screen, not a DLP guarantee.",
      );
      return;
    }
    if (invalidQuestionId === questionId) setInvalidQuestionId(null);
    if (
      question?.fieldType === "short_text" ||
      question?.fieldType === "long_text"
    ) {
      setTextDrafts((current) => {
        const next = { ...current };
        delete next[questionId];
        return next;
      });
    }
    dispatch({
      type: "ANSWER_QUESTION",
      questionId,
      value,
      source: "form",
      confidence: value === "Unknown / validate next" ? 0.35 : 0.9,
    });
  };

  const goToMilestone = (index: number) => {
    const target = milestones[index];
    if (!target) return;
    dispatch({ type: "SET_MILESTONE", milestone: target.id });
    window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
  };

  const effectiveAnswer = (question: DiscoveryQuestion) =>
    (question.fieldType === "short_text" ||
      question.fieldType === "long_text") &&
    Object.hasOwn(textDrafts, question.id)
      ? textDrafts[question.id]
      : answerFor(snapshot, question.id);

  const commitActiveDrafts = () => {
    const drafts = activeQuestions.filter(
      (question) =>
        (question.fieldType === "short_text" ||
          question.fieldType === "long_text") &&
        Object.hasOwn(textDrafts, question.id),
    );
    const unsafe = drafts.find((question) =>
      containsSensitiveDataCue(textDrafts[question.id] ?? ""),
    );
    if (unsafe) {
      setInvalidQuestionId(unsafe.id);
      setContextNotice(
        "Possible personal or confidential identifier detected. It remains only in this unsaved field. Remove it and use categories; screening is best effort, not a DLP guarantee.",
      );
      return false;
    }
    drafts.forEach((question) =>
      setQuestionAnswer(question.id, textDrafts[question.id] ?? ""),
    );
    return true;
  };

  const continueJourney = () => {
    if (!commitActiveDrafts()) return;
    const unresolved = activeQuestions.find(
      (question) =>
        question.required && !hasAnswer(effectiveAnswer(question)),
    );
    if (unresolved) {
      setInvalidQuestionId(unresolved.id);
      setContextNotice(
        unresolved.id === "context.sector"
          ? "Select a sector to load the correct diagnostic module."
          : `Capture “${unresolved.shortLabel}” or mark it for validation before continuing.`,
      );
      window.requestAnimationFrame(() => {
        document
          .querySelector<HTMLElement>(
            `[data-question-id="${unresolved.id}"] button, [data-question-id="${unresolved.id}"] input, [data-question-id="${unresolved.id}"] textarea`,
          )
          ?.focus();
      });
      return;
    }
    setInvalidQuestionId(null);
    setContextNotice("");
    if (activeMilestoneIndex < milestones.length - 1) {
      goToMilestone(activeMilestoneIndex + 1);
    }
  };

  const skipUnknowns = () => {
    if (!commitActiveDrafts()) return;
    const blockingQuestion = activeQuestions.find(
      (question) =>
        question.required &&
        !question.allowUnknown &&
        !hasAnswer(effectiveAnswer(question)),
    );
    if (blockingQuestion) {
      continueJourney();
      return;
    }
    const questionIds = activeQuestions
      .filter(
        (question) =>
          question.allowUnknown &&
          !hasAnswer(effectiveAnswer(question)) &&
          question.id !== "context.sector",
      )
      .map((question) => question.id);
    const nextMilestone = milestones[activeMilestoneIndex + 1];
    if (!nextMilestone) return;
    dispatch({
      type: "MARK_UNKNOWN_AND_ADVANCE",
      questionIds,
      milestone: nextMilestone.id,
    });
    setInvalidQuestionId(null);
    setContextNotice("");
    window.scrollTo({ top: 0, behavior: preferredScrollBehavior() });
  };

  const submitChat = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || pendingChat || isAgentBusy) return;
    if (containsSensitiveDataCue(message.toLocaleLowerCase("en"))) {
      dispatch({
        type: "ADD_MESSAGE",
        role: "agent",
        content:
          "That text may contain personal or confidential data, so it was not saved. Remove identifiers and describe only the workflow category.",
      });
      setChatInput("");
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
    const boundaryIsCurrent = () => {
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
    setAgentDraft("");
    try {
      const patches: ChatPatch[] = [];
      let reply = "";
      for await (const agentEvent of localDiscoveryAgent.streamTurn(
        { message, questions, snapshot },
        controller.signal,
      )) {
        if (!boundaryIsCurrent()) return;
        if (agentEvent.type === "patches") {
          patches.push(...agentEvent.patches);
        } else if (agentEvent.type === "reply_delta") {
          reply += agentEvent.delta;
          setAgentDraft(reply);
        }
      }
      if (!boundaryIsCurrent()) return;
      dispatch({ type: "ADD_MESSAGE", role: "user", content: message });
      dispatch({
        type: "ADD_MESSAGE",
        role: "agent",
        content:
          patches.length > 0
            ? `${reply} Review the proposed fields below before they become evidence.`
            : reply,
      });
      if (patches.length > 0) {
        setPendingChat({ message, answers: patches });
      }
    } catch {
      if (boundaryIsCurrent()) {
        dispatch({
          type: "ADD_MESSAGE",
          role: "agent",
          content:
            "The local agent could not process that turn. Your message was not recorded; use Guided mode or try again.",
        });
      }
    } finally {
      if (agentRequestRef.current === requestId) {
        setIsAgentBusy(false);
        setAgentDraft("");
        setChatInput("");
        agentAbortRef.current = null;
      }
    }
  };

  const confirmPendingChat = () => {
    if (!pendingChat) return;
    dispatch({
      type: "APPLY_CHAT_PROPOSAL",
      answers: pendingChat.answers
        .filter((answer) => answer.kind === "answer")
        .map((answer) => ({
          questionId: answer.questionId,
          value: answer.value,
          confidence: answer.confidence,
        })),
      observations: pendingChat.answers
        .filter((answer) => answer.kind === "observation")
        .map((answer) => ({
          questionId: answer.questionId,
          statement: String(answer.value),
          confidence: answer.confidence,
        })),
    });
    dispatch({
      type: "ADD_MESSAGE",
      role: "agent",
      content: "Confirmed. The proposed update is now recorded as reported evidence.",
    });
    setPendingChat(null);
  };

  const resolvePendingPatch = (index: number, accept: boolean) => {
    if (!pendingChat) return;
    const patch = pendingChat.answers[index];
    if (accept && patch) {
      dispatch({
        type: "APPLY_CHAT_PROPOSAL",
        answers:
          patch.kind === "answer"
            ? [
                {
                  questionId: patch.questionId,
                  value: patch.value,
                  confidence: patch.confidence,
                },
              ]
            : [],
        observations:
          patch.kind === "observation"
            ? [
                {
                  questionId: patch.questionId,
                  statement: String(patch.value),
                  confidence: patch.confidence,
                },
              ]
            : [],
      });
    }
    const remaining = pendingChat.answers.filter(
      (_, answerIndex) => answerIndex !== index,
    );
    if (remaining.length === 0) {
      dispatch({
        type: "ADD_MESSAGE",
        role: "agent",
        content: accept
          ? "Confirmed. The proposed update is now reported evidence."
          : "Not added. You can rephrase it or use Guided mode.",
      });
      setPendingChat(null);
    } else {
      setPendingChat({ ...pendingChat, answers: remaining });
    }
  };

  const rejectPendingChat = () => {
    if (!pendingChat) return;
    dispatch({
      type: "ADD_MESSAGE",
      role: "agent",
      content: "Not added. Rephrase the answer or use Guided mode to select the field.",
    });
    setPendingChat(null);
  };

  const explainCurrentQuestion = () => {
    const current = activeQuestions.find(
      (question) => !hasAnswer(answerFor(snapshot, question.id)),
    );
    dispatch({
      type: "ADD_MESSAGE",
      role: "agent",
      content: current
        ? `${current.shortLabel} helps separate reported evidence from assumptions and determines what must be validated before a solution is proposed.`
        : "This stage establishes the evidence boundary for the diagnosis. You can continue without adding optional detail.",
    });
  };

  const giveCurrentExample = () => {
    const current = activeQuestions.find(
      (question) => !hasAnswer(answerFor(snapshot, question.id)),
    );
    dispatch({
      type: "ADD_MESSAGE",
      role: "agent",
      content: current
        ? `Example for “${current.shortLabel}”: describe the trigger, main owner, system category and completion signal without names, account details or records.`
        : "Example: “A report arrives by email, operations validates it against the source system, and a finance lead approves exceptions.”",
    });
  };

  const markCurrentUnknown = () => {
    const current = activeQuestions.find(
      (question) =>
        question.allowUnknown &&
        question.id !== "context.sector" &&
        !hasAnswer(answerFor(snapshot, question.id)),
    );
    if (!current) {
      dispatch({
        type: "ADD_MESSAGE",
        role: "agent",
        content:
          "There is no unanswered field in this stage that can be marked unknown. Continue or switch to Guided to review the evidence.",
      });
      return;
    }
    setQuestionAnswer(current.id, "Unknown / validate next");
    dispatch({
      type: "ADD_MESSAGE",
      role: "agent",
      content: `${current.shortLabel} is marked for validation. It will remain visible as an unknown, not treated as a fact.`,
    });
  };

  const generateReport = () => {
    setAnalysisStage(0);
    dispatch({ type: "SET_STATUS", status: "analyzing" });
  };

  const resetCase = () => {
    if (!window.confirm("Delete this local diagnostic and start again?")) return;
    agentAbortRef.current?.abort();
    agentRequestRef.current += 1;
    mutationEpochRef.current += 1;
    void localRepositoryRef.current?.clear();
    void sessionRepositoryRef.current?.clear();
    persistedRevisionRef.current = { local: null, session: null };
    setSnapshot(createInitialSnapshot(new Date().toISOString()));
    setMode("guided");
    setShowLeadForm(false);
    setLeadRequestId("");
    setLeadForm({
      workEmail: "",
      organisation: "",
      name: "",
      consent: false,
    });
    setLeadSubmission({ status: "idle", message: "" });
    setFullReport(null);
    setPendingChat(null);
    setPersistLocally(false);
    setInvalidQuestionId(null);
    setAgentDraft("");
    setIsAgentBusy(false);
    setTextDrafts({});
    setContextNotice("Local diagnostic deleted.");
  };

  const loadExample = () => {
    setTextDrafts({});
    const exampleAnswers: Array<[string, DiscoveryValue]> = [
      ["context.organisationType", "financial-institution"],
      ["context.sizeBand", "101-500"],
      ["context.sector", "finance"],
      ["context.role", "operations"],
      ["context.focusArea", "Monthly management reporting"],
      [
        "workflow.scope",
        "The workflow starts when seven source reports arrive by email and portal. It ends when the finance lead signs off the management pack.",
      ],
      ["workflow.inputs", ["email", "pdf", "spreadsheet", "erp"]],
      [
        "workflow.handoffs",
        "An operations analyst collects inputs, a controller resolves differences and the finance lead approves the final pack.",
      ],
      [
        "friction.repetition",
        "Analysts rename files, copy figures into a shared spreadsheet and compare totals with the previous month.",
      ],
      [
        "friction.exceptions",
        "Missing inputs and mapping differences are investigated in email, with no shared exception queue.",
      ],
      ["friction.impact", ["time", "compliance", "decision", "quality"]],
      [
        "readiness.systems",
        "Microsoft 365, shared drive, ERP exports, a bank portal and Power BI.",
      ],
      ["readiness.constraints", ["audit", "access", "human-approval", "retention"]],
      [
        "goal.outcome",
        "Trace every reported number to source, surface exceptions early and reduce manual preparation time.",
      ],
      ["goal.horizon", "quarter"],
      ["goal.investmentPosture", "pilot-budget-approved"],
    ];
    exampleAnswers.forEach(([questionId, value]) =>
      dispatch({
        type: "ANSWER_QUESTION",
        questionId,
        value,
        source: "form",
        confidence: 0.9,
      }),
    );
    dispatch({ type: "SET_MILESTONE", milestone: "review" });
    setContextNotice("Example evidence loaded. Review it or generate the preview.");
  };

  const openLeadForm = () => {
    if (!leadRequestId) setLeadRequestId(window.crypto.randomUUID());
    setLeadSubmission({ status: "idle", message: "" });
    setShowLeadForm(true);
  };

  const submitLead = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (leadSubmission.status === "submitting") return;
    const requestId = leadRequestId || window.crypto.randomUUID();
    if (!leadRequestId) setLeadRequestId(requestId);
    const submittedSnapshot = snapshotRef.current;
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
      if (
        !response.ok ||
        !result.ok ||
        result.caseId !== submittedSnapshot.caseId ||
        result.requestId !== requestId
      ) {
        const message =
          !result.ok
            ? result.error.message
            : "The server confirmation did not match this diagnostic.";
        setLeadSubmission({ status: "error", message });
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
        message:
          result.persistence === "ephemeral"
            ? "Confirmed by the local development handoff. It is not stored outside this running server."
            : "Request confirmed and stored securely for follow-up.",
      });
      setShowLeadForm(false);
    } catch (error) {
      if (controller.signal.aborted) return;
      setLeadSubmission({
        status: "error",
        message:
          error instanceof Error
            ? "The request could not be confirmed. Your details remain in this form so you can retry."
            : "The request could not be confirmed. Please retry.",
      });
    } finally {
      if (leadAbortRef.current === controller) {
        leadAbortRef.current = null;
      }
    }
  };

  if (!hydrated) {
    return (
      <main className="dc-loading" aria-live="polite">
        <BlockLoader />
        <span>Initialising diagnostic workspace</span>
      </main>
    );
  }

  return (
    <main
      className={`dc-shell dc-shell--${mode} ${
        snapshot.status === "preview_ready" || snapshot.status === "lead_submitted"
          ? "dc-shell--report"
          : ""
      }`}
    >
      <header className="dc-topbar">
        <BrandLogo priority />
        <div className="dc-case-meta">
          <span>Signal / {shortCaseId(snapshot.caseId)}</span>
          <span>
            <i className="status-dot" aria-hidden="true" />
            {snapshot.profile.sector
              ? `${snapshot.profile.sector} module loaded`
              : "Awaiting sector"}
          </span>
        </div>
        <div className="dc-top-actions">
          <button type="button" onClick={loadExample}>
            Load example
          </button>
          <button type="button" onClick={resetCase}>
            Reset case
          </button>
        </div>
      </header>

      {snapshot.status === "analyzing" ? (
        <section className="dc-analysis" aria-live="polite">
          <div className="dc-analysis-grid" aria-hidden="true" />
          <BlockLoader size="large" />
          <p className="dc-kicker">Signal / Evidence processing</p>
          <h1>Building the diagnostic.</h1>
          <ol>
            {analysisStages.map((stage, index) => (
              <li
                className={
                  index < analysisStage
                    ? "is-complete"
                    : index === analysisStage
                      ? "is-active"
                      : ""
                }
                key={stage}
              >
                <span>{index + 1}</span>
                <strong>{stage}</strong>
                <small>
                  {index < analysisStage
                    ? "Complete"
                    : index === analysisStage
                      ? "In progress"
                      : "Queued"}
                </small>
              </li>
            ))}
          </ol>
          <p>
            No external systems are being contacted in this prototype. The
            preview is assembled deterministically from your answers.
          </p>
        </section>
      ) : snapshot.status === "preview_ready" ||
        snapshot.status === "lead_submitted" ? (
        <section className="dc-report-view" aria-labelledby="report-title">
          <div className="dc-report-toolbar">
            <div>
              <span>Your first two pages are ready</span>
              <strong>Review the diagnosis before deciding what to share.</strong>
            </div>
            <div>
              <button
                type="button"
                onClick={() => createBrowserPrintExporter(window).exportPreview()}
              >
                Export {fullReport ? "full report" : "preview"} PDF
                <BlockArrow />
              </button>
              <button
                type="button"
                onClick={() => dispatch({ type: "SET_MILESTONE", milestone: "review" })}
              >
                Edit evidence
              </button>
            </div>
          </div>

          <div className="dc-report-pages" id="report-preview">
            <article className="dc-report-page dc-report-cover" aria-label="Report page 1">
              <div className="dc-report-grid" aria-hidden="true" />
              <header>
                <span>NNCO / Signal</span>
                <span>{report.classification}</span>
              </header>
              <div className="dc-cover-mark" aria-hidden="true">
                <span />
              </div>
              <div className="dc-cover-title">
                <p>{report.pages[0].eyebrow}</p>
                <h1 id="report-title">{report.title}</h1>
              </div>
              <dl className="dc-cover-meta">
                <div>
                  <dt>Case</dt>
                  <dd>{report.caseId}</dd>
                </div>
                <div>
                  <dt>Sector</dt>
                  <dd>{report.scope.sector}</dd>
                </div>
                <div>
                  <dt>Generated</dt>
                  <dd>{formatDate(report.generatedAt)}</dd>
                </div>
              </dl>
              <footer>
                <span>Operational intelligence diagnostic</span>
                <span>Page 1 of 2</span>
              </footer>
            </article>

            <article className="dc-report-page dc-report-body" aria-label="Report page 2">
              <header>
                <span>{report.pages[1].eyebrow}</span>
                <span>{report.caseId}</span>
              </header>
              <div className="dc-report-section-title">
                <p>Executive snapshot / unverified</p>
                <h2>{report.pages[1].title}</h2>
              </div>
              <section className="dc-report-summary">
                <span>Situation</span>
                <p>{report.summary}</p>
              </section>
              <section className="dc-priority-matrix">
                <div className="dc-matrix-plot">
                  <span className="dc-axis dc-axis-y">Impact</span>
                  <span className="dc-axis dc-axis-x">Feasibility</span>
                  {report.matrix.map((point, index) => (
                    <i
                      key={point.problemId}
                      style={{
                        left: `${
                          12 +
                          (point.feasibility / 5) * 72 +
                          (index - 1) * 9
                        }%`,
                        bottom: `${
                          12 +
                          (point.impact / 5) * 72 +
                          (index % 2 === 0 ? 5 : -5)
                        }%`,
                      }}
                    >
                      {index + 1}
                    </i>
                  ))}
                </div>
                <div className="dc-readiness-card">
                  <span>Readiness</span>
                  <strong>{report.readiness.band}</strong>
                  <small>{percent(report.readiness.confidence)} confidence</small>
                  <p>{report.readiness.statement}</p>
                </div>
              </section>
              <ol className="dc-problem-list">
                {report.problems.map((problem) => (
                  <li key={problem.id}>
                    <span>{problem.priority}</span>
                    <div>
                      <strong>{problem.title}</strong>
                      <p>{problem.finding}</p>
                    </div>
                    <small>
                      {problem.impact} impact
                      <br />
                      {percent(problem.confidence)} confidence
                    </small>
                  </li>
                ))}
              </ol>
              <footer>
                <span>
                  {report.classification} / {report.caseId}
                </span>
                <span>Page 2 of 2</span>
              </footer>
            </article>
          </div>

          <div className="dc-locked-report">
            <div className="dc-locked-intro">
              <span>Pages 3-6 / Full diagnostic</span>
              <h2>The evidence behind the next decision.</h2>
              <p>
                The complete report adds solution variants for each priority,
                required data and integrations, risk, timing, indicative
                commercial logic and a 90-day delivery path.
              </p>
              {snapshot.leadRequestStatus === "confirmed" && fullReport ? (
                <div className="dc-success" role="status">
                  <strong>Full diagnostic unlocked.</strong>
                  <p>
                    {leadSubmission.message ||
                      "The request was confirmed by the server for this case."}
                  </p>
                </div>
              ) : (
                <button
                  ref={leadTriggerRef}
                  className="dc-primary-action"
                  type="button"
                  onClick={openLeadForm}
                >
                  Request and unlock the full report <BlockArrow />
                </button>
              )}
              <a href="mailto:hello@nnc.ai">
                Review it with an expert <BlockArrow />
              </a>
            </div>
            <div className="dc-locked-stack" aria-label="Locked report sections">
              {report.lockedSections.map((section, index) => (
                <article key={section}>
                  <span>{index + 3}</span>
                  <strong>{section}</strong>
                  <small>Available after unlock</small>
                </article>
              ))}
            </div>
          </div>

          {fullReport ? (
            <div className="dc-full-report-pages" aria-label="Unlocked full report">
              {report.problems.map((problem, problemIndex) => {
                const options = fullReport.solutionOptions.filter(
                  (option) => option.problemId === problem.id,
                );
                return (
                  <article
                    className="dc-report-page dc-report-body dc-full-report-page"
                    aria-label={`Report page ${problemIndex + 3}`}
                    key={problem.id}
                  >
                    <header>
                      <span>Signal / Solution field</span>
                      <span>{report.caseId}</span>
                    </header>
                    <div className="dc-report-section-title">
                      <p>{problem.priority} / validated next</p>
                      <h2>{problem.title}</h2>
                    </div>
                    <section className="dc-full-finding">
                      <span>Diagnostic finding</span>
                      <p>{problem.finding}</p>
                    </section>
                    <div className="dc-solution-list">
                      {options.map((option) => (
                        <section key={option.id}>
                          <header>
                            <span>{solutionKindLabel(option.kind)}</span>
                            <span>{option.effort} effort</span>
                          </header>
                          <h3>{option.title}</h3>
                          <p>{option.principle}</p>
                          <dl>
                            <div>
                              <dt>Expected benefit</dt>
                              <dd>{option.expectedBenefit}</dd>
                            </div>
                            <div>
                              <dt>Data and integrations</dt>
                              <dd>{option.dataAndIntegrations.join(", ")}</dd>
                            </div>
                            <div>
                              <dt>Timing</dt>
                              <dd>
                                {option.timingWeeks.min} to {option.timingWeeks.max} weeks
                              </dd>
                            </div>
                            <div>
                              <dt>Indicative range</dt>
                              <dd>
                                {option.indicativeRanges.map(formatRange).join(" + ")}
                              </dd>
                            </div>
                          </dl>
                          <small>
                            Risks: {option.risks.join(" ")} Confidence:{" "}
                            {percent(option.confidence)}.
                          </small>
                        </section>
                      ))}
                    </div>
                    <footer>
                      <span>{report.classification}</span>
                      <span>Page {problemIndex + 3} of 6</span>
                    </footer>
                  </article>
                );
              })}

              <article
                className="dc-report-page dc-report-body dc-full-report-page"
                aria-label="Report page 6"
              >
                <header>
                  <span>Signal / Delivery path</span>
                  <span>{report.caseId}</span>
                </header>
                <div className="dc-report-section-title">
                  <p>Commercial logic / indicative</p>
                  <h2>Move from evidence to a controlled first intervention.</h2>
                </div>
                <section className="dc-full-finding">
                  <span>Investment posture</span>
                  <p>
                    {fullReport.investmentPosture.label}
                    {fullReport.investmentPosture.isAssumption
                      ? " This remains an assumption to validate."
                      : ""}
                  </p>
                </section>
                <section className="dc-full-finding">
                  <span>Recommended delivery model</span>
                  <p>{fullReport.deliveryModel}</p>
                </section>
                <div className="dc-roadmap">
                  {fullReport.roadmap.map((step) => (
                    <section key={step.window}>
                      <span>{step.window}</span>
                      <h3>{step.objective}</h3>
                      <p>{step.output}</p>
                    </section>
                  ))}
                </div>
                <section className="dc-full-next-step">
                  <span>Recommended next step</span>
                  <p>{fullReport.recommendedNextStep}</p>
                </section>
                <footer>
                  <span>{report.classification}</span>
                  <span>Page 6 of 6</span>
                </footer>
              </article>
            </div>
          ) : null}

          <p className="dc-report-disclaimer">{report.disclaimer}</p>
        </section>
      ) : (
        <>
          <nav className="dc-milestones" aria-label="Diagnostic milestones">
            {milestones.map((milestone, index) => {
              const isActive = milestone.id === snapshot.activeMilestone;
              const isComplete = completedMilestones.has(milestone.id);
              return (
                <button
                  className={`${isActive ? "is-active" : ""} ${
                    isComplete ? "is-complete" : ""
                  }`}
                  type="button"
                  key={milestone.id}
                  aria-current={isActive ? "step" : undefined}
                  onClick={() => goToMilestone(index)}
                >
                  <span>{index + 1}</span>
                  <strong>{milestone.label}</strong>
                  <small>
                    {isComplete ? "Captured" : milestone.description}
                  </small>
                </button>
              );
            })}
          </nav>

          <section className="dc-statusbar" aria-live="polite">
            <span>
              {coverage.completedMilestones} / {coverage.totalMilestones} milestones
              complete
            </span>
            <span
              className="dc-coverage"
              role="progressbar"
              aria-label="Core diagnostic signals captured"
              aria-valuemin={0}
              aria-valuemax={coverage.total}
              aria-valuenow={coverage.answered}
              aria-valuetext={`${coverage.knownCoreSignals} known, ${coverage.validationSignals} marked for validation`}
            >
              <i style={{ width: `${coverage.percentage}%` }} />
            </span>
            <span>
              {coverage.knownCoreSignals} known / {coverage.validationSignals} validate
              next / about {coverage.estimatedMinutesRemaining} min
            </span>
            <button
              className="dc-storage-toggle"
              type="button"
              aria-pressed={persistLocally}
              onClick={() => setPersistLocally((enabled) => !enabled)}
            >
              {persistLocally
                ? isMobile
                  ? "Saved for 24h"
                  : "Saved on this device / expires in 24h"
                : isMobile
                  ? "Enable 24h save"
                  : "Session only / enable 24h save"}
            </button>
            <button
              className="dc-mobile-reset"
              type="button"
              onClick={resetCase}
            >
              Reset case
            </button>
          </section>

          <section className="dc-main">
            <div className="dc-workspace">
              <header className="dc-workspace-header">
                <div>
                  <p className="dc-kicker">
                    {milestones[activeMilestoneIndex]?.label}
                  </p>
                  <h1>
                    {snapshot.activeMilestone === "context"
                      ? "Choose the right operational context."
                      : snapshot.activeMilestone === "workflow"
                        ? "Map the work as it runs today."
                        : snapshot.activeMilestone === "friction"
                          ? "Locate where the signal is lost."
                          : snapshot.activeMilestone === "readiness"
                            ? "Test the conditions for intervention."
                            : "Confirm the evidence before analysis."}
                  </h1>
                </div>
                <div className="dc-mode-switch" aria-label="Experience mode">
                  <button
                    className={mode === "guided" ? "is-active" : ""}
                    type="button"
                    aria-pressed={mode === "guided"}
                    onClick={() => setMode("guided")}
                  >
                    Guided
                  </button>
                  <button
                    className={mode === "interview" ? "is-active" : ""}
                    type="button"
                    aria-pressed={mode === "interview"}
                    onClick={() => setMode("interview")}
                  >
                    Interview
                  </button>
                </div>
              </header>

              {contextNotice ? (
                <p className="dc-notice" id="discovery-notice" role="alert">
                  {contextNotice}
                </p>
              ) : null}

              {snapshot.activeMilestone === "review" ? (
                <div className="dc-review">
                  <div className="dc-review-summary">
                    <span>What we understand</span>
                    <h2>
                      {snapshot.profile.focusArea || "Workflow requires a clearer scope"}
                    </h2>
                    <p>
                      {report.summary} Review anything that feels overstated.
                      Unknowns remain visible as validation work.
                    </p>
                    <dl>
                      <div>
                        <dt>Sector</dt>
                        <dd>{snapshot.profile.sector || "Not set"}</dd>
                      </div>
                      <div>
                        <dt>Evidence</dt>
                        <dd>{snapshot.evidence.length} reported signals</dd>
                      </div>
                      <div>
                        <dt>Readiness</dt>
                        <dd>{report.readiness.band}</dd>
                      </div>
                      <div>
                        <dt>Preview</dt>
                        <dd>{coverage.readyForPreview ? "Ready" : "Evidence needed"}</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="dc-evidence-ledger">
                    <header>
                      <span>Evidence ledger</span>
                      <span>Reported / not verified</span>
                    </header>
                    {snapshot.evidence.length ? (
                      snapshot.evidence.map((evidence) => (
                        <article key={evidence.id}>
                          <span>{evidence.label}</span>
                          <p>{evidence.statement}</p>
                          <small>{percent(evidence.confidence)} confidence</small>
                        </article>
                      ))
                    ) : (
                      <p>No evidence captured yet. Return to Context to begin.</p>
                    )}
                  </div>
                  <button
                    className="dc-primary-action"
                    type="button"
                    disabled={!coverage.readyForPreview}
                    onClick={generateReport}
                  >
                    Generate diagnostic preview <BlockArrow />
                  </button>
                  {!coverage.readyForPreview ? (
                    <p className="dc-readiness-note">
                      Add the workflow boundary, repeated work, exception path and
                      desired outcome to generate a responsible preview.
                    </p>
                  ) : null}
                  <p className="dc-privacy-line">
                    The preview is generated locally from reported answers. No
                    account or email is required.
                  </p>
                </div>
              ) : mode === "interview" ? (
                <div className="dc-interview-board">
                  <div>
                    <span>Conversation mode / same diagnostic</span>
                    <h2>Explain it in your own words.</h2>
                    <p>
                      The agent converts the conversation into proposed evidence.
                      You can switch back to Guided at any time without losing an
                      answer.
                    </p>
                  </div>
                  <div className="dc-evidence-cards">
                    <span>What I understand / {evidenceForMilestone.length}</span>
                    {evidenceForMilestone.length ? (
                      evidenceForMilestone.map((evidence) => (
                        <article key={evidence.id}>
                          <small>{evidence.label}</small>
                          <p>{evidence.statement}</p>
                          <span>Reported · {percent(evidence.confidence)}</span>
                        </article>
                      ))
                    ) : (
                      <article>
                        <small>Awaiting evidence</small>
                        <p>
                          Use the agent panel to describe this stage. Approximate
                          language is enough.
                        </p>
                        <span>Unconfirmed</span>
                      </article>
                    )}
                  </div>
                </div>
              ) : (
                <div className="dc-question-list">
                  {activeQuestions.map((question) => (
                    <article
                      className="dc-question"
                      data-question-id={question.id}
                      key={question.id}
                    >
                      <header>
                        <span>
                          {question.shortLabel}
                        </span>
                        <span>
                          {question.required ? "Core signal" : "Optional"}
                        </span>
                      </header>
                      <h2>{question.prompt}</h2>
                      {question.help ? <p>{question.help}</p> : null}
                      <QuestionField
                        question={question}
                        value={answerFor(snapshot, question.id)}
                        draftValue={
                          Object.hasOwn(textDrafts, question.id)
                            ? textDrafts[question.id]
                            : undefined
                        }
                        onDraft={(value) =>
                          setTextDrafts((current) => ({
                            ...current,
                            [question.id]: value,
                          }))
                        }
                        onCommitDraft={(value) =>
                          setQuestionAnswer(question.id, value)
                        }
                        invalid={invalidQuestionId === question.id}
                        onAnswer={(value) => setQuestionAnswer(question.id, value)}
                      />
                      {question.allowUnknown ? (
                        <button
                          className={`dc-unknown${
                            isUnknownValue(answerFor(snapshot, question.id))
                              ? " is-selected"
                              : ""
                          }`}
                          type="button"
                          aria-pressed={isUnknownValue(
                            answerFor(snapshot, question.id),
                          )}
                          onClick={() =>
                            setQuestionAnswer(
                              question.id,
                              "Unknown / validate next",
                            )
                          }
                        >
                          I don’t know - mark for validation
                        </button>
                      ) : null}
                    </article>
                  ))}
                </div>
              )}

              {snapshot.activeMilestone !== "review" ? (
                <footer className="dc-navigation">
                  <button
                    type="button"
                    disabled={activeMilestoneIndex === 0}
                    onClick={() => goToMilestone(activeMilestoneIndex - 1)}
                  >
                    <BlockArrow direction="left" /> Previous
                  </button>
                  <button type="button" onClick={skipUnknowns}>
                    Skip unknowns
                  </button>
                  <button
                    className="dc-primary-action"
                    type="button"
                    onClick={continueJourney}
                  >
                    Continue <BlockArrow />
                  </button>
                </footer>
              ) : null}
            </div>

            {!isMobile || showMobileAgent ? (
              <aside
                id="discovery-agent"
                ref={mobileAgentDialogRef}
                className={`dc-agent ${showMobileAgent ? "is-open" : ""}`}
                role={isMobile ? "dialog" : "complementary"}
                aria-modal={isMobile ? "true" : undefined}
                aria-labelledby="discovery-agent-title"
              >
              <header>
                <div>
                  <span className="status-dot" aria-hidden="true" />
                  <strong id="discovery-agent-title">Discovery agent</strong>
                </div>
                <span>Context aware / local prototype</span>
                {isMobile ? (
                  <button
                    className="dc-agent-close"
                    type="button"
                    onClick={() => {
                      setShowMobileAgent(false);
                      mobileAgentToggleRef.current?.focus();
                    }}
                  >
                    Close
                  </button>
                ) : null}
              </header>
              <div className="dc-agent-safety">
                Use categories, not personal, patient, customer or account data.
                Screening is best effort, not a DLP guarantee.
              </div>
              <div className="dc-chat-log" aria-live="polite">
                {snapshot.messages.map((message) => (
                  <article
                    className={`dc-chat-message dc-chat-message--${message.role}`}
                    key={message.id}
                  >
                    <span>{message.role === "agent" ? "Agent" : "You"}</span>
                    <p>{message.content}</p>
                  </article>
                ))}
                {agentDraft ? (
                  <article className="dc-chat-message dc-chat-message--agent">
                    <span>Agent / processing</span>
                    <p>{agentDraft}</p>
                  </article>
                ) : null}
                <div ref={chatEndRef} />
              </div>
              <div className="dc-agent-prompts">
                <button
                  type="button"
                  onClick={explainCurrentQuestion}
                >
                  Why this matters
                </button>
                <button
                  type="button"
                  onClick={giveCurrentExample}
                >
                  Give me an example
                </button>
                <button
                  type="button"
                  onClick={markCurrentUnknown}
                >
                  Mark unknown
                </button>
              </div>
              <form className="dc-chat-form" onSubmit={submitChat}>
                <label htmlFor="agent-message">Prefer to explain it?</label>
                <textarea
                  id="agent-message"
                  ref={mobileAgentRef}
                  rows={3}
                  maxLength={1_200}
                  value={chatInput}
                  disabled={Boolean(pendingChat) || isAgentBusy}
                  placeholder="Describe what happens in your own words…"
                  onChange={(event) => setChatInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      event.currentTarget.form?.requestSubmit();
                    }
                  }}
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || Boolean(pendingChat) || isAgentBusy}
                >
                  {isAgentBusy ? "Thinking…" : "Send"}{" "}
                  <BlockArrow />
                </button>
              </form>
              {pendingChat ? (
                <div className="dc-chat-confirm" role="status">
                  <span>Proposed evidence</span>
                  {pendingChat.answers.map((answer, index) => {
                    const question = questions.find(
                      (item) => item.id === answer.questionId,
                    );
                    return (
                      <div
                        className="dc-chat-proposal"
                        key={`${answer.kind}-${answer.questionId}-${index}`}
                      >
                        <p>
                          <strong>
                            {question?.shortLabel ?? answer.questionId}
                            {answer.kind === "observation"
                              ? " / additional context"
                              : ""}
                            :
                          </strong>{" "}
                          {formatPatchValue(question, answer.value)}
                        </p>
                        <small>From: “{answer.sourceExcerpt}”</small>
                        <div>
                          <button
                            type="button"
                            onClick={() => resolvePendingPatch(index, false)}
                          >
                            Reject
                          </button>
                          <button
                            type="button"
                            onClick={() => resolvePendingPatch(index, true)}
                          >
                            Accept
                          </button>
                        </div>
                      </div>
                    );
                  })}
                  <div>
                    <button type="button" onClick={rejectPendingChat}>
                      Reject all
                    </button>
                    <button type="button" onClick={confirmPendingChat}>
                      Accept all
                    </button>
                  </div>
                </div>
              ) : null}
              </aside>
            ) : null}
          </section>
        </>
      )}

      {snapshot.status !== "analyzing" &&
      snapshot.status !== "preview_ready" &&
      snapshot.status !== "lead_submitted" ? (
        <button
          ref={mobileAgentToggleRef}
          className="dc-mobile-agent-toggle"
          type="button"
          aria-expanded={showMobileAgent}
          aria-controls="discovery-agent"
          onClick={() => setShowMobileAgent((open) => !open)}
        >
          {showMobileAgent ? "Close agent" : "Talk to agent"}
        </button>
      ) : null}

      {showLeadForm ? (
        <div className="dc-modal-backdrop" role="presentation">
          <section
            ref={leadDialogRef}
            className="dc-lead-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="lead-title"
          >
            <button
              ref={leadCloseRef}
              className="dc-modal-close"
              type="button"
              aria-label="Close"
              onClick={() => {
                setShowLeadForm(false);
                leadTriggerRef.current?.focus();
              }}
            >
              ×
            </button>
            <span>Full diagnostic / secure handoff</span>
            <h2 id="lead-title">Unlock the complete diagnostic.</h2>
            <p>
              Submit a work contact and explicit consent. The server will verify
              this case before it unlocks the personalised solution and
              commercial pages.
            </p>
            <form onSubmit={submitLead}>
              <label>
                Work email
                <input
                  type="email"
                  autoComplete="email"
                  required
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
                  autoComplete="organization"
                  required
                  minLength={2}
                  maxLength={160}
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
                Name <span>Optional</span>
                <input
                  type="text"
                  autoComplete="name"
                  maxLength={120}
                  value={leadForm.name}
                  onChange={(event) =>
                    setLeadForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="dc-consent">
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
                  prepare the full report and contact me about the result.
                </span>
              </label>
              {leadSubmission.status === "error" ? (
                <p className="dc-lead-error" role="alert">
                  {leadSubmission.message}
                </p>
              ) : null}
              <button
                className="dc-primary-action"
                type="submit"
                disabled={leadSubmission.status === "submitting"}
              >
                {leadSubmission.status === "submitting" ? (
                  "Confirming request…"
                ) : (
                  <>
                    Confirm and unlock report <BlockArrow />
                  </>
                )}
              </button>
              <small>
                Local development stores this request only in the running server
                process. Vercel production requires the server-side Supabase
                handoff and never exposes its service key to the browser.
              </small>
            </form>
          </section>
        </div>
      ) : null}
    </main>
  );
}
