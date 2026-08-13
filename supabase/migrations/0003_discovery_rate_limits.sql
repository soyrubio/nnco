create table if not exists public.discovery_rate_events (
  scope text not null,
  key_hash text not null,
  occurred_at timestamptz not null default now()
);

create index if not exists discovery_rate_events_lookup_idx
  on public.discovery_rate_events (scope, key_hash, occurred_at);

alter table public.discovery_rate_events enable row level security;

create or replace function public.check_discovery_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  event_count integer;
  oldest_event timestamptz;
begin
  if p_limit < 1 or p_window_seconds < 1 or length(p_scope) > 80 or length(p_key_hash) <> 64 then
    raise exception 'Invalid rate-limit request';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_scope || ':' || p_key_hash, 0));

  delete from public.discovery_rate_events
  where occurred_at <= now() - interval '1 day';

  select count(*), min(occurred_at)
    into event_count, oldest_event
  from public.discovery_rate_events
  where scope = p_scope
    and key_hash = p_key_hash
    and occurred_at > now() - make_interval(secs => p_window_seconds);

  if event_count >= p_limit then
    return query select false, greatest(
      1,
      ceil(extract(epoch from oldest_event + make_interval(secs => p_window_seconds) - now()))::integer
    );
    return;
  end if;

  insert into public.discovery_rate_events (scope, key_hash) values (p_scope, p_key_hash);
  return query select true, 0;
end;
$$;

revoke all on function public.check_discovery_rate_limit(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.check_discovery_rate_limit(text, text, integer, integer)
  to service_role;

comment on table public.discovery_rate_events is
  'Short-lived server-side events used for atomic discovery abuse limits.';

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'nnco-delete-discovery-rate-events'
  ) then
    perform cron.schedule(
      'nnco-delete-discovery-rate-events',
      '43 2 * * *',
      $command$
        delete from public.discovery_rate_events
        where occurred_at <= now() - interval '1 day'
      $command$
    );
  end if;
end
$$;
