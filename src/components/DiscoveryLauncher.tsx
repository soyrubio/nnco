import { lazy, Suspense, useState } from "react";
import { DiscoveryBlockArrow as BlockArrow } from "./discovery/DiscoveryBlockArrow";
import { DiscoveryBlockLoader as BlockLoader } from "./discovery/DiscoveryBlockLoader";

const LazyDiscoveryCockpit = lazy(() =>
  import("./DiscoveryCockpit").then((module) => ({
    default: module.DiscoveryCockpit,
  })),
);

export function DiscoveryLauncher() {
  const [started, setStarted] = useState(false);

  if (started) {
    return (
      <Suspense
        fallback={
          <main className="discovery-app discovery-loading" aria-live="polite">
            <BlockLoader />
          </main>
        }
      >
        <LazyDiscoveryCockpit />
      </Suspense>
    );
  }

  return (
    <main className="discovery-app discovery-entry-screen">
      <div className="discovery-entry-screen__inner">
        <h1>Map one workflow.</h1>
        <p className="discovery-entry-screen__introduction">
          Answer questions about how one process runs today and get an analysis
          of where it loses time, what AI could take over, and what your
          constraints would allow. About 15 minutes. You can stop and come back.
        </p>
        <ul>
          <li>You need one workflow in mind. Not your whole operation.</li>
          <li>Nothing you enter is shared outside NNCO.</li>
          <li>The first part of the report is available immediately.</li>
        </ul>
        <div className="discovery-entry-screen__actions">
          <button
            type="button"
            className="discovery-primary"
            onClick={() => setStarted(true)}
          >
            Start <BlockArrow />
          </button>
          <a href="/contact">Book a 30-minute call instead</a>
        </div>
      </div>
    </main>
  );
}
