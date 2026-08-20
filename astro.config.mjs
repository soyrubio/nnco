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
  vite: {
    // Pre-bundle late Astro and renderer imports before workerd starts.
    // Remove once the fix for withastro/astro#17456 reaches the pinned release.
    optimizeDeps: {
      // @astrojs/react only contributes its SSR dependency list when this is
      // explicit, preventing mid-request discovery of the JSX runtimes.
      noDiscovery: false,
      include: ["astro/assets/services/noop", "astro/logger/json"],
    },
  },
});
