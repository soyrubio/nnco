import {
  WORKFLOW_CHOICES, RELEASE_SYSTEM_CHOICES, RELEASE_CONTROL_CHOICES,
  frictionChoicesFor, type DiscoveryResearch, type ReleaseAnswers, type ReleaseSector,
} from "./discovery-release.ts";

export function emptyDiscoveryAnswers(): ReleaseAnswers {
  return { workflow: [], friction: [], scale: "", systems: [], controls: [], context: {} };
}

export function discoveryWorkflowOptions(research: DiscoveryResearch | null, sector: ReleaseSector) {
  return research?.company.sector === sector ? research.workflowOptions : WORKFLOW_CHOICES[sector];
}

export function prefillDiscoveryAnswers(
  research: DiscoveryResearch,
  current: ReleaseAnswers = emptyDiscoveryAnswers(),
  reviewed: ReadonlySet<keyof ReleaseAnswers> = new Set(),
  sector: ReleaseSector = research.company.sector,
): ReleaseAnswers {
  const allowed = {
    workflow: discoveryWorkflowOptions(research, sector),
    friction: frictionChoicesFor(sector),
    systems: RELEASE_SYSTEM_CHOICES,
    controls: RELEASE_CONTROL_CHOICES,
  };
  const next = { ...current, context: { ...current.context } };
  for (const id of ["workflow", "friction", "systems", "controls"] as const) {
    const proposed = id === "friction" || (id === "workflow" && sector !== research.company.sector) ? [] : research.prefill[id];
    next[id] = [...new Set(reviewed.has(id) ? current[id] : proposed)]
      .filter(value => allowed[id].some(option => option.value === value))
      .slice(0, id === "workflow" || id === "friction" ? 2 : 8);
  }
  return next;
}

export function answersAfterSectorChange(answers: ReleaseAnswers, sector: ReleaseSector): ReleaseAnswers {
  return {
    ...answers,
    workflow: answers.workflow.filter(value => WORKFLOW_CHOICES[sector].some(option => option.value === value)),
    friction: answers.friction.filter(value => frictionChoicesFor(sector).some(option => option.value === value)),
  };
}
