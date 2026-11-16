import { createMailingHandler } from '../_shared/mailing-handler.ts';

// Supabase supplies its URL and service-role key only inside the Edge Function.
const handler = createMailingHandler({
  supabaseUrl: Deno.env.get('SUPABASE_URL') ?? '',
  serviceKey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  resendKey: Deno.env.get('RESEND_API_KEY') ?? '',
  sender: Deno.env.get('TAVI_EMAIL_FROM') ?? '',
  siteUrl: Deno.env.get('TAVI_PUBLIC_URL') ?? '',
  postalAddress: Deno.env.get('TAVI_POSTAL_ADDRESS') ?? '',
});
Deno.serve(handler);
