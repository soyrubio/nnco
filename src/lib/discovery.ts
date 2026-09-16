// Backward-compatibility re-export for legacy discovery-domain contract.
//
// The active `/discovery` flow uses `src/lib/discovery-release.ts` + related
// handlers. This file intentionally delegates to the legacy discovery domain
// model used by the older diagnostic handoff pipeline.
export * from "./discovery-domain.ts";
