# NNCO Astro design system

This is the canonical visual and interaction system for the NNCO Astro site.
It governs the marketing pages, editorial News surface, discovery canvas, and
print report.

## Design read

NNCO is an AI implementation company for regulated institutions in Czech and
Slovak markets. The visual language is restrained, editorial and institutional.
BrainCo is a category reference for proportion, typography and calm, not a
source to copy page by page.

- `DESIGN_VARIANCE: 7`
- `MOTION_INTENSITY: 3`
- `VISUAL_DENSITY: 3` on marketing pages
- `VISUAL_DENSITY: 3` in discovery

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
- While the shared header overlays the homepage hero, its surface is transparent
  with a strong 24px backdrop blur; the hero's existing top gradient keeps
  the white identity and navigation legible. After the hero, it returns to the
  paper surface. Other header states retain their assigned surfaces.
- Desktop navigation begins immediately after the logo rather than floating in
  the centre. Links form a loose, unnumbered text run near the header rule.
  Only the current section becomes a compact square tab whose background hugs
  the label and meets the 6px rule: paper on dark headers, ink on light ones.
  Inactive links remain plain text. Mobile keeps the menu and uses the same
  restrained text-hugging inversion for its current item.
- Every primary header ends with the shared 6px `nnco-header-rule`. The rule
  aligns to the content rail's inner edges, inherits the header colour, and
  sits below the navigation with the header's existing breathing room. It is
  never a viewport-edge border or a separate thin divider.
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
- `nnco-header-rule`: the single heavy rule primitive shared by the marketing
  header and discovery header.
- `BrandLogo`: official mark in a fixed 900×700 stage. Primary marks use the
  supplied Group 84-87 frames only on pointer hover or keyboard focus; the
  initial page state and alternate mark stay static.
- Header, hero, footer and discovery use the primary NNCO mark. The compact
  header and footer sizes remain fixed; only the hero mark uses the responsive
  60% scale.
- `BlockArrow`: official arrow asset used as a current-color CSS mask.
- `Button`: primary, secondary and quiet variants. Always full-pill.
- `Hero`: full-bleed visual with copy constrained to the common rail.
  Its opening cloud field is an eleven-state responsive frame sequence: 128×72
  desktop and 48×85 mobile WebP mosaics scale with nearest-neighbour rendering.
  Only frame one is preloaded; the remaining ten load behind the page cover,
  then hard-cut once with a calm ease-out cadence. Never ship the source MP4 or
  encode image bytes in JavaScript.
- `SectionFrame`: full-width background plus the shared content rail.
- `Footer`: shared rail and restrained identity/navigation groups.
- `DiscoveryCockpit`: one React island containing the complete six-chapter
  diagnostic, shared form/chat reducer, browser persistence, report preview,
  lead handoff and print export.
- `PageHero`: shared introduction for What We Do, Company and Contact.
- `CompanyAccordion`: native accessible disclosure groups.
- `ContactForm`: local validation, loading, failure and success simulation.
- `News`: an editorial feature and ruled reading queue, followed by narrow
  article pages, a key statement, related reading and a closing action.
- `Team`: sparse editorial profiles with matched light and dark monochrome
  portraits. Cards invert as one surface on hover and keyboard focus; images
  swap opacity without scaling or shifting.

## Discovery and report

- Discovery is one calm diagnostic canvas, not a dashboard or cockpit.
- The discovery workspace is canonical ink `#111111` with paper text
  `#f5f5f5`. Report pages remain paper artifacts on the dark workspace.
- The six chapters are Sector, Context, Current work, Problems, Outcome and
  boundaries, and Review. One dominant question is visible at a time.
- Sector is the first action and routes Banking, Insurance, Healthcare and
  general workflows into their relevant source options.
- Every step contains exactly one answer surface: either one choice set or one
  text field. Optional questions are normal skippable steps, never disclosures
  or accordions.
- Choice sets are one connected ruled stack: no gaps, no radio dots and no
  doubled borders. Unselected surfaces use canonical ink, while the selected
  surface inverts to paper.
- Text fields use one restrained rule for keyboard focus, never an exterior
  focus halo.
- Long diagnostic text fields keep a generous initial writing area with the
  first line resting near the bottom rule. They cannot be manually resized;
  instead, they grow with wrapped or entered text so answers use normal page
  scrolling and never an internal vertical scrollbar. The compact
  talk-it-through field keeps its independent sizing.
- Intake uses one top-anchored two-column composition inside the shared rail: a
  non-interactive six-section orientation index on the left and the active
  question on the right. Stable responsive top padding prevents questions of
  different heights from shifting the composition. The index is a loose
  vertical text list without numbering, dots, cards or rules. The active
  section gets a square paper highlight that hugs its text; inactive sections
  remain plain muted text. On narrow screens the index wraps compactly above
  the form without becoming a rigid grid. Long mobile content remains in
  normal flow.
- Do not show per-question counts, chapter fractions, case identifiers, status
  dots or an evidence ledger.
- Intake progress lives at the bottom and matches the shared header rule's rail
  and gutters exactly. `Progress` and its integer percentage form one normal
  left-aligned line above a square 6px rule. Its white fill follows the actual
  question position, is clamped to 10-100%, moves back when answers are
  truncated, and reaches 100% on Review. It rests at the viewport bottom when
  the question is short and follows genuinely long content without fixed
  positioning or overlap.
- Session persistence remains invisible. Do not show save state, save toggles
  or reset controls in the intake.
- Sector query parameters initialise a new case but never overwrite restored
  progress.
- Analysis is a full black transition with the hard-cut block loader and three
  plain processing statements.
- The first two report pages are useful before contact: page one is the
  operational diagnosis and page two contains three priorities. The lead form
  sits inline after both pages.
- The unlocked report adds two paper pages: compact solution routes, then the
  recommended next step, delivery model and 90-day roadmap.
- Browser print is the only PDF exporter. Print CSS produces exactly two preview
  pages or four unlocked pages and excludes intake and lead controls. Displayed
  user copy is bounded for A4 without changing the underlying diagnostic.
- Structural panels stay square. Interactive action buttons are the only
  rounded controls.

## Motion and accessibility

- Motion exists only for interaction feedback and state transitions.
- Discovery questions use a keyed 300ms opacity and 8px horizontal entry:
  forward arrives from the right and Back arrives from the left. There is no
  scale, bounce, stagger or option-selection motion.
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
- The hero frame sequence plays once after the page cover exits. It holds its
  first state for 100ms, then uses eleven hard states over 1.2s with increasing
  intervals. It never loops, crossfades, pans or scales.
- Respect `prefers-reduced-motion`.
- Keep persistent labels above fields.
- Never use placeholder text as the only label.
- Text, borders, focus styles and form states must meet WCAG AA contrast.
- The form and chat must feed one canonical state. Neither is a second funnel.
