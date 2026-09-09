-- Queue only new submissions. Existing leads are never emailed by this migration.
create table public.email_jobs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.lead_requests(id) on delete cascade,
  kind text not null check (kind in ('lead', 'report')),
  status text not null default 'pending' check (status in ('pending', 'processing', 'accepted', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  locked_at timestamptz,
  lock_token uuid,
  provider_id text,
  accepted_at timestamptz,
  last_error text,
  -- Store the exact Resend request before sending. Retries must use identical bytes.
  message jsonb,
  unique (lead_id, kind)
);
alter table public.email_jobs enable row level security;
revoke all on public.email_jobs from anon, authenticated;
grant all on public.email_jobs to service_role;
create index email_jobs_pending_idx on public.email_jobs (available_at) where status in ('pending', 'processing');

create function public.queue_lead_emails() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if TG_OP = 'INSERT' and NEW.snapshot->>'kind' in ('contact-enquiry', 'discovery-release') then
    insert into public.email_jobs (lead_id, kind) values (NEW.id, 'lead') on conflict do nothing;
  end if;
  if NEW.snapshot->>'kind' = 'discovery-release'
     and NEW.analysis_result->'report'->>'schemaVersion' = '2' then
    insert into public.email_jobs (lead_id, kind) values (NEW.id, 'report') on conflict do nothing;
  end if;
  return NEW;
end;
$$;
revoke all on function public.queue_lead_emails() from public, anon, authenticated;
create trigger queue_lead_emails after insert or update of analysis_result
on public.lead_requests for each row execute function public.queue_lead_emails();

-- One job per invocation keeps PDF processing within the Edge Function CPU budget.
create function public.claim_email_job() returns setof public.email_jobs
language plpgsql security definer set search_path = '' as $$
begin
  -- Resend remembers idempotency keys for 24 hours. Never retry past that window.
  update public.email_jobs set status = 'failed', last_error = 'retry_window_expired', message = null
  where status in ('pending', 'processing') and first_attempt_at < now() - interval '23 hours';
  update public.email_jobs set status = 'failed', last_error = 'attempts_exhausted'
  where attempts >= 8 and (status = 'pending' or (status = 'processing' and locked_at < now() - interval '5 minutes'));
  return query
  with candidate as (
    select id from public.email_jobs
    where (status = 'pending' and available_at <= now())
       or (status = 'processing' and locked_at < now() - interval '5 minutes')
    order by available_at, created_at for update skip locked limit 1
  )
  update public.email_jobs j set status = 'processing', locked_at = now(),
    lock_token = gen_random_uuid(), attempts = attempts + 1,
    first_attempt_at = coalesce(first_attempt_at, now())
  from candidate c where j.id = c.id returning j.*;
end;
$$;
revoke all on function public.claim_email_job() from public, anon, authenticated;
grant execute on function public.claim_email_job() to service_role;

comment on table public.email_jobs is
  'Transactional Resend outbox. accepted means provider acceptance, not inbox delivery. Deleted with the lead.';
