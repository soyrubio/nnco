import type { APIRoute } from "astro";
import { handleDiscoveryEnrichmentRequest } from "../../server/discovery-enrichment-handler.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) =>
  handleDiscoveryEnrichmentRequest(request, clientAddress);
