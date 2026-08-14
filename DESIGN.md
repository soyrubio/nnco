# NNCO Astro design system

This is the canonical visual and interaction system for the NNCO Astro site.
It governs the marketing pages, editorial Blog surface, discovery canvas, and
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
--faint: #606060;
--rule: rgba(17, 17, 17, 0.18);
--content-max: 1440px;
--structural-rule-thickness: 5px;
--page-hero-height: clamp(40rem, 80dvh, 56rem);
--dark-section-margin-block: clamp(2rem, 3vw, 3rem);
--dark-section-padding-block: clamp(6rem, 11vw, 10rem);
--radius-structural: 0;
--radius-button: 999px;
```

The default typeface is the established Helvetica Neue, Helvetica and Arial
stack. The visible native selector may switch the shared type token to the
locally hosted static Ronzino family or to Google Fonts' variable Geist or
Poppins family. Do not introduce another interface face, a serif, monospace
display face or ornamental font.

## Typography

The shared marketing scale is semantic rather than component-specific. Use the
existing type tokens before adding a local size:

- small and metadata: 14px, medium, 1.4 line-height;
- controls and primary navigation: 16px with compact line-height; controls use
  medium weight and navigation uses regular weight;
- body: 17px, regular, 1.55 line-height;
- large body: 17–19px, regular, 1.55–1.65 line-height;
- item headings: 18–24px, medium, 1.25 line-height;
- section headings: 22–28px, medium, 1.1 line-height;
- card headings: 24–36px, medium, 1.1 line-height;
- displays: responsive and component-specific, medium, tightly tracked with a
  0.98 line-height.

Only the available 400, 500 and 700 weights are valid. Regular is for reading,
medium is for labels, controls and headings, and bold is reserved for genuine
emphasis or hierarchy. Primary navigation is the deliberate regular-weight
exception. Do not use fractional numeric weights because the local Ronzino
family has only those three static faces. Specific editorial and hero components
may keep their own responsive sizes, but they inherit the shared weight,
tracking and leading roles.

Discovery owns a compact scoped scale: 14px medium for small interface text,
16px regular for body text and 17px for emphasized body copy. Its on-screen
report uses 13px labels, 14px metadata and 15px body copy. The print report is
the deliberate exception: its fixed A4 measurements and pagination geometry
remain explicit and must not inherit screen-size changes. Its typeface still
inherits the shared `--font-sans` token.

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
  the centre. Links form a loose, unnumbered text run and remain vertically
  centred with the Start diagnosis action in the unchanged 80px header. Primary
  navigation labels use the 16px control size at regular weight.
  Only the current section becomes a compact square tab whose background hugs
  the label: paper on dark headers, ink on light ones. Inactive links remain
  plain text. Mobile keeps the menu and uses the same restrained text-hugging
  inversion for its current item.
- Every primary header ends with the shared 5px `nnco-header-rule`. The rule
  aligns to the content rail's inner edges, inherits the header colour, and
  sits below the navigation with the header's existing breathing room. It is
  never a viewport-edge border or a separate thin divider. The header's layer
  model keeps this decorative rule below content and navigation overlays.
- Section spacing is generous. Use borders and whitespace before adding cards.
- Mid-page black sections use the shared full-width dark `SectionFrame`. Paper
  remains visible above and below each section, while the content inside the
  black field receives a larger vertical inset than a standard white section.
- Do not use eyebrow or overline labels above page or section titles. Each
  approved title must carry the section meaning on its own.
- `PageHero` has no bottom divider; whitespace creates the transition into the
  first content section. Its content is anchored to the bottom of the shared
  hero height with a restrained responsive inset.
- Every `SectionAnatomy` begins with the shared strong 5px rule. The rule is
  structural and cannot be disabled by individual pages.
- `SectionAnatomy` may explicitly allocate 50%, 75% or 100% of its desktop row
  to content. The 50% option creates equal columns, 75% creates a 1:3 title to
  content split, and 100% places the title above full-width content. All three
  collapse to the canonical single-column mobile flow.
- From 768px upward, the complete heading wrapper in every multi-column
  `SectionRow` is sticky below the 80px header at
  `calc(var(--header-height) + 1.5rem)`. Its own grid row bounds the sticky
  state so the heading releases with the section. Full-width
  `SectionAnatomy contentWidth="100"` headings and all mobile headings remain
  in normal flow. This behavior is pure CSS and has no animation.
- Except on the not-found route, the single section immediately before the
  footer uses `TerminalSection`.
  Its grey background spans the full viewport width while its content row is
  constrained to the content rail, exactly matching the horizontal endpoints
  of a section rule. It composes the same `SectionAnatomy`, opaque 5px rule and
  vertical spacing as a white section.
- Decorative card and article numbering is not used. Numbers remain only when
  they communicate real order, progress or report structure.
- Page and section titles are concise labels, not sentences. Do not use
  trailing punctuation.

## Shape rule

The structure is deliberately blocky:

- panels, cards, sections, fields, choice controls and report surfaces are
  square;
- there are no shadows, glass effects or decorative soft containers;
- the reusable `Button` component is the only fully rounded component;
- status tags may become compact pills later only when they represent real
  state.

## Components

- `BaseLayout`: metadata, early allowlisted typeface preference bootstrap,
  remote Geist loading, global tokens and the single site-wide font utility.
  The default root has no font data attribute and renders Helvetica;
  `html[data-font="ronzino"]`, `html[data-font="geist"]` and
  `html[data-font="poppins"]` are the only alternate states.
- `Header`: large official NNCO mark, single-line navigation and one CTA.
  Primary navigation labels use the 16px control size at regular weight; the
  active tab remains regular because its inverted surface supplies emphasis.
  Dropdown controls hard-switch between the outlined Google Material Symbols
  `keyboard_arrow_down` and `keyboard_arrow_up`; interface text inherits the
  shared typeface token. Desktop dropdown panels stay compact, with typography
  close to the navigation scale rather than page-heading scale. Their surface
  follows the header tone: paper with ink text on light headers, and ink with
  paper text on dark or transparent hero headers. Hover and current items
  invert within that active palette. Desktop controls are vertically centred;
  dropdown panels and their pointer bridge share one 0.75rem offset.
- `DisclosureChevron`: the shared, decorative Material Symbols down/up pair for
  native header and FAQ disclosures. Open state hard-switches the glyph without
  rotation, fading or motion.
- `nnco-header-rule`: the single heavy rule primitive shared by the marketing
  header and discovery header.
- `BrandLogo`: the canonical primary identity is the static 700×700 Group 97
  SVG. Compact placements retain the previous 720×700 outer footprint without
  stretching the square artwork: 60px high in the desktop header, 52px in the
  mobile header and 48px in the footer. The discovery report toolbar keeps its
  existing fixed box. Dark placements invert the same black source mark.
- Header, footer, discovery and Organization metadata use that one versioned
  primary asset. The favicon uses the same geometry as a white mark on a black
  tile. Alternate legacy marks remain separate and are not primary fallbacks.
- `BlockArrow`: official arrow asset used as a current-color CSS mask.
- `Button`: primary, secondary and quiet variants. Always full-pill.
- `Hero`: full-bleed visual with copy constrained to the common rail.
  Its opening cloud field is an eleven-state responsive frame sequence: 128×72
  desktop and 48×85 mobile WebP mosaics scale with nearest-neighbour rendering.
  Only frame one is preloaded; the remaining ten load behind the page cover,
  then hard-cut according to the hero's scroll progress. Never ship the source
  MP4 or encode image bytes in JavaScript.
- `SectionFrame`: full-width paper or dark background plus the shared content
  rail. A dark frame remains full-bleed horizontally, adds the shared paper
  margin above and below, and uses the larger dark-section content padding.
- `TerminalSection`: the reusable pre-footer section. Its grey background spans
  the viewport while its shared section anatomy stays on the rule-aligned
  content rail.
- Company Client confidentiality uses the same full-width dark `SectionFrame`
  and ruled `SectionAnatomy` composition as Private AI. It preserves the shared
  content rail and standard one-column mobile collapse.
- Company Implementation gap remains one standard ruled section. Its enlarged
  opening paragraph uses a loose 1.2 line-height and -0.035em
  tracking. A generous responsive 3.5rem to 6rem gap separates it from the two
  supporting paragraphs below, which sit in a sharp grey panel contained
  entirely by the section's right content column. Inside that panel,
  copy takes 60% and the implementation glyph takes 40%; both collapse to one
  column below 768px. The supplied implementation glyph builds a 3x3 field
  from the Group 97 cell geometry: its top-left 2x2 cells are solid ink and the
  five cells completing the right and bottom edges use `--ink-soft` outlines
  with a 4-unit SVG stroke. Its desktop height follows the adjacent copy rather
  than imposing a separate row height.
- `Footer`: shared rail and restrained identity/navigation groups.
- `FontSwitcher`: one compact, fixed bottom-right utility rendered visibly by
  `BaseLayout` on every route, including Discovery. Its `Typeface` label
  controls a native selector. `Helvetica` is the default; `Ronzino`, `Geist`
  and `Poppins` persist as optional allowlisted local preferences without
  animation. It stays inside the page-loader inert boundary, below blocking
  overlays and the navigation layer, uses responsive safe insets and does not
  print.
- `DiscoveryLauncher`: mounts the stateful release diagnostic. `DiscoveryRelease`
  owns website enrichment, five routed questions, the final contact gate, AI
  analysis and the two-page print artifact.
- `PageHero`: shared introduction for non-home marketing and index pages. It
  uses a consistent `clamp(40rem, 80dvh, 56rem)` minimum height and contains a
  title, introduction and optional actions. Its content is bottom-aligned.
- `EditorialCard`: shared text card for standard content and large industry
  panels. All cards use generous responsive internal padding. Titles and
  descriptions align to the top. An optional modular glyph sits above the copy.
  An optional `href` changes the semantic root from `article` to `a` and pins
  the outlined Material Symbols `arrow_forward` affordance to the bottom without
  shifting the copy. Every linked card uses this same current-colour arrow.
  Hover and keyboard focus invert the complete card surface, including its
  copy, arrow and any modular glyph.
- `EditorialCardLayer`: the only layout wrapper for editorial cards.
  Its `surface` property selects either grey `solid` cards with a real gap or a
  transparent `bordered` grid with connected single-width rules and no gap.
  The `colSize` prop accepts one, two or three desktop columns, reduces a
  three-column layer to two columns at tablet width and collapses every layer
  to one column below 768px. Company’s How we work section uses the same
  one-column solid grey treatment as the homepage card sequences and reuses the
  homepage What we build glyphs in source order. Because Company has four cards
  and Home has three glyphs, the fourth card repeats the first glyph.
- `FaqList`: the shared native question-and-answer disclosure list.
  `FaqSection` wraps it in the standard section composition. Questions remain
  unnumbered, only one answer opens at a time, and the same keyboard and focus
  behaviour applies on every page. Item
  separators use the shared opaque 2.5px black content rule also used in
  Contact's Direct section. The first summary alone omits top padding; later
  rows keep their normal separator spacing without a fixed minimum height.
  Opening an answer adds only the answer's intentional gap.
- `ExpandedDetailList`: the reusable always-visible title-and-body stack used by
  programme templates. Items
  use the shared opaque 2.5px black separator. Their semantic `h3` titles reuse
  the parent section `h2` size token with the slightly softer ink colour,
  without changing unrelated headings. Its parent uses
  `SectionAnatomy contentWidth="50"` to divide title and content into equal
  desktop columns while retaining the shared one-column collapse at 767px.
  Optional image or icon media renders above its
  title and requires explicit source dimensions and alt text; no placeholder
  media is invented.
- `ModularGlyph`: the static abstract-mark primitive used when an
  `EditorialCard` needs a small visual signature. Marks are authored
  as integer cell coordinates on a 4×4 grid and rendered as optically centred
  inline SVG, never as raster exports. A glyph uses 5 to 9 equal square cells,
  one fill (`currentColor`), no stroke and no animation. Every mark declares
  and satisfies one symmetry rule: horizontal, vertical, 180-degree rotational
  or top-left to bottom-right diagonal. A related set keeps the same cell size
  and gap, varying only the arrangement and symmetry rule. Patterns should
  suggest topology, sequence, clustering or separation without becoming
  literal interface icons, letters or alternate logos. Decorative marks stay
  hidden from assistive technology; only a mark that adds non-redundant meaning
  receives an accessible label.
- `PrivateAiBoundary`: the decorative isometric scene shared by the Home and
  Private AI dark sections. Three filled monochrome planes form a visible cube.
  The core cube has no outline. Three identically sized black planes enter one
  by one along equal radial axes and replace it. Each wrapping plane's outline
  begins at the exact monochrome value of its matching core face, then
  brightens continuously to white over its own entry. The completed outlines
  resolve into one clean wireframe at rest.
  Each final cube edge is rendered once and uses rounded joins only to prevent
  raster artefacts at acute and three-way intersections. The scene is hidden
  from assistive technology. Its shared dark-section composition gives copy 60%
  and the glyph 40% of the available inner row before collapsing to one column
  on mobile.
- `ContactForm`: local validation and a same-origin handoff into the shared lead repository.
  Contact composes Mutual NDA inside the Direct section after both email rows,
  keeps FAQ in the shared standalone section, and uses this form as its sole
  terminal grey section. Its repeated labels and error slots use reusable Astro
  form-control components; native controls remain transparent with one bottom
  rule and explicit focus, invalid, disabled and autofill states.
- `Blog`: an editorial feature and ruled reading queue backed by the typed
  `blog` content collection. Each post is a Markdown file loaded through
  Astro's glob loader. The filename defines the slug, while required `title`
  frontmatter is the single source for the hero `h1`, page metadata, lists and
  schema. Required `summary` frontmatter is repeated as the
  opening Markdown paragraph. The Markdown body contains no `h1` and continues
  with normal `h2`/`h3` hierarchy and links. `ArticleProse` scopes Markdown
  element typography. Queue
  rows stay flush to the content rail with no movement, transition or surface
  change on hover. Keyboard focus uses the shared visible outline without
  changing the row surface. Their dates are a deliberate metadata exception:
  12px, sentence case, and formatted as a long English date such as
  `6 August 2026`. Each article places its title alone in the shared PageHero.
  The ruled content rail below uses two desktop columns: publication date,
  author and an All posts button with a backward arrow on the left, and only
  Markdown on the right. At 767px and below metadata moves above the full-width
  body. The shared Start here terminal section and footer follow the article.
- `Team`: sparse text-only editorial profiles in the shared ruled grid. The
  desktop grid uses three columns and collapses to one at 767px; profiles have
  no portrait swap or interactive card inversion.

## Discovery and report

- Discovery is one calm diagnostic canvas, not a dashboard or cockpit.
- The discovery workspace is canonical ink `#111111` with paper text
  `#f5f5f5`. Report pages remain paper artifacts on the dark workspace.
- The public company website is the preferred first input, not a requirement.
  The server reads no more than three public same-host pages and then shows the
  interpreted company name, sector, public context and pages read on a calm
  confirmation screen before the questionnaire begins.
- A user who does not provide a website selects a sector instead. The manual
  path contains Sector, Workflow, Friction, Frequency, Systems and Controls;
  the website path contains Website followed by the same five diagnostic
  questions. Both paths therefore stay within six steps.
- Sector is inferred from public context or selected on the manual path and
  routes Banking, Insurance, Healthcare and general workflows into their
  relevant options.
- One dominant question and exactly one choice surface are visible at a time.
- Required free text is deliberately absent from the diagnostic. The website
  is the only text entry before the contact gate; the remaining five answers
  use single-select or multi-select options.
- Choice sets are one connected ruled stack: no gaps, no radio dots and no
  doubled borders. Unselected surfaces use canonical ink, while the selected
  surface inverts to paper.
- Text fields use one restrained rule for keyboard focus, never an exterior
  focus halo.
- Intake preserves the established two-column composition inside the shared
  rail: a stable six-step progress view on the left and the single active input
  or choice set on the right. Left-side step labels never carry subtitles. The
  5px bottom rule follows the active step, with progress text below the rule.
- Work email is required only after all six diagnostic steps. Organisation is
  taken from enriched context when available and recorded as not provided on
  the manual path. A public competitor comparison is an optional selection-only
  screen on the website path after the diagnostic; there is no competitor-name
  text field. The following contact screen contains only the work-email input.
  Its submit acknowledgement states the processing purpose, one-result
  follow-up, 90-day retention and the role of OpenAI before submission.
- Analysis is a full black transition with the hard-cut block loader and the
  approved activity statement. Do not use simulated timers or invented stages.
- The result is exactly two useful pages: what NNCO understood and where to act.
  Report claims distinguish reported answers, public facts and inference.
  Competitor notes appear only when requested and include direct public sources.
- Browser print is the only PDF exporter. Print CSS produces exactly two A4
  pages and excludes intake, toolbar and contact controls. Displayed copy is
  bounded for A4 without changing the stored diagnostic.
- Discovery and its print report consume the same `--font-sans` token as the
  marketing site, including default Helvetica and persisted optional Ronzino,
  Geist and Poppins selections.
- Structural panels stay square. Interactive action buttons are the only
  rounded controls.

## Motion and accessibility

- Motion exists only for interaction feedback and state transitions.
- Fades and crossfades are not used except for the shared navigation header's
  560ms background-colour transition and the Private AI scene's boundary
  handoff. Its grey-to-white boundary is the only scroll-linked colour
  interpolation; every other surface change remains instant.
- Discovery questions use a keyed 300ms horizontal entry only: forward
  arrives from the right and Back arrives from the left. There is no opacity,
  scale, bounce, stagger or option-selection motion.
- The hero header background changes over 560ms; its content and other state
  changes remain instant.
- BlockArrow feedback takes 260ms with 1px arrow travel. Button press feedback
  may translate by 1px; colour feedback is instant.
- The sector Group 82/83 arrows occupy one fixed box and hard-switch
  visibility. They never scale, crossfade or tween.
- The primary Group 97 logo is static. Pointer hover and keyboard focus never
  swap its identity or animate its geometry.
- The page loader remains an independent hard-cut sequence at 240ms per frame.
  It appears only once per browser session, with a 650ms minimum cover and an
  immediate overlay exit.
- The hero frame sequence is scrubbed through Motion's framework-independent
  DOM `scroll()` API. Frame one stays static at the page top; the eleven hard
  states advance evenly as the hero moves from `start start` to `end start`, and
  reverse when the user scrolls upward. The sequence never autoplays, loops,
  crossfades, pans or scales. Reduced-motion users remain on frame one.
- The Private AI boundary scene is scrubbed directly by scroll position through
  Motion's framework-independent DOM `scroll()` API. From the visual reaching
  40% entry to 90% entry, the black boundary planes enter from the top,
  lower-right and lower-left across successive overlapping progress ranges.
  Each wrapping plane carries an outline matching the brightness of the core
  face beneath it; that outline brightens to white over the plane's own travel.
  The core cube remains borderless, and the final combined wireframe begins
  after the last plane lands.
  Forward and reverse scrolling control the assembly directly; no React island
  or elapsed-time fallback is involved. Reduced-motion users receive the
  completed static boundary.
- Every viewport-triggered decorative animation removes its active state below
  its visibility threshold and replays when it crosses that threshold again.
  Page-load sequences and interaction state transitions keep their own
  lifecycle.
- Respect `prefers-reduced-motion`.
- Keep persistent labels above fields.
- Never use placeholder text as the only label.
- Text, borders, focus styles and form states must meet WCAG AA contrast.
- The form and chat must feed one canonical state. Neither is a second funnel.
