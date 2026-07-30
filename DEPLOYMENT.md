# Astro deployment notes

## Runtime architecture

The marketing pages can be statically generated, but the discovery handoff
uses `POST /api/lead-requests`. Production therefore requires an Astro server
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

## Report generation

The two-page sample remains at `public/sample-report.pdf`. The deterministic
ReportLab source is `scripts/generate_sample_report.py`; it writes both the
versioned output copy and the public asset. The runtime endpoint returns the
structured full report, while browser PDF export remains a client concern.
