import { deliverEmail } from "../../../src/server/email/delivery.ts";
import { renderReportPdf } from "../../../src/server/email/report-pdf.ts";

// This entrypoint runs in Supabase, not in the Cloudflare website Worker.
const runtime = (
  globalThis as typeof globalThis & {
    Deno: {
      env: { toObject(): Record<string, string> };
      serve(handler: (request: Request) => Promise<Response>): void;
    };
  }
).Deno;
runtime.serve((request) =>
  deliverEmail(request, runtime.env.toObject(), { renderPdf: renderReportPdf }),
);
