import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
  adapter: cloudflare({ imageService: "passthrough" }),
  compressHTML: true,
  session: false,
  site: "https://nnco.ai",
  trailingSlash: "never",
  integrations: [
    react(),
    sitemap({
      filter: (page) => {
        const pathname = new URL(page).pathname.replace(/\/$/, "") || "/";
        return ![
          "/industries",
          "/news",
          "/privacy",
          "/team",
          "/what-we-do",
        ].includes(pathname) && !pathname.startsWith("/api/");
      },
    }),
  ],
  output: "server",
});
