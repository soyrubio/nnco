import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: z
    .object({
      title: z.string().trim().min(1, "title is required"),
      category: z.enum(["Systems", "Field notes", "Regulation", "Principles"]),
      readingMinutes: z.number().int().positive(),
      publishedAt: z.iso.date(),
      updatedAt: z.iso.date(),
      summary: z.string().min(1),
    })
    .refine((data) => data.updatedAt >= data.publishedAt, {
      message: "updatedAt must be on or after publishedAt",
      path: ["updatedAt"],
    }),
});

export const collections = { blog };
