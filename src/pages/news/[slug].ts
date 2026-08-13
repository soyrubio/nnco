import type { APIRoute } from "astro";

export const prerender = false;

const legacyPosts = new Set([
  "why-regulated-ai-projects-stall-before-production",
  "designing-ai-workflows-that-can-be-audited",
  "when-on-premise-ai-is-the-right-constraint",
  "ai-in-healthcare-without-crossing-into-diagnostics",
  "introducing-nnco",
]);

export const GET: APIRoute = ({ params, redirect }) => {
  const slug = params.slug;
  const destination =
    slug && legacyPosts.has(slug)
      ? "/blog/what-goes-into-an-audit-trail-for-an-ai-workflow"
      : slug
        ? `/blog/${slug}`
        : "/blog";
  return redirect(destination, 301);
};
