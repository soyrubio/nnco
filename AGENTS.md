# Repository instructions

These instructions apply to the entire repository.

## Read first

- `CONTEXT.md` is intentionally empty and reserved exclusively for a future
  glossary of project-specific product vocabulary. If asked to add entries,
  keep it free of implementation details, architecture, instructions, plans,
  status notes, and changelog content.
- Read `DESIGN.md` before changing layout, styling, motion, interaction, or
  public-facing components. It is the visual and interaction source of truth.
- Read `DEPLOYMENT.md` before changing API routes, environment variables,
  persistence, transcription, or hosting.
- Treat the implementation as authoritative when documentation and code differ.
  Call out the mismatch and keep relevant documentation aligned with an
  intentional behavior change.

## Toolchain and commands

- Use Node.js 22.13 or newer and pnpm 11.18.
- Install dependencies with `pnpm install --ignore-scripts`.
- Start local development with `pnpm dev`.
- Run Astro and TypeScript checks with `pnpm check`.
- Run the Node test suite with `pnpm test`.
- Run the production verification build with `pnpm build`.
- Use pnpm for dependency changes. Do not update `package-lock.json` unless the
  task explicitly requires npm compatibility.

## Architecture boundaries

- Keep routes in `src/pages/`, shared UI in `src/components/`, page content in
  `src/data/`, reusable domain logic in `src/lib/`, and server-only behavior in
  `src/server/`.
- Prefer Astro components for static and presentational UI. Use React only for
  genuinely stateful client interaction; the discovery experience is the main
  React island.
- Keep discovery domain logic deterministic and independent of the DOM,
  framework lifecycle, and persistence APIs so it remains directly testable.
- Keep secrets and privileged persistence calls server-side. Never expose
  `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY`, and never give secret values a
  `PUBLIC_` prefix.
- Preserve API protections when modifying endpoints: same-origin checks,
  request-size limits, validation, rate limiting, idempotency where applicable,
  bounded upstream timeouts, and generic retry-safe errors.
- Store shared marketing, navigation, FAQ, industry, programme, and post copy in
  the corresponding `src/data/` module rather than duplicating it in pages.
- Use the `@/` alias for imports from `src/` when it keeps imports clearer.

## UI and content rules

- Follow `DESIGN.md`; do not introduce a competing visual system in this file.
- Preserve semantic HTML, keyboard access, visible labels, WCAG AA contrast,
  responsive behavior, and `prefers-reduced-motion` support.
- Reuse existing components and global tokens before adding page-local variants.
- Keep public claims, regulated-industry language, privacy wording, and metadata
  precise. Do not invent customer evidence, certifications, or capabilities.

## Verification

- Add or update focused tests when behavior or contracts change.
- For domain, form, API, or server changes, run `pnpm test` and `pnpm check`.
- For Astro, routing, integration, or build configuration changes, run
  `pnpm build`.
- For visual or interaction changes, also inspect the affected flow at desktop
  and mobile sizes when a browser is available.
- Documentation-only edits do not require the application build.
- Report the checks run and any checks that could not be run when handing work
  back.

## Change discipline

- Preserve unrelated and pre-existing worktree changes.
- Keep changes scoped to the request; do not perform opportunistic rewrites.
- Do not commit generated output from `dist/`, `.astro/`, or `.vercel/`.
- Do not commit `.env` files, credentials, recordings, transcripts, or real lead
  data.
