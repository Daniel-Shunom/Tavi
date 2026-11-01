// Hosted visitors start an isolated preview; local and desktop installs open Studio.
export const hostedPreview = import.meta.env['VITE_TAVI_JUDGING'] === 'true';
export const studioEntryHref = hostedPreview ? '/judge' : '/studio';
