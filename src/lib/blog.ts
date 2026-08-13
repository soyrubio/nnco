import { getCollection, type CollectionEntry } from "astro:content";
import { formatBlogDate } from "@/lib/blog-date";

export type BlogEntry = CollectionEntry<"blog">;

export interface BlogPostListItem {
  slug: string;
  title: string;
  summary: string;
  publishedAt: string;
  publishedLabel: string;
}

export async function getBlogEntries(): Promise<BlogEntry[]> {
  const entries = await getCollection("blog");
  return entries.sort(
    (left, right) =>
      right.data.publishedAt.localeCompare(left.data.publishedAt) ||
      left.id.localeCompare(right.id),
  );
}

export function toBlogPostListItem(entry: BlogEntry): BlogPostListItem {
  return {
    slug: entry.id,
    title: entry.data.title,
    summary: entry.data.summary,
    publishedAt: entry.data.publishedAt,
    publishedLabel: formatBlogDate(entry.data.publishedAt),
  };
}
