# NNCO Astro design system

This is the canonical visual and interaction system for the NNCO Astro site.
It governs the marketing pages, editorial News surface, discovery cockpit, and
print report.

## Design read

NNCO is an AI implementation company for regulated institutions in Czech and
Slovak markets. The visual language is restrained, editorial and institutional.
BrainCo is a category reference for proportion, typography and calm, not a
source to copy page by page.

- `DESIGN_VARIANCE: 7`
- `MOTION_INTENSITY: 3`
- `VISUAL_DENSITY: 3` on marketing pages
- `VISUAL_DENSITY: 5` in discovery

## Core tokens

```css
--ink: #111111;
--ink-soft: #2d2d2d;
--paper: #f5f5f5;
--surface: #e5e5e5;
--surface-strong: #d7d7d7;
--muted: #4d4d4d;
--rule: rgba(17, 17, 17, 0.18);
--content-max: 1440px;
--radius-structural: 0;
--radius-button: 999px;
```

Geist is the only interface font. Use weight and scale for hierarchy. Do not
introduce a serif, monospace display face or ornamental font.

## Layout

- Background fields span the viewport.
- All meaningful content uses the same centered 1440px rail.
- The header, hero copy, sections and footer share the rail and responsive
  gutters.
- Desktop composition may be asymmetric. Every multi-column component collapses
  to one column below 768px.
- Header height is 80px on desktop and 72px on mobile.
- Section spacing is generous. Use borders and whitespace before adding cards.

## Shape rule

The structure is deliberately blocky:

- panels, cards, sections, fields, choice controls and report surfaces are
  square;
- there are no shadows, glass effects or decorative soft containers;
- the reusable `Button` component is the only fully rounded component;
- status tags may become compact pills later only when they represent real
  state.

## Components

- `BaseLayout`: metadata, Geist loading and global tokens.
- `Header`: large official NNCO mark, single-line navigation and one CTA.
- `BrandLogo`: official mark in a fixed 900×700 stage. Primary marks use the
  supplied Group 84–87 interaction frames; the alternate mark stays static.
- Header, hero, footer and discovery use the primary NNCO mark. The compact
  header and footer sizes remain fixed; only the hero mark uses the responsive
  60% scale.
- `BlockArrow`: official arrow asset used as a current-color CSS mask.
- `Button`: primary, secondary and quiet variants. Always full-pill.
- `Hero`: full-bleed visual with copy constrained to the common rail.
- `SectionFrame`: full-width background plus the shared content rail.
- `Footer`: shared rail and restrained identity/navigation groups.
- `DiscoveryCockpit`: one React island containing the complete progressive
  diagnostic, shared form/chat reducer, browser persistence, report preview,
  lead handoff and print export.
- `PageHero`: shared introduction for What We Do, Company and Contact.
- `CompanyAccordion`: native accessible disclosure groups.
- `ContactForm`: local validation, loading, failure and success simulation.
- `News`: an editorial feature and ruled reading queue, followed by narrow
  article pages, a key statement, related reading and a closing action.

## Discovery and report

- Guided form and agent conversation write to one serializable snapshot.
- Sector query parameters initialise a new case but never overwrite restored
  progress.
- The first two report pages are available before contact. Pages 3–6 unlock
  only after the same-origin lead endpoint confirms the case.
- Browser print is the PDF exporter. Print CSS produces A4 pages and excludes
  cockpit controls, the locked-page treatment and lead dialog.
- Structural panels stay square. Interactive action buttons are the only
  rounded controls.

## Motion and accessibility

- Motion exists only for interaction feedback and state transitions.
- Reveals travel 6px over 900ms with 50ms group staggering and
  `cubic-bezier(.2, 0, 0, 1)`.
- The hero header begins 16px above its resting position. Opacity and surface
  changes take 560ms; its transform takes 760ms.
- Ordinary link and BlockArrow feedback takes 260ms with 1px arrow travel.
  General button and colour feedback takes 280ms.
- The sector Group 82/83 arrows occupy one fixed box and hard-switch
  visibility. They never scale, crossfade or tween.
- The primary logo plays Group 84 → 85 → 86 → 87 → 84 once at 240ms hard
  cuts on pointer hover or keyboard focus, then holds. It resets only after
  both pointer and focus leave.
- The page loader remains an independent hard-cut sequence at 240ms per frame,
  with a 3s minimum cover and 240ms overlay exit.
- Respect `prefers-reduced-motion`.
- Keep persistent labels above fields.
- Never use placeholder text as the only label.
- Text, borders, focus styles and form states must meet WCAG AA contrast.
- The form and chat must feed one canonical state. Neither is a second funnel.
