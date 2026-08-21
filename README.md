# Installation

```bash
pnpm install --ignore-scripts
pnpm dev
```

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

