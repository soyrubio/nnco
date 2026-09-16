create extension if not exists pg_net with schema extensions;

-- Vault values are supplied by the operator. No credentials are stored in this migration.
create function public.dispatch_email_job() returns void
language plpgsql security definer set search_path = '' as $$
declare
  project_url text;
  dispatch_secret text;
begin
  select decrypted_secret into project_url from vault.decrypted_secrets where name = 'email_project_url';
  select decrypted_secret into dispatch_secret from vault.decrypted_secrets where name = 'email_dispatch_secret';
  if project_url is null or dispatch_secret is null then return; end if;
  if project_url !~ '^https://[a-z0-9]+\.supabase\.co$' or length(dispatch_secret) < 32 then
    raise exception 'Email schedule configuration is invalid';
  end if;
  if exists (select 1 from public.email_jobs where status in ('pending', 'processing')) then
    perform net.http_post(
      url := project_url || '/functions/v1/deliver-emails',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || dispatch_secret),
      body := '{}'::jsonb,
      timeout_milliseconds := 60000
    );
  end if;
end;
$$;
revoke all on function public.dispatch_email_job() from public, anon, authenticated;
grant execute on function public.dispatch_email_job() to service_role;
select cron.schedule('nnco-deliver-email', '* * * * *', 'select public.dispatch_email_job()');
