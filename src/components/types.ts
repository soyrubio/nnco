export interface LinkAction {
  href: string;
  label: string;
  variant?: "primary" | "secondary" | "quiet";
  arrow?: boolean;
  ariaLabel?: string;
}
