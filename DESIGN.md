# NNCo. Astro design system

This is the canonical visual and interaction system for the NNCo. Astro site.
It governs the marketing pages, editorial Blog surface, discovery canvas, and
print report.

## Design read

NNCo. is an AI implementation company for regulated institutions in Czech and
Slovak markets. The visual language is restrained, editorial and institutional.
BrainCo is a category reference for proportion, typography and calm, not a
source to copy page by page.

- `DESIGN_VARIANCE: 7`
- `MOTION_INTENSITY: 4`
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
--dark-body: #d0d0d0;
--fine-rule-thickness: 1px;
--content-max: 1440px;
--structural-rule-thickness: 5px;
--page-hero-height: clamp(40rem, 80dvh, 56rem);
--dark-section-margin-block: clamp(2rem, 3vw, 3rem);
--dark-section-padding-block: clamp(6rem, 11vw, 10rem);
--radius-structural: 0;
--radius-button: 999px;
```

Geist is the sole site typeface and owns the shared `--font-sans` token across
marketing, Discovery and print. Only its regular, medium and bold weights are
loaded. Do not introduce another interface face, a serif, monospace display
face or ornamental font.

## Typography

The shared marketing scale is semantic rather than component-specific. Use the
existing type tokens before adding a local size:

- small and metadata: 14px, medium, 1.4 line-height;
- controls and primary navigation: 16px with compact line-height; controls use
  medium weight and navigation uses regular weight;
- body: 17px, regular, 1.55 line-height;
- large body: 17–19px, regular, 1.55–1.65 line-height;
- item headings: 18–24px, medium, 1.25 line-height;
- section titles: 28-40px, medium, 1.1 line-height;
- nested detail headings: 22-28px, medium, 1.1 line-height;
- card headings: 24–36px, medium, 1.1 line-height;
- displays: responsive and component-specific, medium, tightly tracked with a
  0.98 line-height.

Only the available 400, 500 and 700 weights are valid. Regular is for reading,
medium is for labels, controls and headings, and bold is reserved for genuine
emphasis or hierarchy. Primary navigation is the deliberate regular-weight
exception. Do not use fractional numeric weights outside the loaded 400, 500
and 700 roles. Specific editorial and hero components may keep their own
responsive sizes, but they inherit the shared weight, tracking and leading
roles.

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
- Header height is 80px on desktop and 54px on mobile. The mobile Menu control
  retains a 44px minimum touch target inside that tighter row.
- The complete navigation surface, including the header row and any open
  dropdown, always shares one solid tone. It uses ink over the homepage hero
  and dark sections, and paper over light sections. On every marketing route,
  the shared header observes dark
  `SectionFrame` regions and switches to its ink surface with paper identity,
  navigation, rule and controls precisely while it overlaps them.
- Desktop navigation begins immediately after the logo rather than floating in
  the centre. Links form a loose, unnumbered text run and remain vertically
  centred with the header action in the unchanged 80px
  header. Primary navigation labels use the 16px control size at regular weight.
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
- By default, desktop `SectionAnatomy` uses a six-part row: two parts for its
  title and four parts for its content, expressed as a 2:4 grid after the
  shared inter-column gutter.
- Multi-column `SectionAnatomy` content begins with a shared 0.75rem top inset.
  Lists and forms reset their own first-item top padding so this single inset
  aligns Blog, FAQ, Direct and form content consistently. Full-width stacked
  sections are exempt because their row gap already supplies the separation.
- `SectionAnatomy` may explicitly allocate 50%, 75% or 100% of its desktop row
  to content. The 50% option creates equal columns, 75% creates a 1:3 title to
  content split, and 100% places the title above full-width content. The default
  and all three options collapse to the canonical single-column mobile flow.
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

- panels, cards, sections, fields, single-choice controls and report surfaces
  are square;
- there are no shadows, glass effects or decorative soft containers;
- the reusable `Button` component is the only fully rounded component;
- multi-select choices are compact full-pill controls because their wrapped
  grouping communicates that several options can be selected;
- status tags may become compact pills later only when they represent real
  state.

## Components

- `BaseLayout`: metadata, remote Geist loading and global tokens. Geist is the
  sole text typeface; there is no user preference state or typeface utility.
  Internal page navigation uses Astro's client router with an immediate,
  non-animated swap.
  The initial page cover does not replay between routes, and client-side
  behaviors reinitialize after each swap.
- `Header`: large official NNCo. mark, single-line navigation and one CTA.
  It links to Discovery as `Start diagnosis` when the feature is enabled and
  falls back to `Book a call` at `/contact` when it is disabled.
  Primary navigation labels use the 16px control size at regular weight; the
  active tab remains regular because its inverted surface supplies emphasis.
  Navigation dropdown controls omit decorative carets; interface text inherits
  the shared typeface token. On desktop, a dropdown reveals a full-viewport-width
  under-nav over the existing page content. Its content remains on the shared
  rail: the dropdown title occupies the left two-sixths and a vertical sequence
  of links occupies the right four-sixths. Each link keeps its concise
  description. Each row places its title above its description and keeps the
  card-style arrow vertically centred at the right edge. The description may
  use the full lower-row width available before the arrow.
  Link titles use the shared item-heading role and descriptions use regular
  body typography. Rows have no horizontal padding and only the
  interior boundaries carry a fine rule, leaving the first edge and final edge
  open. The panel ends with the same rail-aligned 5px separator as the header.
  Header and under-nav surfaces are always solid: paper with ink text on light
  headers and ink with paper text on dark headers. The homepage header is solid
  ink while it sits over the hero and switches to solid paper after scrolling.
  Current items keep
  the same presentation as every other row. Hover keeps the row surface
  unchanged, softens only its text and retains the shared card-style forward
  arrow on the right. Desktop dropdown
  buttons control one shared panel attached directly below the header's 5px
  separator. That placement makes the header edge itself the continuous pointer
  path and prevents the moving panel from painting over the logo or navigation
  row. The panel reveals from `0fr` to `1fr` over 300ms with an ease-in-out
  curve, then fades its contents in over 200ms with the same curve. Closing
  first fades the contents and then reverses the grid
  reveal, for a balanced 500ms sequence; reduced-motion users receive it
  instantly. Pointer and focus entry on either a trigger or the panel cancel the
  same pending close, while departure retains a short 120ms tolerance. Moving
  directly to another dropdown trigger keeps the shared panel open and swaps
  only its category content, without replaying the reveal. The outgoing copy
  fades for 90ms before the swap and the incoming copy resolves over 120ms.
  When the two categories have different natural heights, the shared clip interpolates
  between them over 300ms with an ease-in-out curve. Reduced-motion users keep
  the instant content and height change. The panel's bottom 5px separator is
  pinned to that moving clip edge and shares its surface, so the rule and
  background emerge as one edge beneath the header and travel together through
  both the opening panel and category-height changes.
  On phones, Menu uses the same full-width overlay, downward and upward motion,
  open outer list edges and rail-aligned bottom separator. Primary items remain
  flush to the content rail. Subitems use a smaller muted text role and move
  1.25rem to the right together with their top and interior fine separators,
  making the grouped hierarchy explicit without adding icons or decoration.
- `DisclosureChevron`: the shared, decorative Material Symbols down/up pair for
  FAQ disclosures. Open state hard-switches the glyph without
  rotation, fading or motion.
- `nnco-header-rule`: the single heavy rule primitive shared by the marketing
  header and discovery header.
- `BrandLogo`: the canonical primary identity is the static 700×700 Group 97
  SVG. Compact placements retain the previous 720×700 outer footprint without
  stretching the square artwork: 60px high in the desktop header, 40px in the
  mobile header and 48px in the footer. The discovery report toolbar keeps its
  existing fixed box. Dark placements invert the same black source mark.
- Header, footer, discovery and Organization metadata use that one versioned
  primary asset. Favicons keep the same geometry as a paper mark on an ink
  tile, with a small safe area so the mark remains legible at tab size and
  survives platform masks. SVG is the primary browser asset, backed by a
  multi-size ICO, 32px PNG, 180px Apple touch icon and manifest icons.
  Alternate legacy marks remain separate and are not primary fallbacks.
- `BlockArrow`: official arrow asset used as a current-color CSS mask.
- `Button`: primary, secondary and quiet variants. Always full-pill.
- `Hero`: full-bleed visual with copy constrained to the common rail.
  Its Discovery action renders only when the shared feature flag is enabled.
  Its full-viewport minimum uses `100vh`, `100svh` and `100dvh` in progressive
  order so Safari keeps a complete background when newer viewport units are
  unavailable while modern browsers follow the live visual viewport.
  Its opening cloud field is an eleven-state responsive frame sequence: 128×72
  desktop and 48×85 mobile WebP mosaics scale with nearest-neighbour rendering.
  Only frame one is preloaded; the remaining ten load behind the page cover,
  then hard-cut once after the page becomes ready. Frame holds lengthen from
  140ms to 300ms so the sequence settles progressively toward its final state.
  The sequence is independent of scroll and never loops. Never ship the source
  MP4 or encode image bytes in JavaScript.
- `SectionFrame`: full-width paper or dark background plus the shared content
  rail. A dark frame remains full-bleed horizontally, adds the shared paper
  margin above and below, and uses the larger dark-section content padding.
  Primary body paragraphs, hero introductions and list copy on every ink
  surface use the softer off-white `--dark-body`; titles, controls, rules and
  inverted highlight text retain the brighter paper colour. Truly secondary
  metadata and footer copy remain at the quieter dark-page muted value.
  The Private AI route is the deliberate exception: its entire page surface is
  dark, so its adjacent dark frames have no paper margins and use the standard
  section rhythm.
- `TerminalSection`: the reusable pre-footer section. Its grey background spans
  the viewport while its shared section anatomy stays on the rule-aligned
  content rail.
- Company Client confidentiality uses the standard full-width dark
  `SectionFrame` and ruled `SectionAnatomy` composition. The homepage Private AI
  section instead uses its titleless ruled 4/6 copy and 2/6 animation
  composition. Both preserve the shared content rail and standard one-column
  mobile collapse.
- Company opens with an unlabelled ruled thesis section whose enlarged copy
  occupies five-sixths of the desktop content rail and aligns to its right
  edge, leaving one-sixth empty on the left. It uses a 1.3 line-height,
  -0.035em tracking and inter-word
  justification. Five compact phrases use restrained inline inversion:
  discrete ink boxes with paper text, compact internal leading and enough
  vertical margin that adjacent boxes never touch. Neutral span wrappers avoid
  the browser's default yellow `mark` paint before styles load. The JavaScript
  animation-ready state is established in the document head before content can
  paint. Each time the thesis reaches the shared viewport threshold after fully
  leaving the viewport, fully opaque paper text starts completely below each
  paint-clipped ink box, then rises into place after a 280ms pause, over 820ms
  and staggered by 180ms. Reduced-motion
  users see the final static
  state. A separate standard
  Implementation gap section follows with the shared spacing and 5px rule. Its
  sticky title sits on the left and aligns with the supporting paragraphs on the
  right. The supporting copy uses the same shared large-body settings as
  standard editorial section copy and fills the available column width. Both
  sections collapse naturally on mobile. There is no separate panel or
  decorative glyph.
- `Footer`: shared rail and restrained identity/navigation groups.
- `DiscoveryLauncher`: mounts the stateful release diagnostic. `DiscoveryRelease`
  owns website enrichment, five routed questions, the final contact gate, AI
  analysis and the two-page print artifact.
- `PageHero`: shared introduction for non-home marketing and index pages. It
  uses a consistent `clamp(40rem, 80dvh, 56rem)` minimum height and contains a
  title, introduction and optional actions. Its content is bottom-aligned.
- The not-found route is a deliberate utility-page exception. Its main surface
  has a `100dvh` minimum height and keeps the shared two-to-four desktop split:
  title on the left, original recovery links and a compact game on the right.
  The game is a functional six-by-four ruled board with one keyboard-accessible
  target. Each catch hard-cuts the target to a new cell, and the fourth catch
  resolves to a short status message. It has no automatic motion, preserves a
  direct route home, announces progress, and collapses to one column on mobile.
- `EditorialCard`: shared text card for standard content and large industry
  panels. All cards use generous responsive internal padding. Titles and
  descriptions align to the top. An optional modular glyph sits above the copy
  with the same generous responsive gap in every card context.
  The stable card surface owns the shared viewport trigger. Its title and
  description reveal as one reading unit, with the description following the
  title by 140ms. The surface, glyph and arrow remain static.
  An optional `href` changes the semantic root from `article` to `a` and pins
  the outlined Material Symbols `arrow_forward` affordance to the bottom without
  shifting the copy. Linked cards reserve a generous gap below their description
  while the fixed-size arrow remains inside the card's bottom padding. Every
  linked card uses this same current-colour arrow.
  Hover and keyboard focus invert the complete card surface, including its
  copy, arrow and any modular glyph. Homepage cards in From audit to operation
  use a larger title-to-description gap, and linked cards reserve a generous
  minimum gap between the description and arrow.
- `EditorialCardLayer`: the only layout wrapper for editorial cards.
  Its `surface` property selects either grey `solid` cards with a real gap or a
  transparent `bordered` grid with connected single-width rules and no gap.
  The `colSize` prop accepts one, two or three desktop columns, reduces a
  three-column layer to two columns at tablet width and collapses every layer
  to one column below 768px. Company’s How we work section uses the same
  one-column solid grey treatment as the homepage card sequences. Every glyph
  card receives a deliberately assigned, non-repeating mark whose topology
  reflects its subject: flow, boundary, sequence, clustering or separation.
  Shared marketing-page data may select these existing column, surface, glyph
  and content-width options per section; it does not introduce page-local card
  variants. Programme and audit sequences use the homepage's numbered,
  one-column 50% composition. Parallel capability or constraint inventories use
  two-column bordered layers. Operational and starting-point inventories use
  one-column glyph cards. Industry pages follow the same rule: their
  AI-supported workload is a one-column glyph sequence, except Insurance's
  AI-supported claims inventory, which uses two columns. Design constraints use
  a two-column bordered layer.
- Home's From pilot to production section is a text-only standard section. It
  carries no illustrative media.
- `FaqList`: the shared native question-and-answer disclosure list.
  `FaqSection` wraps it in the standard section composition. Questions remain
  unnumbered, only one answer opens at a time, and the same keyboard and focus
  behaviour applies on every page. Item
  separators use the shared opaque 1px current-colour fine rule, black on paper
  and paper on the dark Private AI route.
  The first summary alone omits top padding; later
  rows keep their normal separator spacing without a fixed minimum height.
  Opening an answer adds only the answer's intentional gap.
- `ExpandedDetailList`: the reusable always-visible title-and-body stack used by
  programme templates. Items
  use the shared opaque 1px black fine separator. Their semantic `h3` titles
  retain the smaller section-heading token with the slightly softer ink colour,
  without inheriting the larger left-hand section-title size. Its parent uses
  `SectionAnatomy contentWidth="50"` to divide title and content into equal
  desktop columns while retaining the shared one-column collapse at 767px.
  Optional image or icon media renders above its
  title and requires explicit source dimensions and alt text; no placeholder
  media is invented.
- `ModularGlyph`: the static abstract-mark primitive used when an
  `EditorialCard` needs a small visual signature. Marks are authored
  as integer cell coordinates on a 5×5 grid and rendered as inline SVG, never
  as raster exports. Touching cells merge into one silhouette with square outer
  corners and the Group 97 half-cell radius on concave corners; separated cells
  remain in the same even-odd path. A glyph uses one fill (`currentColor`), no
  stroke and no animation. Library patterns may declare horizontal, vertical,
  180-degree rotational or diagonal symmetry, or remain deliberately
  asymmetric. Patterns should suggest topology, sequence, clustering or
  separation without becoming literal interface icons, letters or alternate
  logos. Assigned card marks use meaning-led library choices and transformed
  variants, and remain unique across the marketing catalogue.
  Decorative marks stay hidden from assistive technology; only a mark that adds
  non-redundant meaning receives an accessible label.
- `/glyphs`: the noindexed internal authoring utility for the next modular
  glyph family. It supports square grids from 2×2 through 8×8 and exports both
  cell data and a single SVG outline. The manual grid is unrestricted: cells
  may touch, stand alone or separate after an edit. Touching cells merge into
  one fill. Outer corners remain square while concave corners use the Group 97
  half-cell radius. The default 5×5
  workflow automatically places the supplied library patterns before a batch
  of generated candidates. Generation may mix or explicitly enforce
  horizontal, vertical, rotational or diagonal symmetry; balanced candidates
  may use connected or deliberately separated modules. Candidates can be
  selected in one shortlist, annotated individually and copied together as
  structured pattern data with comments.
- `PrivateAiBoundary`: the decorative isometric scene in the Home Private AI
  dark section. Three filled monochrome planes form a visible cube.
  The core cube has no outline. Three identically sized black planes enter one
  by one along equal radial axes and replace it in an automatic sequence. Each
  wrapping plane's outline
  begins at the exact monochrome value of its matching core face, then
  brightens continuously to white over its own entry. The completed outlines
  resolve into one clean wireframe at rest.
  Each final cube edge is rendered once and uses rounded joins only to prevent
  raster artefacts at acute and three-way intersections. The scene is hidden
  from assistive technology. Its homepage composition omits a visible title and
  divides the complete inner row into 4/6 copy and 2/6 animation before
  collapsing to one column on mobile, with copy first.
- The Private AI route is dark from hero through footer. Its first ruled scope
  section has no visible title or decorative object; justified enlarged copy
  occupies the right-hand five-sixths and uses static paper-on-ink highlights
  limited to two or three words each. The hero's introduction sits close to the
  first structural rule. Deployment criteria follows with two numbered
  one-column groups separated by another rule; their criteria are clean ruled
  rows without browser-default bullets. Inside the boundary is a two-column
  bordered card layer. The shared one-column collapse still applies below
  768px.
- `ContactForm`: local validation and a same-origin handoff into the shared lead repository.
  Contact composes Mutual NDA inside the Direct section after both email rows,
  keeps FAQ in the shared standalone section, and uses this form as its sole
  terminal grey section. Its repeated labels and error slots use reusable Astro
  form-control components; native controls remain transparent with one bottom
  rule and explicit focus, invalid, disabled and autofill states. Both Send and
  Request an NDA use the shared right-arrow treatment; changing the Send state
  updates only its label and preserves the arrow.
- `Blog`: an editorial feature and ruled reading queue backed by the typed
  `blog` content collection. Each post is a Markdown file loaded through
  Astro's glob loader. The filename defines the slug, while required `title`
  frontmatter is the single source for the hero `h1`, page metadata, lists and
  schema. Required `summary` frontmatter is repeated as the
  opening Markdown paragraph. The Markdown body contains no `h1` and continues
  with normal `h2`/`h3` hierarchy and links. `ArticleProse` scopes Markdown
  element typography. Article paragraphs, lists and quotes use the shared
  large-body scale for sustained reading, while the opening statement retains
  its larger lead treatment. Queue
  rows stay flush to the content rail with no movement, transition or surface
  change on hover. The first row relies on the shared content inset and the
  final row uses only a small 0.75rem bottom inset, echoing the compact FAQ list
  edges. Each post keeps its card-heading title and standard-body summary
  together on the left, followed by a small outlined date capsule whose 1px
  border uses the same softer rule colour as a secondary button; only the
  shared arrow remains on the right, aligned to the row's bottom.
  Keyboard focus uses the shared
  visible outline without changing the row surface. Dates use sentence case
  and the long English format `6 August 2026`. The `/blog` list progressively
  reveals posts in batches of ten after an initial ten through a final
  right-aligned `See more posts` large-body regular text control without an
  arrow. The homepage
  renders its three latest posts without pagination and ends with the same row
  treatment linking to `/blog` as `See the blog`. Each article places its title
  alone in the shared PageHero.
  The ruled content rail below uses two desktop columns: publication date
  and an All posts button with a backward arrow on the left, and only
  Markdown on the right. At 767px and below metadata moves above the full-width
  body. The shared Start here terminal section and footer follow the article.
- `Meet the team`: one vertical stack of wide editorial profile cards. Each desktop card
  divides evenly into a square monochrome portrait on the left and the name,
  role and biography on the right. The card stack occupies the full available
  content column. The complete name, role and biography group aligns to the
  top of each card. Portraits use a compact inset from the top
  and both sides while their lower edge remains flush. Transparent portraits
  and copy share one continuous `surface` background without a dividing rule.
  Cards return to full width and
  collapse to one column at 767px, with the portrait above the copy. They have
  no hover swap or interactive inversion. The section appears immediately after
  Company’s Implementation gap. Names use the shared card-heading typography,
  biographies use the standard body treatment, and roles use a
  quiet outlined metadata capsule built from the small type token, button radius
  and the same fine, softer border as a secondary button. The role capsule has
  no hover or interactive state.

## Discovery and report

- Public Discovery entry points in the homepage hero, shared page heroes and
  footer navigation render only when the build-time `DISCOVERY_ENABLED` value
  is exactly `true`. Missing or different values keep those links hidden while
  preserving direct route access for private testing. The shared header keeps
  its CTA in either state and falls back to `Book a call` at `/contact`.
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
  routes Banking, Insurance, Healthcare, Capital Markets and general workflows
  into their relevant options.
- One dominant question and exactly one choice surface are visible at a time.
- Workflow accepts one or two related processes and assesses them together as
  one operating scope.
- Required free text is deliberately absent from the diagnostic. The website
  is the only text entry before the contact gate; the remaining five answers
  use single-select or multi-select options.
- Single-select choice sets are one connected ruled stack: no gaps, no radio
  dots and no doubled borders. Multi-select choice sets wrap as compact,
  content-width pills so their selection model is visually distinct.
  Unselected surfaces use canonical ink, while selected surfaces invert to
  paper.
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
- The result is exactly two useful pages: what NNCo. understood and where to act.
  Report claims distinguish reported answers, public facts and inference.
  Competitor notes appear only when requested and include direct public sources.
- Browser print is the only PDF exporter. Print CSS produces exactly two A4
  pages and excludes intake, toolbar and contact controls. Displayed copy is
  bounded for A4 without changing the stored diagnostic.
- Discovery and its print report consume the same Geist-backed `--font-sans`
  token as the marketing site.
- Structural panels stay square. Interactive action buttons and multi-select
  pills are the only rounded controls.

## Motion and accessibility

- Motion exists only for hierarchy, storytelling, interaction feedback and
  state transitions.
- Page titles and Editorial Card copy use one shared viewport reveal. They fade
  from fully transparent while rising 16px over 900ms with the standard
  restrained easing, after a 140ms entry pause. The homepage hero title uses a
  more prominent 32px rise. Page and homepage introductions, plus card
  descriptions, use the standard movement with a further 140ms delay. Section
  titles remain static.
  The stable copy or card surface is observed rather than the moving text.
  The reveal starts at 15% visibility, remains resolved while any part of the
  wrapper is visible, resets only after the wrapper is fully outside the
  viewport and replays when it reaches the threshold again.
- Outside those text reveals, fades and crossfades are not used except for the
  shared navigation header's 560ms background-colour transition, its mega-menu
  content reveal, and the homepage Private AI scene's boundary handoff. Every
  other surface change remains instant.
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
- The hero frame sequence plays once after its active responsive frames have
  loaded and the page cover has exited. Its eleven hard states slow toward the
  end through progressively longer 140ms to 300ms frame holds, without
  crossfading, panning or scaling. Scrolling has no effect on the sequence and
  it never loops. Reduced-motion users remain on frame one.
- The homepage Private AI boundary scene starts its own 2.44-second automatic
  sequence 200ms after the shared viewport observer activates it. The black boundary
  planes enter from the top, lower-right and lower-left over successive
  overlapping 980ms entries, separated by 420ms.
  Each wrapping plane carries an outline matching the brightness of the core
  face beneath it; that outline brightens to white over the plane's own travel.
  The core cube remains borderless, and the final combined wireframe begins
  as the last plane lands. The resolved wireframe holds while any part of the
  scene remains visible. Once the scene is fully outside the viewport it resets,
  then replays at the next 15% entry. No scroll progress, React island or
  continuous loop is involved. Reduced-motion users receive the completed
  static boundary.
- One framework-independent `IntersectionObserver` controls every viewport
  animation and reinitialises after Astro page swaps. Page-load sequences and
  interaction state transitions keep their own lifecycle.
- Respect `prefers-reduced-motion`.
- Keep persistent labels above fields.
- Never use placeholder text as the only label.
- Text, borders, focus styles and form states must meet WCAG AA contrast.
- The form and chat must feed one canonical state. Neither is a second funnel.
