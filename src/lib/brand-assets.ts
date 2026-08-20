export const PRIMARY_LOGO = {
  src: "/assets/nnco-logo-group-97.svg",
  width: 700,
  height: 700,
} as const;

export const FAVICON_ASSETS = {
  ico: "/favicon.ico",
  png32: "/favicon-32x32.png",
  svg: "/assets/nnco-favicon-group-97.svg?v=2",
  appleTouch: "/apple-touch-icon.png",
  safariMask: PRIMARY_LOGO.src,
  manifest: "/site.webmanifest",
} as const;

export const FAVICON_ASSET = FAVICON_ASSETS.svg;
