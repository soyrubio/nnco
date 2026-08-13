import type { APIRoute } from "astro";
import { handleContactRequest } from "../../server/contact-handler";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) =>
  handleContactRequest(request, clientAddress);
