import type { APIRoute } from "astro";
import { handleDiscoveryAnalysisRequest } from "../../server/discovery-analysis-handler.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) =>
  handleDiscoveryAnalysisRequest(request, clientAddress);
