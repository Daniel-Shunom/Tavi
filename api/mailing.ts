import { createMailingPageHandler } from '../server/mailing-pages.js';

// This proxy needs the public project URL only, never a service-role or Resend key.
export default createMailingPageHandler(() => process.env['VITE_SUPABASE_URL'] ?? '');
