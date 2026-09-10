import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { DiscoveryBlockArrow as BlockArrow } from "./discovery/DiscoveryBlockArrow";
import { DiscoveryBlockLoader as BlockLoader } from "./discovery/DiscoveryBlockLoader";
import { AutoExpandingTextarea } from "./discovery/AutoExpandingTextarea";
import { PRIMARY_LOGO } from "@/lib/brand-assets";
import { discoveryIntro, discoveryCopy, discoveryReportCopy } from "@/data/discovery";
import { emptyDiscoveryAnswers, prefillDiscoveryAnswers, discoveryWorkflowOptions, answersAfterSectorChange } from "@/lib/discovery-questionnaire";
import { discoveryProgress, type DiscoveryScreen } from "@/lib/discovery-progress";
import {
  DISCOVERY_RELEASE_CONSENT_VERSION,
  DISCOVERY_RELEASE_LIMITS,
  RELEASE_CONTROL_CHOICES,
  RELEASE_SCALE_CHOICES,
  RELEASE_SYSTEM_CHOICES,
  frictionChoicesFor,
  hasMultiAnswer,
  normalizeWebsiteInput,
  type DiscoveryResearch,
  type DiscoverySubmission,
  type MultiAnswerId,
  type DiscoveryEnrichmentResponse,
  type DiscoveryReleaseResponse,
  type ReleaseAnswers,
  type ReleaseChoice,
  type ReleaseSector,
} from "@/lib/discovery-release";
import {
  CONTACT_EMAIL_PATTERN_SOURCE,
  isValidContactEmail,
} from "@/lib/contact-contract";
import {
  resolveRequestIdentity,
  type RequestIdentity,
} from "@/lib/request-identity";

type QuestionKind = "single" | "multi";

interface ReleaseQuestion {
  id: Exclude<keyof ReleaseAnswers, "context">;
  label: string;
  prompt: string;
  help: string;
  kind: QuestionKind;
  maximum?: number;
  choices: ReleaseChoice[];
}

const WEBSITE_STEPS = ["Website", "Workflow", "Friction", "Frequency", "Systems", "Controls"] as const;
const MANUAL_STEPS = ["Sector", "Workflow", "Friction", "Frequency", "Systems", "Controls"] as const;

const SECTOR_CHOICES: ReleaseChoice[] = [
  { value: "banking", label: "Banking" },
  { value: "insurance", label: "Insurance" },
  { value: "healthcare", label: "Healthcare" },
  { value: "capital-markets", label: "Capital Markets" },
  { value: "other", label: "Another sector" },
];

function rovingTabIndex(
  isSelected: boolean,
  hasSelection: boolean,
  index: number,
): 0 | -1 {
  if (hasSelection) return isSelected ? 0 : -1;
  return index === 0 ? 0 : -1;
}

export function DiscoveryRelease({ introGlyph }: { introGlyph: ReactNode }) {
  const [screen, setScreen] = useState<DiscoveryScreen>("intro");
  const [website, setWebsite] = useState("");
  const [intakeMode, setIntakeMode] = useState<"website" | "manual">("website");
  const [manualSector, setManualSector] = useState<ReleaseSector | "">("");
  const [research, setResearch] = useState<DiscoveryResearch | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<ReleaseAnswers>(emptyDiscoveryAnswers);
  const [entryError, setEntryError] = useState("");
  const [contact, setContact] = useState({ workEmail: "" });
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [analysisError, setAnalysisError] = useState("");
  const reviewedAnswersRef = useRef(new Set<keyof ReleaseAnswers>());
  const researchedWebsiteRef = useRef("");
  const confirmedSectorRef = useRef<ReleaseSector | "">("");
  const companyName = research?.company.name ?? "Your organisation";
  const requestIdentityRef = useRef<RequestIdentity | null>(null);
  const submittingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const transitionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (screen === "report") return;
    const frame = window.requestAnimationFrame(() => {
      if (screen === "enriching" || screen === "analyzing") {
        transitionRef.current?.focus({ preventScroll: true });
      } else {
        headingRef.current?.focus({ preventScroll: true });
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [screen, questionIndex]);

  const questions = useMemo<ReleaseQuestion[]>(() => {
    if (!manualSector) return [];
    return [
      {
        id: "workflow",
        label: "Workflow",
        prompt: discoveryCopy.questions.workflow.title,
        help: discoveryCopy.questions.workflow.help,
        kind: "multi",
        maximum: 2,
        choices: discoveryWorkflowOptions(research, manualSector),
      },
      {
        id: "friction",
        label: "Friction",
        prompt: discoveryCopy.questions.friction.title,
        help: discoveryCopy.questions.friction.help,
        kind: "multi",
        maximum: 2,
        choices: frictionChoicesFor(manualSector),
      },
      {
        id: "scale",
        label: "Frequency",
        prompt: discoveryCopy.questions.scale.title,
        help: discoveryCopy.questions.scale.help,
        kind: "single",
        choices: RELEASE_SCALE_CHOICES,
      },
      {
        id: "systems",
        label: "Systems",
        prompt: discoveryCopy.questions.systems.title,
        help: discoveryCopy.questions.systems.help,
        kind: "multi",
        choices: RELEASE_SYSTEM_CHOICES,
      },
      {
        id: "controls",
        label: "Controls",
        prompt: discoveryCopy.questions.controls.title,
        help: discoveryCopy.questions.controls.help,
        kind: "multi",
        choices: RELEASE_CONTROL_CHOICES,
      },
    ];
  }, [research, manualSector]);

  const activeQuestion = questions[questionIndex];
  const questionComplete = activeQuestion
    ? activeQuestion.kind === "multi" ? hasMultiAnswer(answers, activeQuestion.id as MultiAnswerId) : Boolean(answers.scale)
    : false;

  const enrichWebsite = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!website.trim()) {
      setEntryError("Enter a public company website.");
      return;
    }
    setEntryError("");
    setDirection("forward");
    setScreen("enriching");
    try {
      const response = await fetch("/api/discovery-enrichment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ website }),
      });
      const result = (await response.json()) as DiscoveryEnrichmentResponse;
      if (!response.ok || !result.ok) {
        setEntryError(result.ok ? "We could not read that website." : result.error.message);
        setScreen("entry");
        return;
      }
      const origin = normalizeWebsiteInput(website)?.origin.replace("://www.", "://") ?? website;
      const sameWebsite = origin === researchedWebsiteRef.current;
      if (!sameWebsite) reviewedAnswersRef.current.clear();
      const sector = sameWebsite && confirmedSectorRef.current ? confirmedSectorRef.current : result.company.sector;
      const reviewed = new Set(reviewedAnswersRef.current);
      setResearch(result);
      setManualSector(sector);
      confirmedSectorRef.current = sector;
      researchedWebsiteRef.current = origin;
      setIntakeMode("website");
      setAnswers(current => prefillDiscoveryAnswers(result, sameWebsite ? current : emptyDiscoveryAnswers(), reviewed, sector));
      setQuestionIndex(0);
      setDirection("forward");
      setScreen("context");
    } catch {
      setEntryError("We could not read that website. Check the address and retry.");
      setScreen("entry");
    }
  };

  const skipWebsite = () => {
    setEntryError("");
    if (intakeMode === "manual") {
      setDirection("forward");
      setScreen("sector");
      return;
    }
    setResearch(null);
    reviewedAnswersRef.current.clear();
    researchedWebsiteRef.current = "";
    confirmedSectorRef.current = "";
    setIntakeMode("manual");
    setManualSector("");
    setAnswers(emptyDiscoveryAnswers());
    setQuestionIndex(0);
    setDirection("forward");
    setScreen("sector");
  };

  const confirmManualSector = () => {
    if (!manualSector) return;
    if (confirmedSectorRef.current && confirmedSectorRef.current !== manualSector) {
      setAnswers(current => answersAfterSectorChange(current, manualSector));
    }
    confirmedSectorRef.current = manualSector;
    setQuestionIndex(0);
    setDirection("forward");
    setScreen("questions");
  };

  const selectChoice = (question: ReleaseQuestion, value: string) => {
    reviewedAnswersRef.current.add(question.id);
    if (question.kind === "single") {
      setAnswers((current) => ({ ...current, [question.id]: value }));
      return;
    }
    setAnswers((current) => {
      const currentValues = current[question.id];
      if (!Array.isArray(currentValues)) return current;
      const selected = currentValues.includes(value);
      const next = selected
        ? currentValues.filter((entry) => entry !== value)
        : [...currentValues, value].slice(0, question.maximum ?? 8);
      return { ...current, [question.id]: next };
    });
  };

  const nextQuestion = () => {
    if (!questionComplete) return;
    if (activeQuestion) reviewedAnswersRef.current.add(activeQuestion.id);
    if (questionIndex >= questions.length - 1) {
      setDirection("forward");
      setScreen("contact");
      return;
    }
    setDirection("forward");
    setQuestionIndex((current) => current + 1);
  };

  const previousQuestion = () => {
    setDirection("back");
    if (questionIndex === 0) {
      setScreen("sector");
      return;
    }
    setQuestionIndex((current) => Math.max(0, current - 1));
  };

  const submitDiagnostic = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manualSector || submittingRef.current) return;
    if (!isValidContactEmail(contact.workEmail)) {
      setAnalysisError("Enter a valid work email before continuing.");
      return;
    }
    const unsignedPayload: Omit<DiscoverySubmission, "requestId"> = {
      contextToken: research?.contextToken ?? null,
      sector: manualSector,
      answers,
      workEmail: contact.workEmail.trim(),
      personalResponseRequested: true,
      includeCompetitors: false,
      consent: {
        accepted: true,
        version: DISCOVERY_RELEASE_CONSENT_VERSION,
      },
    };
    const signature = JSON.stringify(unsignedPayload);
    const identity = resolveRequestIdentity(
      requestIdentityRef.current,
      signature,
      () => window.crypto.randomUUID(),
    );
    requestIdentityRef.current = identity;
    const payload: DiscoverySubmission = {
      ...unsignedPayload,
      requestId: identity.requestId,
    };

    submittingRef.current = true;
    setAnalysisError("");
    setScreen("analyzing");
    try {
      const response = await fetch("/api/discovery-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as DiscoveryReleaseResponse;
      if (!response.ok || !result.ok) {
        setAnalysisError(result.ok ? "The report could not be completed." : result.error.message);
        setScreen("contact");
        return;
      }
      setScreen("report");
    } catch {
      setAnalysisError("The report could not be completed. Your answers remain on this page.");
      setScreen("contact");
    } finally {
      submittingRef.current = false;
    }
  };

  const started = screen !== "intro";
  const progress = discoveryProgress(screen, questionIndex, WEBSITE_STEPS.length);
  const complete = progress === 100;

  const renderScreen = () => {
    if (screen === "enriching") {
      return (
        <main ref={transitionRef} tabIndex={-1} className="discovery-app discovery-analysis" role="status" aria-live="polite">
          <BlockLoader size="large" />
          <p>Researching your company.</p>
        </main>
      );
    }

    if (screen === "analyzing") {
      return (
        <main ref={transitionRef} tabIndex={-1} className="discovery-app discovery-analysis" role="status" aria-live="polite">
          <BlockLoader size="large" />
          <p>{discoveryCopy.buildingReport}</p>
        </main>
      );
    }

    if (screen === "report") return <DiscoveryReleaseReportView />;

    if (screen === "intro") {
      return (
        <DiscoveryIntakeFrame
          activeStep={null}
          progress={progress}
          steps={WEBSITE_STEPS}
          showSteps={false}
        >
          <article className={`discovery-question discovery-step-motion is-${direction}`} key="intro">
            <div className="discovery-intro-glyph" aria-hidden="true">{introGlyph}</div>
            <h1 ref={headingRef} tabIndex={-1}>
              {discoveryIntro.brand}<br />{discoveryIntro.title}
            </h1>
            <p>{discoveryIntro.introduction}</p>
            <p>{discoveryIntro.outcome}</p>
            <div className="discovery-actions">
              <button
                className="discovery-primary"
                type="button"
                onClick={() => { setDirection("forward"); setScreen("entry"); }}
              >
                {discoveryIntro.action} <BlockArrow />
              </button>
            </div>
          </article>
        </DiscoveryIntakeFrame>
      );
    }

    if (screen === "entry") {
      return (
        <DiscoveryIntakeFrame
          activeStep={0}
          progress={progress}
          steps={WEBSITE_STEPS}
        >
          <form className={`discovery-question discovery-release-website discovery-step-motion is-${direction}`} onSubmit={enrichWebsite} key="entry">
            <h1 ref={headingRef} tabIndex={-1} id="release-website-title">{discoveryCopy.website.title}</h1>
            <p>{discoveryCopy.website.help}</p>
            <label className="discovery-release-field">
              <span className="sr-only">Company website</span>
              <input
                type="text"
                inputMode="url"
                autoComplete="url"
                maxLength={DISCOVERY_RELEASE_LIMITS.website}
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                placeholder={discoveryCopy.website.placeholder}
                required
              />
            </label>
            {entryError ? <p className="discovery-notice" role="alert">{entryError}</p> : null}
            <div className="discovery-actions">
              <button type="button" onClick={() => { setDirection("back"); setScreen("intro"); }}>Back</button>
              <div>
                <button type="button" onClick={skipWebsite}>{discoveryCopy.website.skip}</button>
                <button className="discovery-primary" type="submit">
                  {discoveryCopy.website.action} <BlockArrow />
                </button>
              </div>
            </div>
          </form>
        </DiscoveryIntakeFrame>
      );
    }

    if (screen === "context" && research) {
      return (
        <DiscoveryIntakeFrame
          activeStep={0}
          progress={progress}
          steps={WEBSITE_STEPS}
        >
          <article className={`discovery-question discovery-release-context-review discovery-step-motion is-${direction}`}>
            <h1 ref={headingRef} tabIndex={-1}>{discoveryCopy.research.title}</h1>
            <p>{discoveryCopy.research.message(companyName)}</p>
            <div className="discovery-research-sources" aria-label={discoveryCopy.sources}>
              {research.sources.map(source => <a key={source.url} href={source.url} target="_blank" rel="noreferrer">{source.label}</a>)}
            </div>
            <div className="discovery-actions">
              <button type="button" onClick={() => { setDirection("back"); setScreen("entry"); }}>Back</button>
              <div>
                <button className="discovery-primary" type="button" onClick={() => { setDirection("forward"); setScreen("sector"); }}>
                  Continue <BlockArrow />
                </button>
              </div>
            </div>
          </article>
        </DiscoveryIntakeFrame>
      );
    }

    if (screen === "sector") {
      return (
        <DiscoveryIntakeFrame
          activeStep={0}
          progress={progress}
          steps={MANUAL_STEPS}
        >
          <article className={`discovery-question discovery-step-motion is-${direction}`}>
            <h1 ref={headingRef} tabIndex={-1} id="release-sector-title">
              {discoveryCopy.sector.title}
            </h1>
            {research ? <p>{discoveryCopy.prefill}</p> : null}
            <div className="discovery-options" role="radiogroup" aria-labelledby="release-sector-title">
              {SECTOR_CHOICES.map((choice, index) => (
                <button
                  type="button"
                  className={manualSector === choice.value ? "is-selected" : ""}
                  role="radio"
                  aria-checked={manualSector === choice.value}
                  tabIndex={rovingTabIndex(
                    manualSector === choice.value,
                    Boolean(manualSector),
                    index,
                  )}
                  onKeyDown={(event) => handleRadioKeyDown(event, index, SECTOR_CHOICES, (value) => setManualSector(value as ReleaseSector))}
                  onClick={() => setManualSector(choice.value as ReleaseSector)}
                  key={choice.value}
                >
                  <span><strong>{choice.label}</strong></span>
                </button>
              ))}
            </div>
            <div className="discovery-actions">
              <button type="button" onClick={() => { setDirection("back"); setScreen(intakeMode === "website" ? "context" : "entry"); }}>Back</button>
              <div>
                <button className="discovery-primary" type="button" onClick={confirmManualSector} disabled={!manualSector}>
                  Continue <BlockArrow />
                </button>
              </div>
            </div>
          </article>
        </DiscoveryIntakeFrame>
      );
    }

    if (screen === "questions" && activeQuestion) {
      const selected = answers[activeQuestion.id];
      const step = questionIndex + 1;
      const steps = MANUAL_STEPS;
      const wasPrefilled = research?.company.sector === manualSector &&
        ["workflow", "systems", "controls"].includes(activeQuestion.id) &&
        Boolean(research.prefill[activeQuestion.id as keyof DiscoveryResearch["prefill"]]?.length);
      const headingId = `release-${activeQuestion.id}-title`;
      return (
        <DiscoveryIntakeFrame
          activeStep={step}
          progress={progress}
          steps={steps}
        >
          <article className={`discovery-question discovery-step-motion is-${direction}`} key={activeQuestion.id}>
            <h1 ref={headingRef} tabIndex={-1} id={headingId}>{activeQuestion.prompt}</h1>
            <p>{activeQuestion.help}{wasPrefilled ? ` ${discoveryCopy.prefill}` : ""}</p>
            <div
              className={`discovery-options${activeQuestion.kind === "multi" ? " discovery-options--multi" : ""}`}
              role={activeQuestion.kind === "single" ? "radiogroup" : "group"}
              aria-labelledby={headingId}
            >
              {activeQuestion.choices.map((choice, index) => {
                const isSelected = Array.isArray(selected)
                  ? selected.includes(choice.value)
                  : selected === choice.value;
                const maximumReached =
                  activeQuestion.kind === "multi" &&
                  Array.isArray(selected) &&
                  Boolean(activeQuestion.maximum) &&
                  selected.length >= (activeQuestion.maximum ?? 0);
                return (
                  <button
                    type="button"
                    className={isSelected ? "is-selected" : ""}
                    aria-pressed={activeQuestion.kind === "multi" ? isSelected : undefined}
                    role={activeQuestion.kind === "single" ? "radio" : undefined}
                    aria-checked={activeQuestion.kind === "single" ? isSelected : undefined}
                    tabIndex={
                      activeQuestion.kind === "single"
                        ? rovingTabIndex(isSelected, Boolean(selected), index)
                        : undefined
                    }
                    onKeyDown={activeQuestion.kind === "single" ? (event) => handleRadioKeyDown(event, index, activeQuestion.choices, (value) => selectChoice(activeQuestion, value)) : undefined}
                    disabled={maximumReached && !isSelected}
                    onClick={() => selectChoice(activeQuestion, choice.value)}
                    key={choice.value}
                  >
                    <span>
                      <strong>{choice.label}</strong>
                      {choice.description ? <small>{choice.description}</small> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            {activeQuestion.maximum && Array.isArray(selected) && selected.length >= activeQuestion.maximum ? (
              <span className="sr-only" role="status">Maximum selected. Deselect one to choose another.</span>
            ) : null}
            {activeQuestion.kind === "multi" ? (
              <div className="discovery-answer-context">
                <div className="discovery-answer-divider" aria-hidden="true">
                  <span>{discoveryCopy.additionalContext.divider}</span>
                </div>
                <label className="discovery-release-field">
                  <span className="sr-only">{activeQuestion.label}: your own answer or additional context</span>
                  <AutoExpandingTextarea
                    maxLength={DISCOVERY_RELEASE_LIMITS.context}
                    value={answers.context?.[activeQuestion.id as MultiAnswerId] ?? ""}
                    placeholder={discoveryCopy.additionalContext.placeholder}
                    onChange={event => {
                      const value = event.target.value;
                      reviewedAnswersRef.current.add(activeQuestion.id);
                      setAnswers(current => ({ ...current, context: { ...current.context, [activeQuestion.id]: value } }));
                    }}
                  />
                </label>
              </div>
            ) : null}
            <div className="discovery-actions">
              <button type="button" onClick={previousQuestion}>Back</button>
              <div>
                <button
                  className="discovery-primary"
                  type="button"
                  onClick={nextQuestion}
                  disabled={!questionComplete}
                >
                  Continue <BlockArrow />
                </button>
              </div>
            </div>
          </article>
        </DiscoveryIntakeFrame>
      );
    }

    if (screen === "contact" && manualSector) {
      return (
        <DiscoveryIntakeFrame
          activeStep={null}
          progress={progress}
          steps={MANUAL_STEPS}
          progressLabel="Diagnostic complete"
        >
          <form className={`discovery-question discovery-release-email discovery-step-motion is-${direction}`} onSubmit={submitDiagnostic}>
            <h1 ref={headingRef} tabIndex={-1}>{discoveryCopy.contact.title}</h1>
            <p>{discoveryCopy.contact.help}</p>
            <label className="discovery-release-field">
              <span className="sr-only">Work email</span>
              <input
                type="email"
                autoComplete="email"
                maxLength={DISCOVERY_RELEASE_LIMITS.workEmail}
                pattern={CONTACT_EMAIL_PATTERN_SOURCE}
                value={contact.workEmail}
                onChange={(event) => setContact({ workEmail: event.target.value })}
                placeholder={discoveryCopy.contact.placeholder}
                required
              />
            </label>
            <div className="discovery-contact-privacy">
              <p>{discoveryCopy.contact.privacy} See our <a href="/privacy" target="_blank" rel="noreferrer">Privacy Notice</a>.</p>
            </div>
            {analysisError ? <p className="discovery-notice" role="alert">{analysisError}</p> : null}
            <div className="discovery-actions">
              <button type="button" onClick={() => { setDirection("back"); setQuestionIndex(questions.length - 1); setScreen("questions"); }}>Back</button>
              <div>
                <button className="discovery-primary" type="submit">
                  Generate report <BlockArrow />
                </button>
              </div>
            </div>
          </form>
        </DiscoveryIntakeFrame>
      );
    }

    return null;
  };

  return (
    <div className="discovery-app discovery-shell">
      {renderScreen()}
      <DiscoveryProgress
        progress={progress}
        label={complete ? "Diagnostic complete" : `Progress ${progress}%`}
        started={started}
      />
    </div>
  );
}

function DiscoveryIntakeFrame({
  activeStep,
  children,
  progress,
  progressLabel,
  showSteps = true,
  steps,
}: {
  activeStep: number | null;
  children: React.ReactNode;
  progress: number;
  progressLabel?: string;
  showSteps?: boolean;
  steps: readonly string[];
}) {
  return (
    <main className="discovery-app discovery-intake discovery-release-intake" data-intro={!showSteps || undefined}>
      <section className="discovery-canvas">
        <div className="discovery-interaction">
          {showSteps ? <aside className="discovery-section-index" aria-label="Diagnostic steps">
            <ol>
              {steps.map((step, index) => (
                <li
                  className={activeStep === index ? "is-active" : undefined}
                  aria-current={activeStep === index ? "step" : undefined}
                  key={step}
                >
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <p className="sr-only" aria-live="polite">
              {activeStep === null
                ? progressLabel ?? "Diagnostic complete"
                : `${steps[activeStep]} step, ${progress}% complete`}
            </p>
          </aside> : null}
          <div className="discovery-form-column">{children}</div>
        </div>
      </section>
    </main>
  );
}

function DiscoveryProgress({
  progress,
  label,
  started,
}: {
  progress: number;
  label: string;
  started: boolean;
}) {
  return (
    <footer className="discovery-bottom-bar">
      <div
        className="discovery-progress"
        style={{ "--discovery-progress": `${started ? progress : 100}%` } as CSSProperties}
      >
        <div
          className="discovery-progress-track"
          role={started ? "progressbar" : undefined}
          aria-labelledby={started ? "discovery-release-progress-label" : undefined}
          aria-valuemin={started ? 0 : undefined}
          aria-valuemax={started ? 100 : undefined}
          aria-valuenow={started ? progress : undefined}
        >
          <span aria-hidden="true" />
        </div>
        <div className="discovery-progress-labels">
          <span
            id="discovery-release-progress-label"
            className="discovery-progress-text"
            data-hidden={!started || undefined}
            aria-hidden={!started}
          >
            {label}
          </span>
          <a className="discovery-privacy-link" href="/privacy" target="_blank" rel="noreferrer">
            Privacy policy
          </a>
        </div>
      </div>
    </footer>
  );
}

export function DiscoveryReleaseReportView() {
  const reportHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      reportHeadingRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);
  return (
    <main className="discovery-app discovery-delivery">
      <div className="discovery-canvas">
        <div className="discovery-interaction discovery-delivery-layout">
          <div className="discovery-delivery-message">
            <h1 ref={reportHeadingRef} tabIndex={-1}>{discoveryCopy.delivery.title}</h1>
            <p>{discoveryCopy.delivery.description}</p>
          </div>
          <div className="discovery-delivery-preview" aria-hidden="true">
            {[1, 2].map(page => (
              <div className="discovery-delivery-paper" key={page}>
                <div className="discovery-delivery-paper-header">
                  <strong>{discoveryReportCopy.title}</strong>
                  <img src={PRIMARY_LOGO.src} width={PRIMARY_LOGO.width} height={PRIMARY_LOGO.height} alt="" />
                </div>
                <div className="discovery-delivery-paper-content">
                  {[1, 2, 3].map(section => (
                    <div className="discovery-delivery-placeholder" key={section}>
                      <span className="discovery-delivery-placeholder-title" />
                      {[1, 2, 3, 4, 5].map(line => <span key={line} />)}
                    </div>
                  ))}
                </div>
                <div className="discovery-delivery-paper-footer">NNCo <span>{page} / 2</span></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function handleRadioKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  currentIndex: number,
  choices: readonly ReleaseChoice[],
  select: (value: string) => void,
): void {
  const keys = ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft", "Home", "End"];
  if (!keys.includes(event.key)) return;
  event.preventDefault();
  const forwards = event.key === "ArrowDown" || event.key === "ArrowRight";
  const backwards = event.key === "ArrowUp" || event.key === "ArrowLeft";
  const nextIndex = event.key === "Home"
    ? 0
    : event.key === "End"
      ? choices.length - 1
      : forwards
        ? (currentIndex + 1) % choices.length
        : backwards
          ? (currentIndex - 1 + choices.length) % choices.length
          : currentIndex;
  select(choices[nextIndex].value);
  const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
    '[role="radio"]',
  );
  buttons?.[nextIndex]?.focus();
}
