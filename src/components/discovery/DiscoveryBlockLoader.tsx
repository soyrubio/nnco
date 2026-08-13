import { useEffect, useState } from "react";
import { LOADER_FRAME_CADENCE_MS, LOADER_FRAMES } from "@/lib/loader";

type DiscoveryBlockLoaderProps = {
  size?: "compact" | "large";
};

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
          setActiveFrame((current) => (current + 1) % LOADER_FRAMES.length);
        }, LOADER_FRAME_CADENCE_MS);
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
      className={`nnco-loader-mark nnco-loader-mark--${size} nnco-loader-mark--on-dark`}
      aria-hidden="true"
    >
      {LOADER_FRAMES.map((src, index) => (
        <img
          className={`nnco-loader-mark__frame ${
            activeFrame === index ? "is-active" : ""
          }`}
          src={src}
          alt=""
          width={300}
          height={300}
          loading={size === "large" ? "eager" : "lazy"}
          key={src}
        />
      ))}
    </span>
  );
}
