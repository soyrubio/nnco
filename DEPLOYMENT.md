# Astro deployment notes

## Runtime architecture

The marketing pages can be statically generated, but the discovery handoff
uses `POST /api/lead-requests` and the contact form uses
`POST /api/contact-requests`. Production therefore requires an Astro server
adapter. `@astrojs/vercel` is installed and `astro.config.mjs` uses server
output with the Vercel adapter.

The endpoint keeps the same request and response contract as the Next.js
implementation. The discovery UI should call the same-origin path
`/api/lead-requests`.

## Local development

Copy `.env.example` to `.env` and keep:

```dotenv
PUBLIC_APP_URL=http://localhost:4321
LEAD_HANDOFF_MODE=local
```

Local mode stores idempotent lead requests in process memory. It requires no
secret and is disabled when `NODE_ENV=production`.

Contact enquiries and submitted diagnostics use the same repository and the
same `lead_requests` table. Contact records are distinguished by the
`contact-enquiry` snapshot kind.

## Vercel and Supabase

Recommended production values:

```dotenv
PUBLIC_APP_URL=https://your-domain.example
LEAD_HANDOFF_MODE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only-value
```

Apply `supabase/migrations/0001_lead_requests.sql` before enabling Supabase.
The service-role key is read only by the server repository and must never use a
`PUBLIC_` prefix or enter a browser island.

Supabase is optional for local product validation. Production fails closed
unless durable Supabase mode is configured.

## API protections

The handoff endpoint preserves:

- same-origin validation;
- a 128 KiB request limit;
- ten attempts per ten-minute in-memory rate window;
- versioned consent;
- schema and snapshot validation;
- case revision and idempotency checks;
- an eight-second Supabase timeout;
- generic retry-safe error responses.

Rate limiting is process-local. Replace it with a shared store before relying
on it across multiple production instances.

## Voice transcription

Voice input is optional and disabled in the interface when
`PUBLIC_TRANSCRIPTION_ENABLED=false`. To enable it, configure:

```dotenv
PUBLIC_TRANSCRIPTION_ENABLED=true
OPENAI_API_KEY=server-only-value
OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe
OPENAI_API_BASE_URL=https://api.openai.com
```

`OPENAI_API_KEY` is server-only. The transcription endpoint accepts same-origin
audio uploads up to 4 MB, applies process-local rate limiting, and does not
store recordings or transcript text.

## Report export

Browser print is the only PDF path. It exports two preview pages before contact
and six pages after the complete diagnostic is unlocked. No report-generation
service or static sample PDF is deployed.
