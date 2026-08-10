const normalizeNavigationPathname = (pathname: string) => {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized || "/";
};

export const isExactNavigationPage = (
  currentPathname: string,
  href: string,
) =>
  normalizeNavigationPathname(currentPathname) ===
  normalizeNavigationPathname(href);

export const isNavigationSection = (
  currentPathname: string,
  href: string,
) => {
  const current = normalizeNavigationPathname(currentPathname);
  const section = normalizeNavigationPathname(href);

  return current === section || (section !== "/" && current.startsWith(`${section}/`));
};
