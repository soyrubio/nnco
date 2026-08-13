import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { FAVICON_ASSET, PRIMARY_LOGO } from "../src/lib/brand-assets.ts";

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
    }).map(async ([name, path]) => [
      name,
      await readFile(new URL(path, import.meta.url), "utf8"),
    ]),
  ),
);

test("Group 97 is the safe versioned canonical primary identity", () => {
  assert.deepEqual(PRIMARY_LOGO, {
    src: "/assets/nnco-logo-group-97.svg",
    width: 700,
    height: 700,
  });
  assert.equal(FAVICON_ASSET, "/assets/nnco-favicon-group-97.svg");
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
    /^<svg width="32" height="32" viewBox="0 0 700 700" fill="none"/,
  );
  assert.match(sources.faviconAsset, /<rect width="700" height="700" fill="black"\/>/);
  assert.equal(sources.faviconAsset.match(/<path\b/g)?.length, 4);
  assert.equal(sources.faviconAsset.match(/fill="white"/g)?.length, 4);
  assert.doesNotMatch(
    sources.faviconAsset,
    /<script|<foreignObject|<iframe|<image|<use|\son[a-z]+=|javascript:|data:|xlink:href|\shref=|@import|url\(/i,
  );
});

test("all live primary logo consumers share one static source", () => {
  assert.match(sources.astroLogo, /import \{ PRIMARY_LOGO \} from "@\/lib\/brand-assets";/);
  assert.match(sources.astroLogo, /: PRIMARY_LOGO\.src;/);
  assert.match(sources.astroLogo, /PRIMARY_LOGO\.width/);
  assert.match(sources.discoveryLogo, /import \{ PRIMARY_LOGO \} from "@\/lib\/brand-assets";/);
  assert.match(sources.discoveryLogo, /: PRIMARY_LOGO\.src;/);
  assert.match(sources.layout, /import \{ FAVICON_ASSET, PRIMARY_LOGO \} from "@\/lib\/brand-assets";/);
  assert.match(sources.layout, /logo: new URL\(PRIMARY_LOGO\.src, siteOrigin\)\.toString\(\)/);
  assert.match(sources.layout, /<link rel="icon" type="image\/svg\+xml" href=\{FAVICON_ASSET\} \/>/);

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
