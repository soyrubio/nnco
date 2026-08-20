import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  FAVICON_ASSET,
  FAVICON_ASSETS,
  PRIMARY_LOGO,
} from "../src/lib/brand-assets.ts";

const sources = Object.fromEntries(
  await Promise.all(
    Object.entries({
      astroLogo: "../src/components/BrandLogo.astro",
      discoveryLogo: "../src/components/discovery/DiscoveryBrandLogo.tsx",
      layout: "../src/layouts/BaseLayout.astro",
      globalStyles: "../src/styles/global.css",
      discoveryStyles: "../src/styles/discovery.css",
      design: "../DESIGN.md",
      primaryAsset: "../public/assets/nnco-logo-group-97.svg",
      faviconAsset: "../public/assets/nnco-favicon-group-97.svg",
      maskableAsset: "../public/assets/nnco-icon-maskable-group-97.svg",
      manifest: "../public/site.webmanifest",
    }).map(async ([name, path]) => [
      name,
      await readFile(new URL(path, import.meta.url), "utf8"),
    ]),
  ),
);

const binaryAssets = Object.fromEntries(
  await Promise.all(
    Object.entries({
      ico: "../public/favicon.ico",
      png32: "../public/favicon-32x32.png",
      appleTouch: "../public/apple-touch-icon.png",
      icon192: "../public/assets/nnco-icon-192.png",
      icon512: "../public/assets/nnco-icon-512.png",
      maskable512: "../public/assets/nnco-icon-maskable-512.png",
    }).map(async ([name, path]) => [
      name,
      await readFile(new URL(path, import.meta.url)),
    ]),
  ),
);

const pngDimensions = (image) => ({
  width: image.readUInt32BE(16),
  height: image.readUInt32BE(20),
});

test("Group 97 is the safe versioned canonical primary identity", () => {
  assert.deepEqual(PRIMARY_LOGO, {
    src: "/assets/nnco-logo-group-97.svg",
    width: 700,
    height: 700,
  });
  assert.equal(FAVICON_ASSET, "/assets/nnco-favicon-group-97.svg?v=2");
  assert.deepEqual(FAVICON_ASSETS, {
    ico: "/favicon.ico",
    png32: "/favicon-32x32.png",
    svg: "/assets/nnco-favicon-group-97.svg?v=2",
    appleTouch: "/apple-touch-icon.png",
    safariMask: "/assets/nnco-logo-group-97.svg",
    manifest: "/site.webmanifest",
  });
  assert.equal(
    createHash("sha256").update(sources.primaryAsset).digest("hex"),
    "63d77d680321f40caf2982339770d67bdfbcda826833d7d1c54d3d59b2b4811f",
  );
  assert.match(
    sources.primaryAsset,
    /^<svg width="700" height="700" viewBox="0 0 700 700" fill="none"/,
  );
  assert.equal(sources.primaryAsset.match(/<path\b/g)?.length, 4);
  assert.equal(sources.primaryAsset.match(/fill="black"/g)?.length, 4);
  assert.doesNotMatch(
    sources.primaryAsset,
    /<script|<foreignObject|<iframe|<image|<use|\son[a-z]+=|javascript:|data:|xlink:href|\shref=|@import|url\(/i,
  );
});

test("the versioned favicon keeps Group 97 visible on a black tile", () => {
  assert.match(
    sources.faviconAsset,
    /^<svg width="700" height="700" viewBox="0 0 700 700" fill="none"/,
  );
  assert.match(
    sources.faviconAsset,
    /<rect width="700" height="700" fill="#111111"\/>/,
  );
  assert.match(
    sources.faviconAsset,
    /<g transform="translate\(56 56\) scale\(0\.84\)">/,
  );
  assert.equal(sources.faviconAsset.match(/<path\b/g)?.length, 4);
  assert.equal(sources.faviconAsset.match(/fill="#F5F5F5"/g)?.length, 4);
  assert.doesNotMatch(
    sources.faviconAsset,
    /<script|<foreignObject|<iframe|<image|<use|\son[a-z]+=|javascript:|data:|xlink:href|\shref=|@import|url\(/i,
  );
});

test("favicon fallbacks cover browser tabs, Apple touch icons and install masks", () => {
  assert.equal(binaryAssets.ico.readUInt16LE(0), 0);
  assert.equal(binaryAssets.ico.readUInt16LE(2), 1);
  assert.equal(binaryAssets.ico.readUInt16LE(4), 3);
  assert.deepEqual(
    [0, 1, 2].map((index) => [
      binaryAssets.ico.readUInt8(6 + index * 16),
      binaryAssets.ico.readUInt8(7 + index * 16),
    ]),
    [[16, 16], [32, 32], [48, 48]],
  );

  assert.deepEqual(pngDimensions(binaryAssets.png32), {
    width: 32,
    height: 32,
  });
  assert.deepEqual(pngDimensions(binaryAssets.appleTouch), {
    width: 180,
    height: 180,
  });
  assert.deepEqual(pngDimensions(binaryAssets.icon192), {
    width: 192,
    height: 192,
  });
  assert.deepEqual(pngDimensions(binaryAssets.icon512), {
    width: 512,
    height: 512,
  });
  assert.deepEqual(pngDimensions(binaryAssets.maskable512), {
    width: 512,
    height: 512,
  });
  assert.match(
    sources.maskableAsset,
    /<g transform="translate\(126 126\) scale\(0\.64\)">/,
  );

  const manifest = JSON.parse(sources.manifest);
  assert.deepEqual(
    manifest.icons.map(({ src, sizes, type, purpose }) => ({
      src,
      sizes,
      type,
      purpose,
    })),
    [
      {
        src: "/assets/nnco-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/nnco-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/assets/nnco-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  );
});

test("all live primary logo consumers share one static source", () => {
  assert.match(sources.astroLogo, /import \{ PRIMARY_LOGO \} from "@\/lib\/brand-assets";/);
  assert.match(sources.astroLogo, /: PRIMARY_LOGO\.src;/);
  assert.match(sources.astroLogo, /PRIMARY_LOGO\.width/);
  assert.match(sources.discoveryLogo, /import \{ PRIMARY_LOGO \} from "@\/lib\/brand-assets";/);
  assert.match(sources.discoveryLogo, /: PRIMARY_LOGO\.src;/);
  assert.match(sources.layout, /import \{ FAVICON_ASSETS, PRIMARY_LOGO \} from "@\/lib\/brand-assets";/);
  assert.match(sources.layout, /logo: new URL\(PRIMARY_LOGO\.src, siteOrigin\)\.toString\(\)/);
  assert.match(
    sources.layout,
    /rel="icon"[\s\S]*?FAVICON_ASSETS\.ico[\s\S]*?16x16 32x32 48x48/,
  );
  assert.match(
    sources.layout,
    /rel="icon"[\s\S]*?image\/svg\+xml[\s\S]*?FAVICON_ASSETS\.svg[\s\S]*?sizes="any"/,
  );
  assert.match(
    sources.layout,
    /rel="apple-touch-icon"[\s\S]*?FAVICON_ASSETS\.appleTouch[\s\S]*?180x180/,
  );
  assert.match(sources.layout, /rel="mask-icon"[\s\S]*?color="#111111"/);
  assert.match(
    sources.layout,
    /rel="manifest" href=\{FAVICON_ASSETS\.manifest\}/,
  );

  for (const source of [sources.astroLogo, sources.discoveryLogo]) {
    assert.doesNotMatch(source, /nnco-logo-condensed-frame|ANIMATION_FRAMES|animationFrames/);
    assert.doesNotMatch(source, /isAnimating|data-logo-frame|data-brand-logo-animation/);
  }
  assert.doesNotMatch(sources.astroLogo, /<script>/);
});

test("compact placements preserve their old footprint without distorting Group 97", () => {
  assert.match(
    sources.globalStyles,
    /\.nnco-navbar-rail > \.brand-logo \.brand-logo__stage\s*\{[^}]*width:\s*61\.7142857px;[^}]*height:\s*var\(--header-logo-height\);/s,
  );
  assert.match(
    sources.globalStyles,
    /\.brand-logo__stage\s*\{[^}]*width:\s*49\.3714286px;[^}]*height:\s*48px;/s,
  );
  assert.match(
    sources.globalStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.nnco-navbar-rail > \.brand-logo \.brand-logo__stage\s*\{[^}]*width:\s*53\.4857143px;/s,
  );
  assert.match(
    sources.globalStyles,
    /\.brand-logo img\s*\{[^}]*width:\s*100%;[^}]*height:\s*100%;[^}]*object-fit:\s*contain;/s,
  );
  assert.match(sources.globalStyles, /\.site-header--over-hero \.brand-logo img\s*\{[^}]*filter:\s*brightness\(0\) invert\(1\);/s);
  assert.match(sources.discoveryStyles, /\.discovery-preview-toolbar \.wordmark-logo\s*\{[^}]*object-fit:\s*contain;[^}]*filter:\s*invert\(1\);/s);
  assert.doesNotMatch(sources.globalStyles, /\.brand-logo__frame|\.brand-logo\.is-animating/);
  assert.doesNotMatch(sources.discoveryStyles, /wordmark-logo--frame|wordmark\.is-animating/);
});

test("design contract names the static Group 97 identity", () => {
  assert.match(
    sources.design,
    /canonical primary identity is the static 700×700 Group 97\s+SVG/,
  );
  assert.match(sources.design, /Pointer hover and keyboard focus never\s+swap its identity/);
  assert.doesNotMatch(sources.design, /Group 84 → 85 → 86 → 87/);
});
