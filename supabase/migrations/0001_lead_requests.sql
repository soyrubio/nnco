create extension if not exists pgcrypto;

create table if not exists public.lead_requests (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique,
  case_id text not null,
  case_revision integer not null check (case_revision >= 0),
  work_email text not null,
  organisation text not null,
  name text,
  consent_version text not null,
  consented_at timestamptz not null,
  request_hash text not null,
  snapshot jsonb not null,
  status text not null default 'received',
  created_at timestamptz not null default now()
);

alter table public.lead_requests enable row level security;

comment on table public.lead_requests is
  'Server-only discovery handoffs. No browser role receives a policy.';
