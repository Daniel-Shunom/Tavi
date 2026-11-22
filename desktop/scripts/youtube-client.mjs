/** Google Desktop OAuth clients are public clients. Only this app identity is embedded;
 * account access/refresh tokens and credentials for confidential web clients never belong here. */
export function youtubeClientDefinition(env = process.env) {
  const clientId = env.TAVI_YOUTUBE_CLIENT_ID;
  const clientSecret = env.TAVI_YOUTUBE_CLIENT_SECRET;
  if (!clientId && !clientSecret) {
    if (env.TAVI_REQUIRE_YOUTUBE === '1')
      throw new Error(
        "Release requires Tavi's Google Desktop OAuth client. Configure TAVI_YOUTUBE_CLIENT_ID and TAVI_YOUTUBE_CLIENT_SECRET in the build environment.",
      );
    return 'undefined';
  }
  if (!clientId?.endsWith('.apps.googleusercontent.com') || !clientSecret)
    throw new Error(
      'Incomplete Google Desktop OAuth build configuration. Both TAVI_YOUTUBE_CLIENT_ID and TAVI_YOUTUBE_CLIENT_SECRET are required.',
    );
  return JSON.stringify({ client_id: clientId, client_secret: clientSecret });
}
