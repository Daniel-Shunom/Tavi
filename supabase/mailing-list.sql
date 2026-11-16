-- Applied to the hosted Tavi project as add_mailing_list_subscribers.
create table public.mailing_list_subscribers (
  email text primary key,
  created_at timestamptz not null default now(),
  consent_version text not null,
  source text not null default 'landing',
  constraint mailing_list_email_valid check (
    email = lower(btrim(email))
    and char_length(email) between 3 and 254
    and email ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
  ),
  constraint mailing_list_consent_valid check (consent_version = 'release-updates-v1'),
  constraint mailing_list_source_valid check (source = 'landing')
);

alter table public.mailing_list_subscribers enable row level security;
revoke all on public.mailing_list_subscribers from public, anon, authenticated;
grant insert (email, consent_version) on public.mailing_list_subscribers to anon;

create policy "Visitors may sign up for release updates"
  on public.mailing_list_subscribers
  for insert to anon
  with check (consent_version = 'release-updates-v1' and source = 'landing');

comment on table public.mailing_list_subscribers is
  'Release update opt-ins. Public clients may insert email and consent only; no public read, update, or delete access.';
