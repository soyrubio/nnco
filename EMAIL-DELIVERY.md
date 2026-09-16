# Discovery email delivery

Cloudflare continues to serve the website, validate submissions, save leads and
request the AI report. A Supabase Edge Function sends email through Resend.
It also creates the PDF attachment with bundled Geist fonts and the official
NNCo logo. It does not call AI or research a company again.

The PDF renderer runs outside Cloudflare because the free Worker CPU allowance
is too small for font embedding and PDF layout. Supabase includes Edge Function
invocations in its existing plans; it does not require a new email service.
Current allowances: [Supabase pricing](https://supabase.com/docs/guides/functions/pricing).

## What gets sent

- Each new Discovery submission sends one notification to `marek@nnco.ai`.
  This job is saved before AI generation, so a failed report does not lose the lead.
- Each completed version-two report sends a PDF to the submitted work email.
- Each new contact enquiry sends a notification to `marek@nnco.ai`.
- New Discovery submissions request the report and a related personal email
  discussing the findings and how NNCo could help. The request wording version
  is saved in the lead snapshot, with the submission timestamp on the lead.
  Notifications identify this request; it is not an ongoing marketing subscription.
  Older submissions retain their original optional follow-up choice.
- Notifications use the visitor's address as Reply-To. Report emails use
  `marek@nnco.ai` as Reply-To. The default sender is
  `NNCo Discovery <discovery@nnco.ai>`.
- Earlier records are not backfilled by these migrations. Previously completed
  version-one reports are not automatically emailed; start a new Discovery instead.

The website shows an email-delivery confirmation with a decorative blurred preview.
It does not receive the generated report content or provide a download button. The schedule processes one
job each minute while work is waiting. Two report-related emails normally need
about two schedule ticks; a backlog or retries can take longer.

## Production setup

Do this in the Supabase project used by the production Cloudflare Worker.
Do not create a second project. A website push alone does not deploy this function
or apply database migrations. Stage should use its own project and keep email off.

1. In Resend, verify `nnco.ai` for sending. Keep receiving disabled and preserve
   the existing Google MX records. Create a domain-scoped Sending access API key.
2. In Supabase, open **Edge Functions → Secrets**. Add `RESEND_API_KEY`.
   Set `EMAIL_DELIVERY_ENABLED` to `false` while setting up the function.
3. Generate a random dispatch secret of at least 32 characters. Store it as
   `EMAIL_DISPATCH_SECRET` in the same Secrets screen. Do not share keys in chat,
   commit them, or put them in a shell command.
4. Apply migrations `0005_email_outbox.sql` and `0006_email_schedule.sql`, after
   migrations `0001` through `0004`. Use the SQL Editor or your normal migration
   process. They add the protected outbox, database triggers and a dormant schedule.
5. From this repository, use an authenticated Supabase CLI to deploy the function:

   ```sh
   supabase functions deploy deliver-emails --project-ref YOUR_PROJECT_REF
   ```

   The CLI bundles imports from `src/server/email/` and the function's `deno.json`.
   The function appears in the dashboard after deployment. Its `verify_jwt = false`
   setting is intentional: every call is instead authenticated with the dedicated
   dispatch secret before any data is read or email is sent. A missing or short
   secret fails closed. The built-in Supabase service role credential stays server-side.
6. In Supabase Vault, create these two secrets through the dashboard:
   - `email_project_url`: the project's URL, such as `https://PROJECT_REF.supabase.co`.
   - `email_dispatch_secret`: exactly the same value as `EMAIL_DISPATCH_SECRET`.
   The schedule reads them from Vault. It does not embed credentials in its SQL.
7. Confirm that the jobs waiting in `email_jobs` are intended for delivery.
   Set `EMAIL_DELIVERY_ENABLED=true` when Resend is verified and the function is deployed.
8. Submit a diagnostic with an email address you control. Confirm both the
   internal notification and the visitor PDF. Check the attachment's two pages.
   Test the contact form as well. Use Resend's email log to confirm delivery.

Optional function secrets: `EMAIL_FROM`, `EMAIL_REPLY_TO` and `EMAIL_LEAD_TO`.
Defaults are the addresses listed above. These are Supabase function secrets,
not Cloudflare secrets. The website's normal Supabase credentials stay unchanged.

## Delivery status and retries

`email_jobs` references `lead_requests` and has one unique job per lead and email
kind. The trigger inserts jobs in the same transaction as the lead/report write.
There is no browser-accessible queue or arbitrary-recipient email endpoint.

- `pending`: waiting for a send or a scheduled retry.
- `processing`: a worker owns a five-minute lease.
- `accepted`: Resend accepted the request; this does **not** confirm inbox delivery.
- `failed`: a permanent error, eight exhausted attempts, or the retry window ended.

Use `provider_id` to find an accepted email in Resend's email log. Delivery,
bounces and complaints are checked there; webhook delivery events are not mirrored
into Supabase in this release. `last_error` stores a short error code, never
provider response bodies, credentials or report text in logs.

The worker stores the complete message before sending it. Retries reuse both the
message and the same Resend idempotency key. A network failure after acceptance
therefore does not create a second email. Retries stop before Resend's 24-hour
idempotency window expires. A failed job must be checked in Resend before an
operator decides to resend it. Do not blindly reset failed jobs.

Messages waiting for retry can contain the report attachment. Successful sends
clear that copy. Deleting a lead also deletes its jobs, including pending payloads.
The existing 90-day lead retention job still applies. Resend and recipient
mailboxes have their own storage and deletion policies.

To pause sending, set `EMAIL_DELIVERY_ENABLED=false`. Jobs remain saved. Review
pending jobs before re-enabling delivery after a pause. PDF content that cannot
fit in two pages fails visibly in the queue instead of being clipped or truncated.

## Find a submitted lead

Run this read-only query in the production SQL Editor, replacing the address:

```sql
select id, created_at, work_email, status,
       analysis_result is not null as has_report
from public.lead_requests
where lower(work_email) = lower('person@example.com')
order by created_at desc;
```

To inspect email status:

```sql
select l.work_email, j.kind, j.status, j.attempts,
       j.provider_id, j.accepted_at, j.last_error
from public.email_jobs j
join public.lead_requests l on l.id = j.lead_id
order by j.created_at desc;
```

## Local verification

- `pnpm test`: includes PostgreSQL queue tests, mocked Resend delivery and PDF tests.
- `pnpm check` and `pnpm build`: website integration checks.
- `deno check --config supabase/functions/deliver-emails/deno.json supabase/functions/deliver-emails/index.ts`:
  checks the Edge Function in its target runtime.
- `node scripts/build-email-pdf-assets.mjs`: regenerates the bundled font and logo
  data when the source assets change. Geist's SIL license is kept beside the fonts.

No production credentials are needed for the automated tests. Test fixtures use
fictional leads. Do not commit real submissions, generated client PDFs or secrets.
