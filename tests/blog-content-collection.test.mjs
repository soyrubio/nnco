import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";
import { createSatteriMarkdownProcessor } from "@astrojs/markdown-satteri";
import { parseFrontmatter } from "astro/markdown";
import { parseFragment } from "parse5";
import { formatBlogDate } from "../src/lib/blog-date.ts";

const sourceEntries = Object.fromEntries(
  await Promise.all(
    Object.entries({
      config: "../src/content.config.ts",
      layout: "../src/layouts/BaseLayout.astro",
      prose: "../src/components/ArticleProse.astro",
      helper: "../src/lib/blog.ts",
      route: "../src/pages/blog/[slug].astro",
      index: "../src/pages/blog/index.astro",
      home: "../src/pages/index.astro",
      list: "../src/components/BlogPostList.astro",
      styles: "../src/styles/global.css",
    }).map(async ([name, path]) => [
      name,
      await readFile(new URL(path, import.meta.url), "utf8"),
    ]),
  ),
);

const contentDirectory = new URL("../src/content/blog/", import.meta.url);
const migratedSlugs = [
  "what-goes-into-an-audit-trail-for-an-ai-workflow",
  "where-human-review-belongs-in-an-ai-workflow",
  "private-ai-starts-with-the-data-boundary",
];
const migratedDateLabels = {
  "what-goes-into-an-audit-trail-for-an-ai-workflow": "6 August 2026",
  "where-human-review-belongs-in-an-ai-workflow": "24 July 2026",
  "private-ai-starts-with-the-data-boundary": "10 July 2026",
};

const markdownProcessor = await createSatteriMarkdownProcessor({
  syntaxHighlight: false,
  smartypants: false,
});

async function parseMarkdownSource(source, file) {
  const parsed = parseFrontmatter(source);
  assert.ok(parsed.rawFrontmatter, `${file}: frontmatter fence`);
  const rendered = await markdownProcessor.render(parsed.content, {
    frontmatter: parsed.frontmatter,
  });
  return {
    data: parsed.frontmatter,
    tree: parseFragment(rendered.code),
  };
}

function collectRenderedNodes(node, predicate, found = []) {
  if (predicate(node)) found.push(node);
  for (const child of node.childNodes ?? []) {
    collectRenderedNodes(child, predicate, found);
  }
  return found;
}

function visibleRenderedText(node) {
  if (node.nodeName === "#text") return node.value;
  return (node.childNodes ?? [])
    .map(visibleRenderedText)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function renderedAttribute(node, name) {
  return node.attrs?.find((attribute) => attribute.name === name)?.value;
}

async function localLinkExists(href, slugs) {
  const pathname = href.split(/[?#]/, 1)[0].replace(/\/$/, "") || "/";
  if (pathname.startsWith("/blog/")) {
    return slugs.has(pathname.slice("/blog/".length));
  }
  const candidates = pathname === "/"
    ? [new URL("../src/pages/index.astro", import.meta.url)]
    : [
        new URL(`../src/pages${pathname}.astro`, import.meta.url),
        new URL(`../src/pages${pathname}/index.astro`, import.meta.url),
      ];
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return true;
    } catch {}
  }
  return false;
}

test("blog uses Astro 7 content collections with a glob-backed Markdown loader", async () => {
  assert.match(
    sourceEntries.config,
    /import \{ defineCollection \} from "astro:content";\s*import \{ glob \} from "astro\/loaders";\s*import \{ z \} from "astro\/zod";/,
  );
  assert.match(
    sourceEntries.config,
    /defineCollection\(\{\s*loader: glob\(\{ base: "\.\/src\/content\/blog", pattern: "\*\*\/\*\.md" \}\),/,
  );
  assert.doesNotMatch(sourceEntries.config, /related:|reference\("blog"\)/);
  assert.match(sourceEntries.config, /publishedAt: z\.iso\.date\(\)/);
  assert.match(sourceEntries.config, /updatedAt: z\.iso\.date\(\)/);
  assert.match(
    sourceEntries.config,
    /title: z\.string\(\)\.trim\(\)\.min\(1, "title is required"\)/,
  );
  assert.doesNotMatch(sourceEntries.config, /publishedLabel/);
  assert.match(
    sourceEntries.config,
    /\.refine\(\(data\) => data\.updatedAt >= data\.publishedAt,[\s\S]*?path: \["updatedAt"\]/,
  );
  await assert.rejects(access(new URL("../src/data/posts.ts", import.meta.url)));
});

test("every Markdown post satisfies authoring and local-reference contracts", async () => {
  const files = (await readdir(contentDirectory, { recursive: true }))
    .filter((file) => file.endsWith(".md"))
    .sort();
  assert.ok(files.length > 0);
  const slugs = new Set(files.map((file) => file.replace(/\.md$/, "")));
  for (const migratedSlug of migratedSlugs) {
    assert.ok(slugs.has(migratedSlug), `migrated slug ${migratedSlug}`);
  }

  for (const file of files) {
    const source = await readFile(new URL(file, contentDirectory), "utf8");
    const { data, tree } = await parseMarkdownSource(source, file);
    for (const key of [
      "title",
      "category",
      "author",
      "readingMinutes",
      "publishedAt",
      "updatedAt",
      "summary",
    ]) {
      assert.ok(data[key], `${file}: ${key}`);
    }
    assert.match(data.publishedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(data.updatedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(data.updatedAt >= data.publishedAt, `${file}: date order`);
    assert.ok(Number.isInteger(data.readingMinutes) && data.readingMinutes > 0);
    assert.equal(data.publishedLabel, undefined, `${file}: derived date label`);

    const headings = collectRenderedNodes(tree, (node) =>
      /^h[1-6]$/.test(node.tagName ?? ""),
    );
    const titleHeadings = headings.filter((heading) => heading.tagName === "h1");
    assert.equal(titleHeadings.length, 0, `${file}: title comes from frontmatter`);
    for (let index = 1; index < headings.length; index += 1) {
      const previousDepth = Number(headings[index - 1].tagName.slice(1));
      const currentDepth = Number(headings[index].tagName.slice(1));
      assert.ok(currentDepth <= previousDepth + 1, `${file}: heading-level skip`);
    }

    const renderedBlocks = tree.childNodes.filter((node) => node.tagName);
    const summaryBlock = renderedBlocks[0];
    assert.equal(summaryBlock?.tagName, "p", `${file}: summary block`);
    assert.equal(
      visibleRenderedText(summaryBlock),
      data.summary.replace(/\s+/g, " ").trim(),
      `${file}: summary/lede parity`,
    );

    const slug = file.replace(/\.md$/, "");
    if (migratedDateLabels[slug]) {
      assert.equal(formatBlogDate(data.publishedAt), migratedDateLabels[slug]);
    }
    assert.equal(data.related, undefined, `${file}: no related-post metadata`);
    const keyStatements = collectRenderedNodes(
      tree,
      (node) =>
        node.tagName === "blockquote" &&
        renderedAttribute(node, "class")?.split(/\s+/).includes("article-prose__key-statement"),
    );
    assert.equal(keyStatements.length, 0, `${file}: no special key-statement section`);
    assert.equal(
      headings.some((heading) => visibleRenderedText(heading) === "The point to retain"),
      false,
      `${file}: no point-to-retain heading`,
    );

    const links = collectRenderedNodes(tree, (node) => node.tagName === "a");
    for (const link of links) {
      const href = renderedAttribute(link, "href");
      assert.ok(href, `${file}: resolved link`);
      if (!href.startsWith("/")) continue;
      assert.ok(await localLinkExists(href, slugs), `${file}: local link ${href}`);
    }
  }
});

test("article routes render frontmatter titles in the hero and Markdown on the right", () => {
  assert.match(
    sourceEntries.route,
    /import \{ render \} from "astro:content";[\s\S]*?import PageHero from "@\/components\/PageHero\.astro";[\s\S]*?const \{ Content, headings \} = await render\(post\);/,
  );
  assert.match(
    sourceEntries.route,
    /headings\.some\(\(heading\) => heading\.depth === 1\)[\s\S]*?must define its title in frontmatter and omit Markdown h1 headings/,
  );
  assert.match(
    sourceEntries.route,
    /<PageHero title=\{post\.data\.title\} titleId="article-title" \/>/,
  );
  assert.match(
    sourceEntries.route,
    /const publishedLabel = formatBlogDate\(post\.data\.publishedAt\);[\s\S]*?<article class="news-article__layout">\s*<header class="news-article__meta" aria-label="Publication details">\s*<time datetime=\{post\.data\.publishedAt\}>\{publishedLabel\}<\/time>\s*<span>\{post\.data\.author\}<\/span>\s*<Button href="\/blog" variant="secondary">\s*<BlockArrow direction="left" \/> All posts\s*<\/Button>\s*<\/header>\s*<div class="news-article__content">\s*<ArticleProse>\s*<Content \/>/,
  );
  assert.match(
    sourceEntries.route,
    /ogType="article"\s*articlePublishedTime=\{post\.data\.publishedAt\}\s*articleModifiedTime=\{post\.data\.updatedAt\}/,
  );
  assert.match(sourceEntries.layout, /ogType\?: "website" \| "article";/);
  assert.match(sourceEntries.layout, /<meta property="og:type" content=\{ogType\} \/>/);
  assert.match(sourceEntries.layout, /property="article:published_time"/);
  assert.match(sourceEntries.layout, /property="article:modified_time"/);
  assert.doesNotMatch(sourceEntries.route, /post\.sections|post\.introduction|news-reading-copy|SectionRow/);
  assert.match(
    sourceEntries.styles,
    /\.news-article__layout\s*\{[^}]*display:\s*grid;[^}]*grid-template-columns:\s*var\(--section-grid-columns\);/s,
  );
  assert.match(sourceEntries.styles, /\.news-article__meta\s*\{[^}]*grid-column:\s*1;/s);
  assert.match(
    sourceEntries.styles,
    /\.news-article__meta \.button\s*\{[^}]*margin-top:\s*1\.5rem;/s,
  );
  assert.match(sourceEntries.styles, /\.news-article__content\s*\{[^}]*grid-column:\s*2;/s);
  assert.match(
    sourceEntries.styles,
    /@media \(max-width: 767px\)[\s\S]*?\.news-article__layout\s*\{[^}]*grid-template-columns:\s*1fr;[\s\S]*?\.news-article__meta\s*\{[^}]*grid-column:\s*1;[\s\S]*?\.news-article__content\s*\{[^}]*grid-column:\s*1;/s,
  );
  assert.match(sourceEntries.prose, /<div class:list=\{\["article-prose", className\]\}>/);
  assert.doesNotMatch(sourceEntries.prose, /:global\(h1/);
  assert.match(
    sourceEntries.prose,
    /\.article-prose > :global\(p:first-child\)\s*\{[^}]*margin-bottom:\s*clamp\(3\.5rem, 7vw, 6rem\);[^}]*font-size:\s*clamp\(1\.2rem, 2vw, 1\.6rem\);/s,
  );
  assert.match(sourceEntries.prose, /\.article-prose :global\(h2\)/);
  assert.match(sourceEntries.prose, /\.article-prose :global\(h3\)/);
  assert.match(sourceEntries.prose, /\.article-prose :global\(h4\)/);
  assert.match(sourceEntries.prose, /\.article-prose :global\(h5\)/);
  assert.match(sourceEntries.prose, /\.article-prose :global\(h6\)/);
  assert.doesNotMatch(sourceEntries.prose, /article-prose__key-statement/);
  assert.match(
    sourceEntries.prose,
    /\.article-prose :global\(blockquote\)\s*\{[^}]*padding-left:\s*1\.25rem;[^}]*border-left:\s*2px solid var\(--rule\);/s,
  );
  assert.match(
    sourceEntries.prose,
    /\.article-prose :global\(p\),\s*\.article-prose :global\(li\)\s*\{[^}]*font-size:\s*var\(--type-size-body-large\);/s,
  );
  assert.doesNotMatch(sourceEntries.route, /Related perspective|Read next|news-article__related|post\.data\.related/);
  assert.match(
    sourceEntries.route,
    /<ArticleProse>\s*<Content \/>\s*<\/ArticleProse>\s*<\/div>\s*<\/article>\s*<\/SectionFrame>\s*<ClosingSection[\s\S]*?<\/main>\s*<Footer \/>/,
  );
  assert.doesNotMatch(sourceEntries.styles, /news-article__related/);
  assert.doesNotMatch(sourceEntries.styles, /\.news-article__content :?is?\([^}]*h1|\.news-article__content h[1-6]/);
});

test("home and blog indexes share sorted collection summaries", () => {
  assert.match(
    sourceEntries.helper,
    /getCollection\("blog"\)[\s\S]*?right\.data\.publishedAt\.localeCompare\(left\.data\.publishedAt\)\s*\|\|\s*left\.id\.localeCompare\(right\.id\)/,
  );
  assert.match(
    sourceEntries.home,
    /await getBlogEntries\(\)\)\.slice\(0, 3\)\.map\(toBlogPostListItem\)/,
  );
  assert.match(
    sourceEntries.index,
    /const posts = \(await getBlogEntries\(\)\)\.map\(toBlogPostListItem\);/,
  );
  assert.match(sourceEntries.list, /import type \{ BlogPostListItem \} from "@\/lib\/blog";/);
  assert.match(sourceEntries.home, /variant="latest"/);
  assert.match(
    sourceEntries.index,
    /variant="load-more"\s*initialCount=\{10\}\s*batchSize=\{10\}/,
  );
  assert.match(sourceEntries.list, /<span>See more posts<\/span>/);
  assert.match(sourceEntries.list, /<span>See the blog<\/span>/);
  assert.doesNotMatch(
    sourceEntries.list,
    /<span>See (?:more posts|the blog)<\/span>\s*<CardAffordance \/>/,
  );
  assert.match(
    sourceEntries.styles,
    /\.news-row--action\s*\{[^}]*display:\s*flex;[^}]*width:\s*fit-content;[^}]*margin-left:\s*auto;/s,
  );
  assert.match(sourceEntries.list, /data-blog-post-visible=/);
  assert.match(sourceEntries.list, /visibleCount = Math\.min\(posts\.length, visibleCount \+ batchSize\)/);
});

test("blog display dates are derived centrally in UTC en-GB", () => {
  assert.equal(formatBlogDate("2026-08-06"), "6 August 2026");
  assert.equal(formatBlogDate("2026-07-24"), "24 July 2026");
  assert.match(sourceEntries.helper, /publishedLabel: formatBlogDate\(entry\.data\.publishedAt\)/);
});

test("blog list rows remain static on hover", () => {
  const rowRule = sourceEntries.styles.match(
    /(?:^|\n)\.news-row\s*\{(?<body>[\s\S]*?)\n\}/,
  )?.groups?.body;
  const dateRule = sourceEntries.styles.match(
    /\.news-row__date\s*\{(?<body>[\s\S]*?)\n\}/,
  )?.groups?.body;

  assert.ok(rowRule, "The blog list row rule must remain present");
  assert.match(rowRule, /padding-inline:\s*0;/);
  assert.doesNotMatch(rowRule, /transition:|background:/);

  assert.ok(dateRule, "The blog list date rule must remain present");
  assert.match(dateRule, /border:\s*var\(--fine-rule-thickness\) solid var\(--rule-strong\);/);
  assert.match(dateRule, /border-radius:\s*var\(--radius-button\);/);
  assert.match(dateRule, /font-size:\s*var\(--type-size-small\);/);
  assert.match(dateRule, /letter-spacing:\s*var\(--type-tracking-normal\);/);
  assert.doesNotMatch(dateRule, /text-transform:\s*uppercase;/);

  assert.match(
    sourceEntries.styles,
    /\.section-anatomy__content\s*\{[^}]*padding-top:\s*0\.75rem;/s,
  );
  assert.match(
    sourceEntries.styles,
    /\.news-list > li:first-child \.news-row\s*\{\s*padding-top:\s*0;/s,
  );
  assert.match(
    sourceEntries.styles,
    /\.news-list > li:last-child \.news-row\s*\{\s*padding-bottom:\s*0\.75rem;/s,
  );
  assert.match(
    sourceEntries.styles,
    /\.news-row > \.card-affordance\s*\{[^}]*align-self:\s*start;[^}]*justify-self:\s*end;/s,
  );

  assert.doesNotMatch(
    sourceEntries.styles,
    /\.news-row(?::hover|:is\([^)]*:hover)[^{]*\{/,
  );
  assert.match(
    sourceEntries.styles,
    /:focus-visible\s*\{[^}]*outline:\s*2px solid var\(--ink\);/s,
  );
});
