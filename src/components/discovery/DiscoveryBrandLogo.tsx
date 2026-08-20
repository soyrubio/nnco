import { PRIMARY_LOGO } from "@/lib/brand-assets";

type DiscoveryBrandLogoProps = {
  priority?: boolean;
  variant?: "primary" | "alternate";
};

export function DiscoveryBrandLogo({
  priority = false,
  variant = "primary",
}: DiscoveryBrandLogoProps) {
  const source =
    variant === "alternate" ? "/assets/nnco-logo-alt.svg" : PRIMARY_LOGO.src;
  const width = variant === "alternate" ? 900 : PRIMARY_LOGO.width;

  return (
    <a
      className="wordmark"
      href="/"
      aria-label="NNCo. home"
      style={{ animation: "none", transform: "none", transition: "none" }}
    >
      <span
        className="wordmark__stage"
        aria-hidden="true"
        style={{ animation: "none", transform: "none", transition: "none" }}
      >
        <img
          className="wordmark-logo"
          src={source}
          alt=""
          width={width}
          height={PRIMARY_LOGO.height}
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "auto"}
          style={{ animation: "none", transform: "none", transition: "none" }}
        />
      </span>
    </a>
  );
}
