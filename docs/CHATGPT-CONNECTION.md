# ChatGPT connection

Studio → Decision provider → **Continue with ChatGPT**. Finish consent in the system browser and return to Tavi. A successful connection activates ChatGPT automatically; choose another available model with **Use this**. Disconnect removes local credentials and attempts remote revocation. No app API key or client secret is used.

This powers bounded expression/caption decisions from selected recent chat context. Speech, microphone input, and external donations remain separate features. Rules take over when the account is unavailable, a request fails, or the existing per-minute/session budget is exhausted.

## Storage and boundaries

- Windows only: credentials are encrypted with current-user Windows DPAPI in `.data/chatgpt.dpapi`, or `TAVI_DATA_DIR/chatgpt.dpapi` in the desktop app. There is no plaintext fallback. The non-secret host registration and provider choice are stored alongside it.
- The local service owns tokens, refresh rotation and inference. Public status contains account email, available models and connection state. Authorization opens OpenAI's official browser page; returning authorization can include the documented ID-token hint. Access and refresh tokens never enter Studio state or browser storage.
- PKCE S256, random state and nonce, loopback callback, issued client ID, signature/issuer/audience/expiry checks, identity continuity, and granted plan-use scope are enforced.
- Model choices come from the signed-in account catalog. Responses use `store:false` and streaming; only a completed stream can produce an AI decision. Cancellation/disconnect invalidates pending results. Errors fall back to rules, never to an app-funded API credential.

## Availability and verification

The direct dynamic-registration route is OpenAI's open-source/local-client preview. A paid/commercial hosted distribution may require OpenAI approval. Verify eligibility before release; this implementation is not a claim of approval or universal account availability. Plan limits still apply.

Automated tests use a fake OAuth issuer response and memory store; they do not sign into a real account. Final acceptance requires user-driven browser consent on an eligible account, one live chat reaction, restart/restore, then disconnect. Rebuild the Windows installer to deliver these source changes; installed releases do not update automatically.

Official references: [Registration and sign-in](https://developers.openai.com/siwc/token-sharing-open-source/sign-in), [Models and inference](https://developers.openai.com/siwc/token-sharing-open-source/models-and-inference), [Preview limitations](https://developers.openai.com/siwc/token-sharing-open-source/preview-limitations).

## Handoff ? October 29, 2026

Implemented in `server/ai/chatgpt.ts`, DPAPI storage, `/api/chatgpt` routes, provider manager, and `src/AiPanel.tsx`. Desktop browser allowlist and selection persistence are updated in source. Dependency: `jose`. The running local service was restarted after implementation.

Validation: full suite 506 tests passed before the final three recovery tests; all 19 ChatGPT tests subsequently passed, including the added recovery cases. Skills verification passed (14 skills, 130 pinned files). Production and desktop TypeScript builds passed before final lint cleanup. OAuth tests use fakes; real consent and inference are still pending. No real account was authorized and no installer was rebuilt.

Next acceptance: open Studio ? Decision provider ? Continue with ChatGPT, authorize an eligible account, confirm a real reaction, restart/restore, disconnect. Voice remains unimplemented.

Final checks: all 19 ChatGPT tests, production build, desktop TypeScript, and targeted ESLint passed. Desktop/mobile controls passed in Chromium against the built service on port 4318. Screenshots: `.impeccable/review/chatgpt/`. Chrome opened at `http://127.0.0.1:4318/studio#brain`. The Vite page's load event timed out in one browser run; verification used the production-served app successfully. Existing unrelated whitespace in skills lock/art files still causes the repository-wide `git diff --check` to fail; auth files pass targeted lint.

Session ID: `01a17704-cc9a-7d01-822a-754a6062ab3c`
