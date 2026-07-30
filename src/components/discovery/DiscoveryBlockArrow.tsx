type DiscoveryBlockArrowProps = {
  direction?: "left" | "right";
};

export function DiscoveryBlockArrow({
  direction = "right",
}: DiscoveryBlockArrowProps) {
  return (
    <span
      className={`nnco-arrow nnco-arrow--${direction}`}
      aria-hidden="true"
    />
  );
}
