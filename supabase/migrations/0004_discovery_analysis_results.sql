alter table public.lead_requests
  add column if not exists analysis_result jsonb,
  add column if not exists analysis_completed_at timestamptz,
  add column if not exists analysis_started_at timestamptz,
  add column if not exists analysis_claim_token uuid;

create or replace function public.claim_discovery_analysis(
  p_request_id uuid,
  p_request_hash text
)
returns table (claim_state text, analysis_result jsonb, claim_token uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  lead public.lead_requests%rowtype;
  new_claim_token uuid;
begin
  select * into lead
  from public.lead_requests
  where request_id = p_request_id
  for update;

  if not found or lead.request_hash <> p_request_hash then
    raise exception 'Unknown or conflicting discovery request';
  end if;

  if lead.analysis_result is not null then
    return query select 'completed'::text, lead.analysis_result, null::uuid;
    return;
  end if;

  if lead.analysis_started_at is not null
     and lead.analysis_started_at > now() - interval '2 minutes' then
    return query select 'pending'::text, null::jsonb, null::uuid;
    return;
  end if;

  new_claim_token := gen_random_uuid();
  update public.lead_requests
  set status = 'analysing',
      analysis_started_at = now(),
      analysis_claim_token = new_claim_token
  where request_id = p_request_id;
  return query select 'claimed'::text, null::jsonb, new_claim_token;
end;
$$;

revoke all on function public.claim_discovery_analysis(uuid, text)
  from public, anon, authenticated;
grant execute on function public.claim_discovery_analysis(uuid, text)
  to service_role;

comment on column public.lead_requests.analysis_result is
  'Completed discovery response cached for idempotent replay; deleted with the lead.';

comment on column public.lead_requests.analysis_completed_at is
  'Timestamp used to replay a completed discovery analysis without another model call.';

comment on column public.lead_requests.analysis_started_at is
  'Short lease timestamp preventing concurrent model runs for the same request.';

comment on column public.lead_requests.analysis_claim_token is
  'Opaque lease owner required to complete or release an analysis claim.';
