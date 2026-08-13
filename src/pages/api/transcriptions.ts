import type { APIRoute } from "astro";
import { handleTranscriptionRequest } from "../../server/transcription-handler.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) =>
  handleTranscriptionRequest(request, clientAddress);
