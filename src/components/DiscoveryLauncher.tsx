import type { ReactNode } from "react";
import { DiscoveryRelease } from "./DiscoveryRelease";

export function DiscoveryLauncher({ children }: { children: ReactNode }) {
  return <DiscoveryRelease introGlyph={children} />;
}
