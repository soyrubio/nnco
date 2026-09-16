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

Add a `.md` or `.mdx` file to `src/content/blog/`; its filename becomes the URL. Both formats share the same layout, metadata, and listings. Keep filenames unique across both extensions. Complete the frontmatter below, repeat `summary` as the first paragraph, and use `##` for the first heading level. `category` can be `Systems`, `Field notes`, `Regulation`, or `Principles`; posts are automatically sorted newest first by `publishedAt`.

```md
---
title: Article title
category: Systems
readingMinutes: 6
publishedAt: "2026-08-20"
updatedAt: "2026-08-20"
summary: One-sentence article summary.
---

One-sentence article summary.

## First section

Article content.
```

To add a cover above the article text and use it for social sharing, add optional
frontmatter (dimensions must match the image):

```yaml
cover:
  src: /assets/blog/clinic-empty-hour.jpg
  alt: An empty examination room with sunlight falling across the wall.
  width: 1672
  height: 941
```

Use `.md` for ordinary articles and `.mdx` to embed components. Keep blog-specific
components in `src/components/blog/`: `.astro` for presentation, `.tsx` for
stateful React interaction. Put reusable calculation logic in `src/lib/`.
After creating a calculator component, an MDX article can embed it like this
(below its frontmatter):

```mdx
import TimeSavingsCalculator from "@/components/blog/TimeSavingsCalculator";

One-sentence article summary.

## Estimate time savings

<TimeSavingsCalculator client:visible />
```

`client:visible` hydrates the React component when it enters the viewport.
Static Astro components need no client directive. Images work in either format:
`![Description of the diagram](/assets/blog/diagram.png)`.
