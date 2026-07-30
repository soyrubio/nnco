import type { APIRoute } from "astro";
import { handleLeadRequest } from "../../server/lead-handler.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) =>
  handleLeadRequest(request, clientAddress);
