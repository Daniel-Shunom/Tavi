# Release updates mailing list

The signup form saves opt-ins in the **Tavi** Supabase project (`ijobzdgyesoqombzfptz`), in `public.mailing_list_subscribers`. View or export subscribers in the project's Table Editor. Each row records the normalized email, signup time, source, and consent version. A duplicate signup leaves the original row unchanged.

The browser uses only a publishable key. Anonymous visitors can insert an email and the consent version; they cannot read, update, or delete subscribers, or provide their own timestamps. Row Level Security and column permissions enforce this in the database. The schema is recorded in `supabase/mailing-list.sql` and was applied as the hosted migration `add_mailing_list_subscribers`.

## Local and production configuration

`.env.local` is ignored by Git, so a fresh checkout has none. Create `.env.local` in the repository root with the project's values from the Supabase dashboard (Project Settings, API: the project URL and the publishable key). For another environment, use that project's values:

```dotenv
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key
```

These are public browser settings. Never use a secret key or service role key. Set both variables in the production build environment and rebuild the site; Vite embeds them at build time. Missing or invalid settings disable signup with an availability message.

## Automatic email delivery

React Email 6.11.13 supplies the confirmation, welcome, and release templates. The `mailing-email` Edge Function delivers HTML and plain-text versions through Resend. Its server-only Resend key is never included in the website build.

New signups queue a confirmation email in the private `tavi_mail.outbox`. The Supabase job `tavi-mailing-email` runs every five minutes. When configured, the worker claims a small batch, sends each message individually, and records the provider ID. Failed messages retry up to five times within a 23-hour window with a stable Resend idempotency key. Leases prevent concurrent workers from claiming the same job. Pending jobs remain untouched while sender settings are missing.

The confirmation link displays a page with a button. Confirmation and unsubscribe pages live at the public website's `/email/confirm` and `/email/unsubscribe` routes. A small Vercel function forwards GET and POST to the Supabase function and restores the HTML content type (standard Supabase function hostnames rewrite GET HTML as plain text). Only a POST request confirms the address and queues one welcome email; opening a link in an email scanner does not confirm it. The link expires 72 hours after the first delivery attempt. Only confirmed, subscribed addresses are eligible for release announcements.

Every message includes an unsubscribe link, one-click unsubscribe headers, and a mailing address. Unsubscribing cancels pending messages and excludes the address from future releases. Resubmitting the signup form does not reactivate an opted-out address. There is no public subscriber read access.

The delivery schema and functions are recorded in `supabase/mailing-email.sql` (hosted migration `add_mailing_email_delivery`). The private tables intentionally use RLS with no public policies; only server-role operations and the narrowly scoped private insert trigger can reach them. The existing project advisor warnings about `public.rls_auto_enable` were not introduced by this migration: [anonymous access](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [signed-in access](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Activate sending

The Resend key has been added to [Tavi's Edge Function Secrets](https://supabase.com/dashboard/project/ijobzdgyesoqombzfptz/functions/secrets). The intended sender is `app@tavi.com`, but that domain is not yet owned or verified. Delivery stays paused until these additional secrets are supplied:

| Secret                | Value                                                                                                  |
| --------------------- | ------------------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY`      | Resend sending API key, already stored securely                                                        |
| `TAVI_EMAIL_FROM`     | A verified sender, such as `Tavi <app@tavi.com>`, once the domain is controlled and verified in Resend |
| `TAVI_PUBLIC_URL`     | The live HTTPS website URL, with the email assets published under `/media/email/`                      |
| `TAVI_POSTAL_ADDRESS` | The actual sender mailing address shown in the footer                                                  |

The function has a public [configuration status endpoint](https://ijobzdgyesoqombzfptz.supabase.co/functions/v1/mailing-email/status) that reports missing setting names, never key values. It reports configuration readiness, not DNS verification. Verify the sender domain in Resend and check a test delivery before sending a release. Also configure provider bounce/complaint suppression before growing the list; bounce webhooks are not implemented here.

## Review the designs

```powershell
npm run email:preview
```

Open http://127.0.0.1:4180. This renders three designs with example content and local copies of the Tavi branding assets. It never sends emails. Rendered HTML, plain text, and screenshots live in the Git-ignored `.data/email-previews/` directory. After editing a template, rerun `npx tsx tools/email-preview.ts` to regenerate the HTML; the running preview server reads the refreshed files. Character artwork provenance and license attribution are recorded in `public/media/email/CREDITS.md` and retained in every email footer.

## Review and queue a release

Copy `docs/release-email.example.json`, replace the sample content, and use a stable unique release ID:

```powershell
npm run email:release -- path/to/release.json
```

This writes a preview and queues nothing. After reviewing the result, configure server-only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in your shell (never `VITE_` variables) and explicitly queue it:

```powershell
npm run email:release -- path/to/release.json --send
```

The queue accepts only confirmed, subscribed addresses. Reusing a release ID does not queue the same release twice for an existing subscriber. This command deliberately requires review and `--send`; publishing a GitHub release does not currently send email automatically. The scheduled worker handles delivery after queueing, provided the sender settings are complete.

## Operations

Use the Supabase SQL Editor to inspect pending and exhausted jobs in `tavi_mail.outbox` (timestamps, attempts, and sanitized error codes). Private queue rows include subscriber emails; do not export or log them publicly. The scheduled job and Edge Function can be paused independently. To disable the schedule:

```sql
select cron.alter_job(job_id := jobid, active := false)
from cron.job where jobname = 'tavi-mailing-email';
```

Confirmation/unsubscribe routes remain available while the scheduled job is paused. The worker checks eligibility again just before sending; a message already handed to the email provider cannot be recalled.
