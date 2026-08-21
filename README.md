# NNCO website

## Local development

```bash
pnpm install --ignore-scripts
pnpm dev
```

## Release flow

| Branch | Purpose | Deployment |
| --- | --- | --- |
| `development` | Personal working branch | None; checks only |
| `stage` | Review candidate | Automatic to `stage.nnco.ai` |
| `main` | Production source of truth | Automatic to `nnco.ai` |

Work on `development`, then promote with pull requests: `development` →
`stage` → `main`. `development` is never deployed. Stage and production
deployments run through GitHub Actions; Cloudflare Workers Builds must remain
disconnected so each commit has only one deployment owner.

One-time account setup, runtime secrets, manual deployment commands, and the
production DNS cutover are documented in [DEPLOYMENT.md](./DEPLOYMENT.md).

## Blog

Add a `.md` file to `src/content/blog/`; its filename becomes the URL. Complete the frontmatter below, repeat `summary` as the first paragraph, and use `##` for the first heading level. `category` can be `Systems`, `Field notes`, `Regulation`, or `Principles`; posts are automatically sorted newest first by `publishedAt`. Formatting as in classic Markdown file.

```md
---
title: Article title
category: Systems
readingMinutes: 6
publishedAt: "2026-08-20"
updatedAt: "2026-08-20"
summary: One-sentence article summary.
---

## First section

Article content.
```
