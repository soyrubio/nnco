const blogDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export function formatBlogDate(publishedAt: string): string {
  return blogDateFormatter.format(new Date(`${publishedAt}T00:00:00Z`));
}
