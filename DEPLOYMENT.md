# Astro deployment notes

## Runtime architecture

The marketing pages can be statically generated, but contact and discovery use
server routes. Production therefore requires an Astro server adapter.
`@astrojs/vercel` is installed and `astro.config.mjs` uses server output with
the Vercel adapter.

The release discovery flow calls two same-origin routes:

- `POST /api/discovery-enrichment` reads a bounded set of public company pages
  and returns conservative company context.
- `POST /api/discovery-analysis` stores the consented lead and returns the
  structured two-page report.

The earlier `/api/lead-requests` contract remains available for the legacy
diagnostic implementation. Contact uses `/api/contact-requests`.

## Local development

Copy `.env.example` to `.env` and keep:

```dotenv
PUBLIC_APP_URL=http://localhost:4321
LEAD_HANDOFF_MODE=local
OPENAI_API_KEY=
OPENAI_DISCOVERY_MODEL=gpt-5.6-luna
OPENAI_API_BASE_URL=https://api.openai.com
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
DISCOVERY_RATE_LIMIT_MODE=supabase
DISCOVERY_CONTEXT_SIGNING_SECRET=at-least-32-random-characters
DISCOVERY_RATE_LIMIT_SECRET=a-different-32-character-random-secret
```

Apply every file in `supabase/migrations/` in order before enabling Supabase.
The retention migration adds a 90-day expiry and a nightly deletion job. Mark
only records that must move into an engagement or legal hold with
`retention_hold = true`.
The service-role key is read only by the server repository and must never use a
`PUBLIC_` prefix or enter a browser island.

Supabase is optional for local product validation. Production fails closed
unless durable Supabase mode is configured.

## API protections

The endpoints preserve:

- same-origin validation;
- bounded request bodies and upstream timeouts;
- SSRF protection and same-company redirects for website fetching;
- no more than three public HTML pages and 512 KiB per page;
- ten website checks per IP per ten minutes;
- five reports per IP per hour, 20 per IP per day and three per email per day;
- project-wide circuit breakers of 300 website reads and 100 reports per day;
- versioned consent;
- strict schema validation and idempotent lead storage;
- a 2,500-token report output ceiling;
- an eight-second Supabase timeout;
- generic retry-safe error responses.

Development rate limiting is process-local and bounded. Production fails closed
unless the Supabase-backed atomic limiter from migration `0003` is available.
The trusted adapter client address is used instead of a caller-authored
forwarding header. Limiter keys are HMACed with a dedicated server secret and
the underlying events are deleted after no more than two days.

## Discovery analysis

Production requires these server-only values:

```dotenv
OPENAI_API_KEY=server-only-value
OPENAI_DISCOVERY_MODEL=gpt-5.6-luna
OPENAI_API_BASE_URL=https://api.openai.com
```

The OpenAI requests use Structured Outputs, disable response storage with
`store: false`, and apply bounded timeouts and output-token ceilings. Public
web search is enabled only when the user requests the optional competitor view.
Production fails closed when the analysis key is absent or the analysis call
fails. Local development returns a visibly labelled deterministic rules
preview when no key is configured.

Website enrichment keeps its public-page corpus in process memory for no more
than 24 hours, caps the cache at 100 companies and does not create a lead.
Fetched connections are pinned to a DNS address that passed the public-network
check, including after redirects. Enriched company context is signed before it
is returned to the browser and verified again before analysis. The submitted
diagnostic stores only the normalized inputs, contact handoff and completed
report response; fetched HTML is not stored in `lead_requests`. The completed
response is retained with the lead only to replay the same request ID without
paying for or returning a different analysis.

## Legacy voice transcription endpoint

The current `DiscoveryRelease` interface does not expose voice input or call the
transcription route. `POST /api/transcriptions` remains available as a legacy
server contract. To configure that endpoint, use server-only values:

```dotenv
OPENAI_API_KEY=server-only-value
OPENAI_TRANSCRIPTION_MODEL=gpt-transcribe
OPENAI_API_BASE_URL=https://api.openai.com
```

`OPENAI_API_KEY` is server-only. The transcription endpoint accepts same-origin
audio uploads up to 4 MB, applies process-local rate limiting, and does not
store recordings or transcript text.

## Report export

Browser print is the only PDF path. It exports exactly two A4 pages after the
contact gate and excludes the report toolbar. No report-generation service or
static sample PDF is deployed.

## Privacy launch gate

Keep `/privacy` excluded from indexing and do not publicly launch discovery
until counsel supplies and approves the controller's full legal identity and
address, lawful bases, transfer/recipient wording, complete data-subject rights,
the complaint route and any applicable analytics or cookie disclosure.
