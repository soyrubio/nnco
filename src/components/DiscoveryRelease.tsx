import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type SyntheticEvent,
} from "react";
import { DiscoveryBlockArrow as BlockArrow } from "./discovery/DiscoveryBlockArrow";
import { DiscoveryBlockLoader as BlockLoader } from "./discovery/DiscoveryBlockLoader";
import { DiscoveryBrandLogo as BrandLogo } from "./discovery/DiscoveryBrandLogo";
import {
  DISCOVERY_RELEASE_CONSENT_VERSION,
  DISCOVERY_RELEASE_LIMITS,
  RELEASE_CONTROL_CHOICES,
  RELEASE_SCALE_CHOICES,
  RELEASE_SYSTEM_CHOICES,
  buildManualCompanyContext,
  frictionChoicesFor,
  labelForReleaseSector,
  reclassifyCompanyContext,
  workflowChoicesFor,
  type CompanyContext,
  type DiscoveryEnrichmentResponse,
  type DiscoveryReleasePayload,
  type DiscoveryReleaseReport,
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

type Screen =
  | "entry"
  | "enriching"
  | "context"
  | "sector"
  | "questions"
  | "competitor"
  | "contact"
  | "analyzing"
  | "report";

type QuestionKind = "single" | "multi";

interface ReleaseQuestion {
  id: keyof ReleaseAnswers;
  label: string;
  prompt: string;
  help: string;
  kind: QuestionKind;
  maximum?: number;
  choices: ReleaseChoice[];
}

const INITIAL_ANSWERS: ReleaseAnswers = {
  workflow: [],
  friction: [],
  scale: "",
  systems: [],
  controls: [],
};

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

export function DiscoveryRelease() {
  const [screen, setScreen] = useState<Screen>("entry");
  const [website, setWebsite] = useState("");
  const [intakeMode, setIntakeMode] = useState<"website" | "manual">("website");
  const [manualSector, setManualSector] = useState<ReleaseSector | "">("");
  const [company, setCompany] = useState<CompanyContext | null>(null);
  const [companyContextToken, setCompanyContextToken] = useState<string | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<ReleaseAnswers>(INITIAL_ANSWERS);
  const [entryError, setEntryError] = useState("");
  const [contact, setContact] = useState({ workEmail: "" });
  const [competitorChoice, setCompetitorChoice] = useState<"include" | "skip" | "">("");
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [analysisError, setAnalysisError] = useState("");
  const [report, setReport] = useState<DiscoveryReleaseReport | null>(null);
  const [analysisMode, setAnalysisMode] = useState<"ai" | "rules">("ai");
  const requestIdentityRef = useRef<RequestIdentity | null>(null);
  const submittingRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const transitionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (screen === "report") return;
    const frame = window.requestAnimationFrame(() => {
      if (screen === "enriching" || screen === "analyzing") {
        transitionRef.current?.focus();
      } else {
        headingRef.current?.focus();
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [screen, questionIndex]);

  const questions = useMemo<ReleaseQuestion[]>(() => {
    if (!company) return [];
    return [
      {
        id: "workflow",
        label: "Workflow",
        prompt: "Which workflows should we examine?",
        help: "Choose up to two related processes. We will assess them together.",
        kind: "multi",
        maximum: 2,
        choices: workflowChoicesFor(company),
      },
      {
        id: "friction",
        label: "Friction",
        prompt: "Where does it lose the most attention?",
        help: "Choose up to two repeated sources of work, waiting or exceptions.",
        kind: "multi",
        maximum: 2,
        choices: frictionChoicesFor(company.sector),
      },
      {
        id: "scale",
        label: "Frequency",
        prompt: "How often does this workflow run?",
        help: "An approximate frequency is enough for the first diagnostic.",
        kind: "single",
        choices: RELEASE_SCALE_CHOICES,
      },
      {
        id: "systems",
        label: "Systems",
        prompt: "What does the work touch today?",
        help: "Choose categories only. Do not enter credentials or case data.",
        kind: "multi",
        choices: RELEASE_SYSTEM_CHOICES,
      },
      {
        id: "controls",
        label: "Controls",
        prompt: "What must remain under control?",
        help: "Select every boundary that a useful intervention must respect.",
        kind: "multi",
        choices: RELEASE_CONTROL_CHOICES,
      },
    ];
  }, [company]);

  const activeQuestion = questions[questionIndex];
  const questionComplete = activeQuestion
    ? answerHasValue(answers[activeQuestion.id])
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
        body: JSON.stringify({ website, situation: "" }),
      });
      const result = (await response.json()) as DiscoveryEnrichmentResponse;
      if (!response.ok || !result.ok) {
        setEntryError(result.ok ? "We could not read that website." : result.error.message);
        setScreen("entry");
        return;
      }
      setCompany(result.company);
      setCompanyContextToken(result.contextToken);
      setWebsite(result.company.website ?? "");
      setIntakeMode("website");
      setAnswers(INITIAL_ANSWERS);
      setCompetitorChoice("");
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
    setCompany(null);
    setCompanyContextToken(null);
    setIntakeMode("manual");
    setManualSector("");
    setCompetitorChoice("");
    setAnswers(INITIAL_ANSWERS);
    setQuestionIndex(0);
    setDirection("forward");
    setScreen("sector");
  };

  const confirmManualSector = () => {
    if (!manualSector) return;
    if (intakeMode === "website" && company) {
      setCompany(reclassifyCompanyContext(company, manualSector));
      setAnswers(INITIAL_ANSWERS);
      setCompetitorChoice("");
      setDirection("back");
      setScreen("context");
      return;
    }
    setCompany(buildManualCompanyContext(manualSector));
    setQuestionIndex(0);
    setDirection("forward");
    setScreen("questions");
  };

  const selectChoice = (question: ReleaseQuestion, value: string) => {
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
    if (questionIndex >= questions.length - 1) {
      setDirection("forward");
      setScreen(company?.website ? "competitor" : "contact");
      return;
    }
    setDirection("forward");
    setQuestionIndex((current) => current + 1);
  };

  const previousQuestion = () => {
    setDirection("back");
    if (questionIndex === 0) {
      setScreen(intakeMode === "manual" ? "sector" : "context");
      return;
    }
    setQuestionIndex((current) => Math.max(0, current - 1));
  };

  const submitDiagnostic = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!company || submittingRef.current) return;
    if (!isValidContactEmail(contact.workEmail)) {
      setAnalysisError("Enter a valid work email before continuing.");
      return;
    }
    const organisation = organisationForCompany(company);
    const unsignedPayload: Omit<DiscoveryReleasePayload, "requestId"> = {
      schemaVersion: 1,
      website: company.website,
      situation: "",
      company,
      companyContextToken,
      answers,
      contact: {
        workEmail: contact.workEmail.trim(),
        organisation,
      },
      competitorView: {
        enabled: company.website ? competitorChoice === "include" : false,
        names: [],
      },
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
    const payload: DiscoveryReleasePayload = {
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
      setReport(result.report);
      setAnalysisMode(result.analysisMode);
      setScreen("report");
    } catch {
      setAnalysisError("The report could not be completed. Your answers remain on this page.");
      setScreen("contact");
    } finally {
      submittingRef.current = false;
    }
  };

  if (screen === "enriching") {
    return (
      <main ref={transitionRef} tabIndex={-1} className="discovery-app discovery-analysis" role="status" aria-live="polite">
        <BlockLoader size="large" />
        <p>Reading the public company context.</p>
      </main>
    );
  }

  if (screen === "analyzing") {
    return (
      <main ref={transitionRef} tabIndex={-1} className="discovery-app discovery-analysis" role="status" aria-live="polite">
        <BlockLoader size="large" />
        <p>Building the two-page diagnostic.</p>
      </main>
    );
  }

  if (screen === "report" && report && company) {
    return (
      <DiscoveryReleaseReportView
        company={company}
        mode={analysisMode}
        report={report}
      />
    );
  }

  if (screen === "entry") {
    return (
      <DiscoveryIntakeFrame
        activeStep={0}
        progress={Math.round(100 / WEBSITE_STEPS.length)}
        steps={WEBSITE_STEPS}
      >
        <form className={`discovery-question discovery-release-website discovery-step-motion is-${direction}`} onSubmit={enrichWebsite}>
          <h1 ref={headingRef} tabIndex={-1} id="release-website-title">Which company should we read?</h1>
          <p>We will use its public pages to ask only what the website cannot tell us.</p>
          <label className="discovery-release-field">
            <span>Company website</span>
            <input
              type="text"
              inputMode="url"
              autoComplete="url"
              maxLength={DISCOVERY_RELEASE_LIMITS.website}
              value={website}
              onChange={(event) => setWebsite(event.target.value)}
              placeholder="company.com"
              required
            />
          </label>
          <p className="discovery-privacy">
            We may send up to three public company pages to OpenAI to identify company context and cache that page text for no more than 24 hours. No lead is created yet. Do not enter customer, patient or confidential information. <a href="/privacy" target="_blank" rel="noreferrer">Privacy details</a>
          </p>
          {entryError ? <p className="discovery-notice" role="alert">{entryError}</p> : null}
          <div className="discovery-actions">
            <button type="button" onClick={skipWebsite}>Continue without a website</button>
            <div>
              <button className="discovery-primary" type="submit">
                Read website <BlockArrow />
              </button>
            </div>
          </div>
        </form>
      </DiscoveryIntakeFrame>
    );
  }

  if (screen === "context" && company) {
    return (
      <DiscoveryIntakeFrame
        activeStep={0}
        progress={Math.round(100 / WEBSITE_STEPS.length)}
        steps={WEBSITE_STEPS}
      >
        <article className={`discovery-question discovery-release-context-review discovery-step-motion is-${direction}`}>
          <h1 ref={headingRef} tabIndex={-1}>We found {company.name}.</h1>
          <p>{company.summary}</p>
          <dl>
            <div>
              <dt>Sector</dt>
              <dd>{labelForReleaseSector(company.sector)}</dd>
            </div>
            <div>
              <dt>Public context</dt>
              <dd>{company.offerings.slice(0, 4).join(", ")}</dd>
            </div>
            <div>
              <dt>Pages read</dt>
              <dd>
                {company.sources.map((source, index) => (
                  <span key={source.url}>
                    {index ? ", " : ""}<a href={source.url} target="_blank" rel="noreferrer">{source.label}</a>
                  </span>
                ))}
              </dd>
            </div>
          </dl>
          <div className="discovery-actions">
            <div className="discovery-release-context-actions">
              <button type="button" onClick={() => { setDirection("back"); setScreen("entry"); }}>Use another website</button>
              <button type="button" onClick={() => { setManualSector(company.sector); setDirection("forward"); setScreen("sector"); }}>Change sector</button>
            </div>
            <div>
              <button className="discovery-primary" type="button" onClick={() => { setDirection("forward"); setScreen("questions"); }}>
                Looks right <BlockArrow />
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
        progress={Math.round(100 / MANUAL_STEPS.length)}
        steps={MANUAL_STEPS}
      >
        <article className={`discovery-question discovery-step-motion is-${direction}`}>
          <h1 ref={headingRef} tabIndex={-1} id="release-sector-title">
            {intakeMode === "website" ? "Which sector fits better?" : "Which sector should we use?"}
          </h1>
          <p>{intakeMode === "website" ? "We will keep the public company context and reroute the remaining questions." : "This replaces the context we would normally read from a public website."}</p>
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
                Next <BlockArrow />
              </button>
            </div>
          </div>
        </article>
      </DiscoveryIntakeFrame>
    );
  }

  if (screen === "questions" && company && activeQuestion) {
    const selected = answers[activeQuestion.id];
    const step = questionIndex + 1;
    const steps = intakeMode === "manual" ? MANUAL_STEPS : WEBSITE_STEPS;
    const progress = Math.round(((step + 1) / steps.length) * 100);
    const headingId = `release-${activeQuestion.id}-title`;
    return (
      <DiscoveryIntakeFrame
        activeStep={step}
        progress={progress}
        steps={steps}
      >
        <article className={`discovery-question discovery-step-motion is-${direction}`} key={activeQuestion.id}>
          <h1 ref={headingRef} tabIndex={-1} id={headingId}>{activeQuestion.prompt}</h1>
          <p>{activeQuestion.help}</p>
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
            <p className="discovery-release-selection-limit" role="status">Maximum selected. Deselect one to choose another.</p>
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
                Next <BlockArrow />
              </button>
            </div>
          </div>
        </article>
      </DiscoveryIntakeFrame>
    );
  }

  if (screen === "competitor" && company?.website) {
    const choices: ReleaseChoice[] = [
      { value: "include", label: "Include a public market comparison" },
      { value: "skip", label: "No comparison" },
    ];
    return (
      <DiscoveryIntakeFrame
        activeStep={null}
        progress={100}
        steps={WEBSITE_STEPS}
        progressLabel="Diagnostic complete"
      >
        <article className={`discovery-question discovery-step-motion is-${direction}`}>
          <h1 ref={headingRef} tabIndex={-1} id="release-competitor-title">Add a public market view?</h1>
          <p>This optional search uses public sources. It does not change your diagnostic answers.</p>
          <div className="discovery-options" role="radiogroup" aria-labelledby="release-competitor-title">
            {choices.map((choice, index) => (
              <button
                type="button"
                className={competitorChoice === choice.value ? "is-selected" : ""}
                role="radio"
                aria-checked={competitorChoice === choice.value}
                tabIndex={rovingTabIndex(
                  competitorChoice === choice.value,
                  Boolean(competitorChoice),
                  index,
                )}
                onKeyDown={(event) => handleRadioKeyDown(event, index, choices, (value) => setCompetitorChoice(value as "include" | "skip"))}
                onClick={() => setCompetitorChoice(choice.value as "include" | "skip")}
                key={choice.value}
              >
                <span><strong>{choice.label}</strong></span>
              </button>
            ))}
          </div>
          <div className="discovery-actions">
            <button type="button" onClick={() => { setDirection("back"); setQuestionIndex(questions.length - 1); setScreen("questions"); }}>Back</button>
            <div>
              <button className="discovery-primary" type="button" disabled={!competitorChoice} onClick={() => { setDirection("forward"); setScreen("contact"); }}>
                Next <BlockArrow />
              </button>
            </div>
          </div>
        </article>
      </DiscoveryIntakeFrame>
    );
  }

  if (screen === "contact" && company) {
    return (
      <DiscoveryIntakeFrame
        activeStep={null}
        progress={100}
        steps={intakeMode === "manual" ? MANUAL_STEPS : WEBSITE_STEPS}
        progressLabel="Diagnostic complete"
      >
        <form className={`discovery-question discovery-release-email discovery-step-motion is-${direction}`} onSubmit={submitDiagnostic}>
          <h1 ref={headingRef} tabIndex={-1}>Generate the two-page result.</h1>
          <p>Enter a work email to unlock the report. NNCo. may follow up once about this diagnostic.</p>
          <label className="discovery-release-field">
            <span>Work email</span>
            <input
              type="email"
              autoComplete="email"
              maxLength={DISCOVERY_RELEASE_LIMITS.workEmail}
              pattern={CONTACT_EMAIL_PATTERN_SOURCE}
              value={contact.workEmail}
              onChange={(event) => setContact({ workEmail: event.target.value })}
              required
            />
          </label>
          <p className="discovery-privacy">
            By selecting Generate report, you ask NNCo. to use your email and diagnostic to prepare this result and contact you once about it. The submitted record is normally deleted after 90 days. Answers are processed by OpenAI. Do not include personal, patient, customer or confidential case data. <a href="/privacy" target="_blank" rel="noreferrer">Privacy details</a>
          </p>
          {analysisError ? <p className="discovery-notice" role="alert">{analysisError}</p> : null}
          <div className="discovery-actions">
            <button type="button" onClick={() => { setDirection("back"); if (company.website) setScreen("competitor"); else { setQuestionIndex(questions.length - 1); setScreen("questions"); } }}>Back</button>
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
}

function DiscoveryIntakeFrame({
  activeStep,
  children,
  progress,
  progressLabel,
  steps,
}: {
  activeStep: number | null;
  children: React.ReactNode;
  progress: number;
  progressLabel?: string;
  steps: readonly string[];
}) {
  return (
    <main className="discovery-app discovery-intake discovery-release-intake">
      <section className="discovery-canvas">
        <div className="discovery-interaction">
          <aside className="discovery-section-index" aria-label="Diagnostic steps">
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
          </aside>
          <div className="discovery-form-column">{children}</div>
        </div>
        <div
          className="discovery-progress"
          style={{ "--discovery-progress": `${progress}%` } as CSSProperties}
        >
          <div
            className="discovery-progress-track"
            role="progressbar"
            aria-labelledby="discovery-release-progress-label"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
          >
            <span aria-hidden="true" />
          </div>
          <div className="discovery-progress-labels">
            <span id="discovery-release-progress-label">
              {progressLabel ?? `Progress ${progress}%`}
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

function DiscoveryReleaseReportView({
  company,
  mode,
  report,
}: {
  company: CompanyContext;
  mode: "ai" | "rules";
  report: DiscoveryReleaseReport;
}) {
  const reportHeadingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => reportHeadingRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const preparedDate = new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(report.generatedAt));
  return (
    <main className="discovery-app discovery-preview discovery-release-report">
      <header className="discovery-preview-toolbar">
        <BrandLogo priority />
        <div>
          <button type="button" onClick={() => window.print()}>
            Download PDF <BlockArrow direction="down" />
          </button>
          <a className="discovery-release-review-link" href="/contact">Review with NNCo.</a>
          {mode === "rules" ? <span className="discovery-release-local-note">Local rules preview</span> : null}
        </div>
      </header>
      <div className="discovery-report-pages">
        <article className="discovery-report-page" aria-label="Report page 1">
          <header><span>NNCo.</span><span>Workflow diagnostic</span></header>
          <div className="discovery-report-title">
            <span>What we understood</span>
            <h1 ref={reportHeadingRef} tabIndex={-1}>{report.title}</h1>
            <p>{report.executiveSummary}</p>
            <small>Prepared for {company.name}, {preparedDate}</small>
          </div>
          <section className="discovery-report-scope">
            <span>Scope</span>
            <dl>
              <div><dt>Workflows</dt><dd>{report.pageOne.workflow}</dd></div>
              <div><dt>Frequency</dt><dd>{report.pageOne.baseline}</dd></div>
            </dl>
          </section>
          <section className="discovery-delivery-block">
            <span>Systems and inputs</span>
            <p>{report.pageOne.systems}</p>
          </section>
          <ol className="discovery-priorities">
            {report.pageOne.findings.map((finding, index) => (
              <li key={`${finding.title}-${index}`}>
                <span>{index + 1}</span>
                <div>
                  <h3>{finding.title}</h3>
                  <p>{finding.explanation}</p>
                  <dl>
                    <div><dt>Basis</dt><dd>{finding.basis}</dd></div>
                    <div><dt>Evidence</dt><dd>{finding.evidence}</dd></div>
                  </dl>
                </div>
              </li>
            ))}
          </ol>
          <footer><span>Prepared by NNCo. Not a formal assessment.</span><span>1 / 2</span></footer>
        </article>

        <article className="discovery-report-page discovery-report-page--final" aria-label="Report page 2">
          <header><span>NNCo.</span><span>Where to act</span></header>
          <div className="discovery-report-title discovery-report-title--compact">
            <span>Where to act</span>
            <h2>Start with one bounded intervention.</h2>
            <p>{report.pageTwo.firstMove}</p>
          </div>
          <ol className="discovery-priorities discovery-release-opportunities">
            {report.pageTwo.opportunities.map((opportunity, index) => (
              <li key={`${opportunity.title}-${index}`}>
                <span>{index + 1}</span>
                <div>
                  <h3>{opportunity.title}</h3>
                  <p>{opportunity.action}</p>
                  <dl>
                    <div><dt>Stays with a person</dt><dd>{opportunity.humanBoundary}</dd></div>
                    <div><dt>Requires</dt><dd>{opportunity.requires}</dd></div>
                  </dl>
                </div>
              </li>
            ))}
          </ol>
          <section className="discovery-delivery-block">
            <span>Control boundary</span><p>{report.pageTwo.constraints}</p>
          </section>
          <section className="discovery-delivery-block discovery-release-validation">
            <span>Validate next</span>
            <ul>{report.pageTwo.validationQuestions.map((question) => <li key={question}>{question}</li>)}</ul>
          </section>
          {report.pageTwo.competitorNotes.length ? (
            <section className="discovery-delivery-block discovery-release-market">
              <span>Public market view</span>
              <ul>
                {report.pageTwo.competitorNotes.map((note) => (
                  <li key={`${note.company}-${note.sourceUrl}`}>
                    <strong>{note.company}</strong>
                    <p>{note.finding}</p>
                    <a href={note.sourceUrl}>{new URL(note.sourceUrl).hostname}</a>
                  </li>
                ))}
              </ul>
            </section>
          ) : report.pageTwo.competitorStatus === "not-found" ? (
            <section className="discovery-delivery-block discovery-release-market-empty">
              <span>Public market view</span>
              <p>No defensible public comparison was found in the available sources.</p>
            </section>
          ) : null}
          <footer><span>Review this diagnostic with NNCo. at nnco.ai/contact</span><span>2 / 2</span></footer>
        </article>
      </div>
    </main>
  );
}

function answerHasValue(value: string | string[]): boolean {
  return Array.isArray(value) ? value.length > 0 : value.trim().length > 0;
}

function organisationForCompany(company: CompanyContext): string {
  if (!company.website) return "Not provided";
  const name = company.name.trim();
  return name.length >= 2 ? name : company.domain || "Not provided";
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
