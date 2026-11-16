-- Hosted migration: add_mailing_email_delivery. No API keys are stored in this file.
create schema tavi_mail;
revoke all on schema tavi_mail from public, anon, authenticated;
grant usage on schema tavi_mail to service_role;

alter table public.mailing_list_subscribers
  add column subscriber_id uuid not null default gen_random_uuid() unique,
  add column confirmation_token uuid not null default gen_random_uuid() unique,
  add column confirmation_expires_at timestamptz,
  add column unsubscribe_token uuid not null default gen_random_uuid() unique,
  add column confirmed_at timestamptz,
  add column unsubscribed_at timestamptz;

create table tavi_mail.outbox (
  id uuid primary key default gen_random_uuid(),
  email text not null references public.mailing_list_subscribers(email) on delete cascade,
  kind text not null check (kind in ('confirmation', 'welcome', 'release')),
  dedupe_key text not null unique,
  release jsonb,
  created_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  next_attempt_at timestamptz not null default now(),
  attempts integer not null default 0,
  lease uuid,
  lease_until timestamptz,
  sent_at timestamptz,
  cancelled_at timestamptz,
  provider_id text,
  last_error text
);
create index mailing_outbox_pending on tavi_mail.outbox (next_attempt_at)
  where sent_at is null and cancelled_at is null;

create table tavi_mail.worker_settings (
  name text primary key,
  token text not null default (gen_random_uuid()::text || gen_random_uuid()::text)
);
insert into tavi_mail.worker_settings(name) values ('worker');
alter table tavi_mail.outbox enable row level security;
alter table tavi_mail.worker_settings enable row level security;
revoke all on all tables in schema tavi_mail from public, anon, authenticated;
grant select, insert, update, delete on all tables in schema tavi_mail to service_role;
grant select, update on public.mailing_list_subscribers to service_role;

-- The anonymous INSERT trigger needs narrowly scoped elevated access to its private outbox.
-- It is a trigger function in a non-exposed schema, never an anonymous RPC.
create function tavi_mail.queue_confirmation() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into tavi_mail.outbox(email, kind, dedupe_key)
    values (new.email, 'confirmation', 'confirmation/' || new.subscriber_id::text)
    on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
revoke all on function tavi_mail.queue_confirmation() from public, anon, authenticated;
create trigger queue_mailing_confirmation after insert on public.mailing_list_subscribers
for each row execute function tavi_mail.queue_confirmation();

-- Existing opt-ins also need confirmation before any newsletters are sent.
insert into tavi_mail.outbox(email, kind, dedupe_key)
select email, 'confirmation', 'confirmation/' || subscriber_id::text
from public.mailing_list_subscribers on conflict (dedupe_key) do nothing;

create function public.mailing_worker_authorized(worker_token text) returns boolean
language sql security invoker set search_path = '' as $$
  select exists(select 1 from tavi_mail.worker_settings where name = 'worker' and token = worker_token);
$$;

create function public.mailing_claim_jobs() returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare jobs jsonb;
begin
  with candidates as (
    select o.id from tavi_mail.outbox o
    join public.mailing_list_subscribers s on s.email = o.email
    where o.sent_at is null and o.cancelled_at is null and o.attempts < 5
      and o.next_attempt_at <= now() and (o.lease_until is null or o.lease_until < now())
      and (o.first_attempt_at is null or o.first_attempt_at > now() - interval '23 hours')
      and s.unsubscribed_at is null
      and ((o.kind = 'confirmation' and s.confirmed_at is null)
        or (o.kind <> 'confirmation' and s.confirmed_at is not null))
    order by o.next_attempt_at limit 5 for update of o skip locked
  ), claimed as (
    update tavi_mail.outbox o set attempts = attempts + 1,
      first_attempt_at = coalesce(first_attempt_at, now()),
      lease = gen_random_uuid(), lease_until = now() + interval '5 minutes'
    from candidates c where o.id = c.id returning o.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', c.id, 'lease', c.lease, 'email', c.email, 'kind', c.kind, 'release', c.release,
    'confirmationToken', s.confirmation_token, 'unsubscribeToken', s.unsubscribe_token
  )), '[]'::jsonb) into jobs from claimed c
  join public.mailing_list_subscribers s on s.email = c.email;
  update public.mailing_list_subscribers s set confirmation_expires_at = now() + interval '72 hours'
    where exists(select 1 from tavi_mail.outbox o where o.email = s.email
      and o.kind = 'confirmation' and o.attempts = 1 and o.lease_until > now());
  return jobs;
end;
$$;

create function public.mailing_finish_job(job_id uuid, job_lease uuid, sent_id text, error_code text) returns void
language sql security invoker set search_path = '' as $$
  update tavi_mail.outbox set
    sent_at = case when sent_id is not null then now() else null end,
    provider_id = sent_id, last_error = left(error_code, 100), lease_until = null,
    next_attempt_at = now() + (interval '1 minute' * power(2, attempts))
  where id = job_id and lease = job_lease and sent_at is null;
$$;

create function public.mailing_job_allowed(job_id uuid, job_lease uuid) returns boolean
language sql security invoker set search_path = '' as $$
  select exists(select 1 from tavi_mail.outbox o join public.mailing_list_subscribers s on s.email = o.email
    where o.id = job_id and o.lease = job_lease and o.sent_at is null and o.cancelled_at is null
      and o.lease_until > now() and s.unsubscribed_at is null
      and ((o.kind = 'confirmation' and s.confirmed_at is null) or (o.kind <> 'confirmation' and s.confirmed_at is not null)));
$$;

create function public.mailing_confirm(confirmation uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare subscriber public.mailing_list_subscribers;
begin
  update public.mailing_list_subscribers set confirmed_at = coalesce(confirmed_at, now())
  where confirmation_token = confirmation and unsubscribed_at is null
    and confirmation_expires_at > now()
  returning * into subscriber;
  if subscriber.email is null then return false; end if;
  insert into tavi_mail.outbox(email, kind, dedupe_key)
    values (subscriber.email, 'welcome', 'welcome/' || subscriber.subscriber_id::text)
    on conflict (dedupe_key) do nothing;
  update tavi_mail.outbox set cancelled_at = now()
    where email = subscriber.email and kind = 'confirmation' and sent_at is null;
  return true;
end;
$$;

create function public.mailing_unsubscribe(unsubscribe uuid) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare subscriber_email text;
begin
  update public.mailing_list_subscribers set unsubscribed_at = coalesce(unsubscribed_at, now())
    where unsubscribe_token = unsubscribe returning email into subscriber_email;
  if subscriber_email is null then return false; end if;
  update tavi_mail.outbox set cancelled_at = now() where email = subscriber_email and sent_at is null;
  return true;
end;
$$;

create function public.mailing_queue_release(release_content jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare added integer;
begin
  if jsonb_typeof(release_content->'id') is distinct from 'string'
    or jsonb_typeof(release_content->'title') is distinct from 'string'
    or jsonb_typeof(release_content->'body') is distinct from 'string'
    or jsonb_typeof(release_content->'url') is distinct from 'string'
    or coalesce(release_content->>'id', '') !~ '^[a-zA-Z0-9._-]{1,80}$'
    or char_length(coalesce(release_content->>'title', '')) not between 1 and 160
    or char_length(coalesce(release_content->>'body', '')) not between 1 and 8000
    or coalesce(release_content->>'url', '') !~ '^https://[^[:space:]]+$'
    then raise exception 'Invalid release content'; end if;
  insert into tavi_mail.outbox(email, kind, dedupe_key, release)
  select email, 'release', 'release/' || (release_content->>'id') || '/' || subscriber_id::text, release_content
  from public.mailing_list_subscribers where confirmed_at is not null and unsubscribed_at is null
  on conflict (dedupe_key) do nothing;
  get diagnostics added = row_count;
  return added;
end;
$$;

revoke all on function public.mailing_worker_authorized(text), public.mailing_claim_jobs(),
  public.mailing_finish_job(uuid, uuid, text, text), public.mailing_confirm(uuid),
  public.mailing_unsubscribe(uuid), public.mailing_queue_release(jsonb), public.mailing_job_allowed(uuid, uuid) from public, anon, authenticated;
grant execute on function public.mailing_worker_authorized(text), public.mailing_claim_jobs(),
  public.mailing_finish_job(uuid, uuid, text, text), public.mailing_confirm(uuid),
  public.mailing_unsubscribe(uuid), public.mailing_queue_release(jsonb), public.mailing_job_allowed(uuid, uuid) to service_role;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('tavi-mailing-email', '*/5 * * * *', $cron$
  select net.http_post(
    url := 'https://ijobzdgyesoqombzfptz.supabase.co/functions/v1/mailing-email/process',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization',
      'Bearer ' || (select token from tavi_mail.worker_settings where name = 'worker')),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
$cron$);
