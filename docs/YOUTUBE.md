# YouTube connection

Tavi can sign in to a YouTube channel and read its active broadcast's live chat. Chat enters the same behaviour engine as Twitch: name mentions, quiet mode, retraction, engagement settings and cooldowns still apply. The existing OBS Browser Source works on either platform. This integration does not send chat messages or control broadcasts.

## For streamers

Install a Tavi release with YouTube enabled, open **Setup → Let her hear chat**, and select **Connect YouTube**. Continue through Google's sign-in and consent screen, then return to Tavi. You do not need a Google Cloud project, client JSON download, API key, environment variable or other configuration file. Tavi's installer includes its shared Google Desktop OAuth identity.

If this development build says YouTube sign-in is unavailable, the maintainer has not configured its release identity yet. This is a build configuration issue; streamers should not be asked to fix it themselves.

## Maintainer setup: register Tavi once

The following steps are for Tavi's developer and release pipeline, not streamers.

1. Create or choose a project in [Google Cloud Console](https://console.cloud.google.com/).
2. Enable **YouTube Data API v3** in APIs & Services → Library.
3. In **Google Auth Platform**, configure the app's branding, audience and contact information. For development, keep it in Testing and add your streaming Google account as a test user.
4. Under Data Access, add `https://www.googleapis.com/auth/youtube.readonly`.
5. Under Clients, create an OAuth client with application type **Desktop app**. This is the local Windows service flow; a Web application client is a different setup.
6. Set `TAVI_YOUTUBE_CLIENT_ID` and `TAVI_YOUTUBE_CLIENT_SECRET` in the release build environment using that **Desktop app** client. For GitHub installers, add repository Actions secrets with those names. The installer workflow passes them to the packager on every platform. Do not use a confidential Web application OAuth client here.
7. Build Tavi. The packager embeds only this Desktop client's identity into the Node service, never account access/refresh tokens or other environment credentials. Streamers receive it with the installer. Tagged public releases fail before packaging if the identity is missing or incomplete; unconfigured development/fork builds can still build with YouTube unavailable. For local release builds, set `TAVI_REQUIRE_YOUTUBE=1` to enforce the same check.
8. Before public distribution, configure Tavi's real branding and policy pages, publish the Google OAuth application, complete the applicable scope verification, and test a real Google account and live broadcast. The shared project owns quota for all Tavi users; monitor it and plan quota capacity before broad distribution.

For maintainer development with `npm start`, set **both** variables in the Node service's process environment, or save your Desktop client download as `.data/youtube-client.json`, keeping Google's `installed` wrapper. This developer-only fallback is ignored by Git and is not a user installation step. The service does not load `.env` automatically. Never paste the download or account tokens into chat or commit them to source control.

Packaged builds prefer the embedded identity over any local file. A process environment override remains available to maintainers for testing. Google sign-in opens in the system browser and the callback follows the app's actual port if 4318 is occupied. Existing installed releases need a rebuilt app before this feature is available; native sign-in and OBS acceptance testing remain pending.

Google's desktop authorization flow uses your system browser, a loopback callback at `http://127.0.0.1:4318/api/youtube/callback` (or your `TAVI_PORT`), PKCE and a single-use state nonce that expires after ten minutes. Open Studio on the same computer as the Tavi service. An OAuth desktop client cannot keep its client secret confidential; PKCE protects the code exchange. Access and refresh tokens stay in service memory and are never saved to disk.

## Connect and stream

1. In Setup → Let her hear chat → YouTube connection, select **Connect YouTube**, then **Sign in with Google**.
2. Select the Google account and YouTube channel you stream with. Approve read-only access, then return to Studio. For private development builds in Google's Testing mode, the maintainer must add the account to the project's test users.
3. Start a YouTube broadcast with live chat enabled. Tavi checks for an active broadcast once per minute while waiting. One eligible broadcast connects automatically; if several are active, choose one in Studio.
4. Send a new message mentioning your companion's name. Recent YouTube messages appear in Setup; eligible reactions appear in Studio and the synchronized OBS overlay. Existing chat history is skipped.
5. Disconnect clears local tokens and attempts to revoke Google access. You must sign in again after restarting Tavi. You can also remove access in your Google account's third-party connections.

Google can return an account without an eligible streaming channel, a disabled-chat broadcast, an expired grant, API permission errors or quota errors. Studio reports these without exposing Google's raw response or credentials. The connection retries temporary network failures, respects moderation deletions/bans, and returns to waiting when chat ends. Message and user IDs carry a `youtube:` prefix so they cannot collide with Twitch IDs.

## Current limits and release requirements

- This milestone uses the supported REST `liveChatMessages.list` endpoint with continuation tokens. It waits at least the server's `pollingIntervalMillis` and at least ten seconds between chat reads. This means chat reactions have polling latency and consume project quota. Quota exhaustion stops the connection rather than retrying aggressively. Monitor your project's quota before long streams or multiple users.
- Google's recommended [`streamList`](https://developers.google.com/youtube/data/live/reference/rest/v3/liveChatMessages/streamList) server-streaming transport is a follow-up for lower latency and lower quota consumption. This implementation does not claim to use it.
- Text messages and moderation are handled. Super Chats, memberships and other YouTube-specific events are not yet mapped into Tavi's event reactions.
- Both platform connections can remain active, sharing Tavi's behaviour cooldowns. This is not a cross-platform chat relay.
- Public distribution needs your own Google OAuth branding, public policy pages and any required Google verification for the requested scope. A testing client is suitable for your listed test accounts, not a finished public login service. Testing-mode refresh tokens for this scope may expire after seven days.
- The account/login flow must still be verified with a real Google client and a live YouTube broadcast. Automated tests use fake Google responses; they do not represent a real account test.

See Google's [desktop OAuth guide](https://developers.google.com/identity/protocols/oauth2/native-app), [broadcast listing reference](https://developers.google.com/youtube/data/live/reference/rest/v3/liveBroadcasts/list) and [chat polling reference](https://developers.google.com/youtube/data/live/reference/rest/v3/liveChatMessages/list).
