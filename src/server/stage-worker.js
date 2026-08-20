import { handle } from "@astrojs/cloudflare/handler";
import {
  getStageAuthResponse,
  isLocalAstroPrerenderRequest,
} from "./basic-auth.js";

export default {
  async fetch(request, env, ctx) {
    // Astro's build-time prerender worker calls these private endpoints on
    // localhost. They do not exist as public bypasses in the deployed stage.
    if (isLocalAstroPrerenderRequest(request)) {
      return handle(request, env, ctx);
    }

    const authResponse = getStageAuthResponse(request, env);
    if (authResponse) return authResponse;

    return handle(request, env, ctx);
  },
};
