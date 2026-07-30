import { useEffect, useRef, useState } from "react";

type DiscoveryBrandLogoProps = {
  priority?: boolean;
  variant?: "primary" | "alternate";
};

const ANIMATION_FRAMES = [
  "/assets/nnco-logo-condensed-frame-01.png",
  "/assets/nnco-logo-condensed-frame-02.png",
  "/assets/nnco-logo-condensed-frame-03.png",
  "/assets/nnco-logo-condensed-frame-04.png",
] as const;
const FRAME_CADENCE_MS = 240;

export function DiscoveryBrandLogo({
  priority = false,
  variant = "primary",
}: DiscoveryBrandLogoProps) {
  const [activeFrame, setActiveFrame] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const frameTimerRef = useRef<number | null>(null);
  const introFrameRef = useRef<number | null>(null);
  const mountedRef = useRef(false);
  const motionAllowedRef = useRef(false);
  const runningRef = useRef(false);
  const introPendingRef = useRef(true);
  const queuedInteractionRef = useRef(false);
  const hoveredRef = useRef(false);
  const focusedRef = useRef(false);

  function resetVisual(updateState = true) {
    if (frameTimerRef.current !== null) {
      window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    runningRef.current = false;

    if (updateState && mountedRef.current) {
      setActiveFrame(0);
      setIsAnimating(false);
    }
  }

  function finishSequence() {
    resetVisual();

    if (
      queuedInteractionRef.current &&
      (hoveredRef.current || focusedRef.current) &&
      motionAllowedRef.current &&
      variant === "primary" &&
      mountedRef.current
    ) {
      queuedInteractionRef.current = false;
      runSequence();
    } else if (!hoveredRef.current && !focusedRef.current) {
      queuedInteractionRef.current = false;
    }
  }

  function runSequence() {
    if (
      variant !== "primary" ||
      !motionAllowedRef.current ||
      runningRef.current ||
      !mountedRef.current
    ) {
      return;
    }

    runningRef.current = true;
    setActiveFrame(0);
    setIsAnimating(true);

    let frame = 0;
    frameTimerRef.current = window.setInterval(() => {
      frame += 1;
      if (frame >= ANIMATION_FRAMES.length) {
        finishSequence();
        return;
      }
      setActiveFrame(frame);
    }, FRAME_CADENCE_MS);
  }

  function requestInteraction() {
    if (variant !== "primary" || !motionAllowedRef.current) return;

    if (introPendingRef.current || runningRef.current) {
      queuedInteractionRef.current = true;
      return;
    }

    runSequence();
  }

  function beginInteraction(kind: "pointer" | "focus") {
    const wasActive = hoveredRef.current || focusedRef.current;
    if (kind === "pointer") hoveredRef.current = true;
    else focusedRef.current = true;
    if (!wasActive) requestInteraction();
  }

  function endInteraction(kind: "pointer" | "focus") {
    if (kind === "pointer") hoveredRef.current = false;
    else focusedRef.current = false;
  }

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    );
    mountedRef.current = true;
    introPendingRef.current = variant === "primary";
    queuedInteractionRef.current = false;

    const syncMotionPreference = () => {
      motionAllowedRef.current = !reducedMotion.matches;
      if (reducedMotion.matches) {
        queuedInteractionRef.current = false;
        resetVisual();
      }
    };

    syncMotionPreference();
    reducedMotion.addEventListener("change", syncMotionPreference);

    if (variant === "primary") {
      introFrameRef.current = window.requestAnimationFrame(() => {
        introFrameRef.current = null;
        introPendingRef.current = false;

        if (motionAllowedRef.current) runSequence();
        else queuedInteractionRef.current = false;
      });
    } else {
      introPendingRef.current = false;
      resetVisual();
    }

    return () => {
      mountedRef.current = false;
      reducedMotion.removeEventListener("change", syncMotionPreference);
      if (introFrameRef.current !== null) {
        window.cancelAnimationFrame(introFrameRef.current);
        introFrameRef.current = null;
      }
      resetVisual(false);
      hoveredRef.current = false;
      focusedRef.current = false;
      introPendingRef.current = true;
      queuedInteractionRef.current = false;
    };
  }, [variant]);

  return (
    <a
      className={`wordmark${isAnimating ? " is-animating" : ""}`}
      href="/"
      aria-label="NNCO home"
      onPointerEnter={() => beginInteraction("pointer")}
      onPointerLeave={() => endInteraction("pointer")}
      onFocus={() => beginInteraction("focus")}
      onBlur={() => endInteraction("focus")}
      style={{ animation: "none", transform: "none", transition: "none" }}
    >
      <span
        className="wordmark__stage"
        aria-hidden="true"
        style={{ animation: "none", transform: "none", transition: "none" }}
      >
        <img
          className="wordmark-logo wordmark-logo--static"
          src={
            variant === "alternate"
              ? "/assets/nnco-logo-alt.svg"
              : "/assets/nnco-logo-condensed-frame-01.png"
          }
          alt=""
          width={variant === "primary" ? 720 : 900}
          height={700}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          style={{ animation: "none", transform: "none", transition: "none" }}
        />
        {variant === "primary"
          ? ANIMATION_FRAMES.map((src, index) => (
              <img
                className={`wordmark-logo wordmark-logo--frame${
                  isAnimating && activeFrame === index ? " is-active" : ""
                }`}
                src={src}
                alt=""
                width={720}
                height={700}
                loading="eager"
                fetchPriority={priority || index === 0 ? "high" : "auto"}
                key={src}
                style={{
                  animation: "none",
                  transform: "none",
                  transition: "none",
                }}
              />
            ))
          : null}
      </span>
    </a>
  );
}
