# Astro deployment notes

## Runtime architecture

The marketing pages can be statically generated, but contact and discovery use
server routes. Production therefore requires an Astro server adapter.
`@astrojs/cloudflare` is installed and `astro.config.mjs` uses server output
with the Cloudflare adapter. `wrangler.jsonc` pins the Worker name and runtime
compatibility settings; the adapter supplies the generated Worker entry and
asset bindings.

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

Local development uses the Cloudflare adapter's `workerd` runtime so server
routes behave like their deployed Worker equivalents. The Vite configuration
explicitly enables dependency discovery so renderer integrations contribute
their complete server dependency lists, and pre-bundles the remaining late
Astro imports `astro/assets/services/noop` and `astro/logger/json` before
workerd starts. This is the scoped workaround for the upstream Astro SSR
dependency optimizer race tracked in `withastro/astro#17456`; do not replace it
with broad Astro exclusions or a separate Node-only development adapter. After
the upstream fix reaches the pinned Astro release, remove the workaround and
its focused regression test together.

Contact enquiries and submitted diagnostics use the same repository and the
same `lead_requests` table. Contact records are distinguished by the
`contact-enquiry` snapshot kind.

## Release environments

GitHub Actions is the only deployment owner. Do not also connect Cloudflare
Workers Builds, because that would deploy the same commit through a second,
independent pipeline.

| Git branch | Cloudflare Worker | Domain | Behavior |
| --- | --- | --- | --- |
| `development` | None | None | Personal branch; CI only |
| `stage` | `nnco-stage` | `stage.nnco.ai` | Automatic, Basic Auth protected |
| `main` | `nnco` | `nnco.ai` | Automatic production deployment |

Work on `development`, then promote changes with pull requests to `stage` and
finally from `stage` to `main`. The `CI` workflow checks `development` pushes
and pull requests into the two release branches. Only pushes to `stage` or
`main` build and deploy a Worker.

### One-time GitHub setup

1. Create `stage` from `main`. Keep `development` as the personal working
   branch; it has no Cloudflare environment or deployment.
2. Add the repository Actions secret `CLOUDFLARE_API_TOKEN`. Create it from
   Cloudflare's **Edit Cloudflare Workers** token template and scope it only to
   the NNCO account and `nnco.ai` zone.
3. Add the repository Actions variable `CLOUDFLARE_ACCOUNT_ID`.
4. Create GitHub Environments named `stage` and `production`. Limit each to its
   matching branch. Keep a required reviewer on `production` through the first
   DNS cutover; it can be removed later if fully automatic production releases
   are preferred.
5. Protect `stage` and `main` with pull requests and the `CI / Test and build`
   required check. `development` does not need protection.

The Cloudflare token and account ID authenticate deployments only. Application
secrets stay in Cloudflare and are never copied into GitHub Actions.

### One-time Cloudflare setup

Keep the two independent Workers `nnco` and `nnco-stage`. Attach
`stage.nnco.ai` as a Custom Domain on `nnco-stage`. During the approved
production cutover, replace the existing apex origin with a Custom Domain from
`nnco` to `nnco.ai`; handle `www.nnco.ai` as either a redirect to the apex or a
second Custom Domain. Do not change the apex records until the production
Worker has all runtime secrets and passes a direct preview check.

The Wrangler configuration commits non-sensitive runtime settings so every
deployment is reproducible. Secrets must be set independently on both Workers;
Wrangler environments do not inherit them. Configure production without
`--env`, and stage with `--env stage`:

```text
OPENAI_API_KEY
SUPABASE_URL
SUPABASE_SECRET_KEY
DISCOVERY_CONTEXT_SIGNING_SECRET
DISCOVERY_RATE_LIMIT_SECRET
```

Stage additionally requires:

```text
BASIC_AUTH_PASS
```

Use `pnpm wrangler secret put <NAME>` for production and
`pnpm wrangler secret put <NAME> --env stage` for stage. Prefer a separate
Supabase project for stage so test submissions cannot enter production data.

### Manual deployments

GitHub Actions is the normal release path. For recovery, an authenticated
operator can run:

```bash
pnpm deploy:stage
pnpm deploy
```

The pnpm workspace permits only the `esbuild` and `workerd` dependency install
scripts required by Astro and Cloudflare's local runtime; other dependency
build scripts remain blocked.

### Stage authentication

Stage uses the separate `nnco-stage` Wrangler environment and Worker. Build it
with `CLOUDFLARE_ENV=stage` so Astro selects the stage entrypoint during its
build phase:

```text
pnpm build:stage
pnpm wrangler deploy
```

The equivalent one-shot command is `pnpm deploy:stage`. Production continues
to use Astro's standard Cloudflare entrypoint and `pnpm deploy`; it does not
contain the authentication gate.

The stage entrypoint requires HTTP Basic Auth before delegating to Astro's
Cloudflare handler. Its `assets.run_worker_first: true` setting sends every
request through the gate before either a static asset or a server/API route can
be served. Missing `BASIC_AUTH_USER` or `BASIC_AUTH_PASS` secrets fail closed
with `503`; invalid or absent credentials receive the browser's `401` password
challenge. Gate responses are non-cacheable and excluded from indexing. Use
Basic Auth only through Cloudflare HTTPS.

The stage username is the committed non-sensitive value `stage`. Configure the
password as an encrypted secret on the `stage` Worker environment:

```text
pnpm wrangler secret put BASIC_AUTH_PASS --env stage
```

The `Deploy stage` workflow builds and deploys the stage environment without
uploading application secrets. Configure all runtime secrets directly on
`nnco-stage` before merging into the `stage` branch.

The committed Wrangler variables provide the public origin, production modes,
and model defaults. The corresponding production behavior is:

```dotenv
PUBLIC_APP_URL=https://nnco.ai
LEAD_HANDOFF_MODE=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=sb_secret_server-only-value
DISCOVERY_RATE_LIMIT_MODE=supabase
DISCOVERY_CONTEXT_SIGNING_SECRET=at-least-32-random-characters
DISCOVERY_RATE_LIMIT_SECRET=a-different-32-character-random-secret
```

Apply every file in `supabase/migrations/` in order before enabling Supabase.
The retention migration adds a 90-day expiry and a nightly deletion job. Mark
only records that must move into an engagement or legal hold with
`retention_hold = true`.
The current Supabase secret key is read only by the server repository and must
never use a `PUBLIC_` prefix or enter a browser island. Legacy
`SUPABASE_SERVICE_ROLE_KEY` values remain supported while existing projects
migrate, but new projects should use `SUPABASE_SECRET_KEY`.

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
Each hostname is checked against public DNS before fetching, including after
redirects, while Cloudflare's outbound proxy rejects private destinations.
Enriched company context is signed before it is returned to the browser and
verified again before analysis. The submitted
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
