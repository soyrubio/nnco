alter table public.lead_requests
  add column if not exists expires_at timestamptz,
  add column if not exists retention_hold boolean not null default false;

update public.lead_requests
set expires_at = created_at + interval '90 days'
where expires_at is null
   or expires_at > created_at + interval '90 days';

delete from public.lead_requests
where expires_at <= now() and retention_hold = false;

alter table public.lead_requests
  alter column expires_at set default (now() + interval '90 days'),
  alter column expires_at set not null;

create index if not exists lead_requests_expiry_idx
  on public.lead_requests (expires_at)
  where retention_hold = false;

create extension if not exists pg_cron;

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'nnco-delete-expired-lead-requests'
  ) then
    perform cron.schedule(
      'nnco-delete-expired-lead-requests',
      '17 2 * * *',
      $command$
        delete from public.lead_requests
        where expires_at <= now() and retention_hold = false
      $command$
    );
  end if;
end
$$;

comment on column public.lead_requests.expires_at is
  'Normal deletion deadline for website contact and diagnostic submissions.';

comment on column public.lead_requests.retention_hold is
  'Set only when an engagement or legal obligation requires longer retention.';
