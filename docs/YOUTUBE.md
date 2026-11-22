# YouTube setup (beta)

YouTube sign-in is currently available to approved Google test accounts in YouTube-enabled Tavi test builds. Streamers do not need a Google Cloud project, API key or client JSON file.

## Connect your channel

1. Ask the Tavi maintainer to add your streaming Google account to the app's test-user list.
2. Open Studio → Setup → YouTube connection and select **Connect YouTube**, then **Sign in with Google**.
3. Choose your streaming account/channel, approve read-only access and return to Studio.
4. Start a YouTube broadcast with live chat enabled. Tavi connects automatically when one is active; select the broadcast if several are listed.

Keep Tavi running on the same computer while you stream. Reconnect after restarting the app. Use the normal Tavi OBS overlay.

## Maintainer setup

1. Create a **Tavi** project in [Google Cloud Console](https://console.cloud.google.com/) and enable **YouTube Data API v3**.
2. Configure Google Auth Platform with Tavi's app name and contact email. Set the audience to **External**, keep the app in **Testing**, and add approved test accounts.
3. Add `https://www.googleapis.com/auth/youtube.readonly` under Data Access.
4. Create a **Desktop app** OAuth client named **Tavi Studio**.
5. Set both repository Actions secrets: `TAVI_YOUTUBE_CLIENT_ID` and `TAVI_YOUTUBE_CLIENT_SECRET`. The installer includes Tavi's shared Desktop client identity; never use a confidential Web application client or account tokens as build inputs.
6. Build a test installer and verify sign-in with an approved account and an active broadcast.

For `npm start` development, set the same two variables in the Node service's process environment and restart it. The service does not automatically load `.env` files. For local release builds, `TAVI_REQUIRE_YOUTUBE=1` requires the identity to be configured before packaging.

Before making sign-in generally available, publish the OAuth application and complete Google's applicable branding, website/privacy-policy and scope-verification setup. [Google's Desktop OAuth guide](https://developers.google.com/identity/protocols/oauth2/native-app).
