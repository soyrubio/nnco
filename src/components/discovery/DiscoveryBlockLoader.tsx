import { useEffect, useState } from "react";

type DiscoveryBlockLoaderProps = {
  size?: "compact" | "large";
};

const FRAMES = [
  "/assets/loader-frame-01.svg",
  "/assets/loader-frame-02.svg",
  "/assets/loader-frame-03.svg",
] as const;
const FRAME_CADENCE_MS = 240;

export function DiscoveryBlockLoader({
  size = "compact",
}: DiscoveryBlockLoaderProps) {
  const [activeFrame, setActiveFrame] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    let frameTimer: ReturnType<typeof setInterval> | undefined;

    const syncMotionPreference = () => {
      if (frameTimer) clearInterval(frameTimer);
      setActiveFrame(0);

      if (!reducedMotion.matches) {
        frameTimer = setInterval(() => {
          setActiveFrame((current) => (current + 1) % FRAMES.length);
        }, FRAME_CADENCE_MS);
      }
    };

    syncMotionPreference();
    reducedMotion.addEventListener("change", syncMotionPreference);

    return () => {
      if (frameTimer) clearInterval(frameTimer);
      reducedMotion.removeEventListener("change", syncMotionPreference);
    };
  }, []);

  return (
    <span
      className={`nnco-block-loader nnco-block-loader--${size}`}
      aria-hidden="true"
    >
      {FRAMES.map((src, index) => (
        <img
          className={`nnco-block-loader__frame ${
            activeFrame === index ? "is-active" : ""
          }`}
          src={src}
          alt=""
          width={400}
          height={300}
          loading={size === "large" ? "eager" : "lazy"}
          key={src}
        />
      ))}
    </span>
  );
}
