# Public Flowst → Airs demonstration

Use the private Flowst deployment as the entry and this independent Airs deployment as the Bring Your Source workspace. The public submission contains only the standalone Airs checkout and its fresh history. It does not require the private parent repository to run.

## Configure the two deployments

Choose and verify the exact projects before a production release. This checkout includes a portable Vercel configuration for Nuxt and disables automatic Git deployments. It contains no project binding. Do not copy the parent's .vercel directory or hosting identifiers into the export.

In Flowst set NUXT_PUBLIC_FLOWST_AIRS_URL to the verified HTTPS Airs deployment root. In Airs set NUXT_PUBLIC_FLOWST_HOME_URL to the verified HTTPS Flowst /airs page. Redeploy both after configuration changes. Production never defaults to a local server or an assumed historical domain.

Configure Airs' live Cognito, DynamoDB, S3, Groq and ElevenLabs services using .env.example and the existing restricted roles. A provider voice agent must point at this exact deployed backend and its authenticated callback. Preserve existing production agent configuration until the replacement is verified. Never publish secrets in Git or callback URLs. Fixture/mock auth remains unavailable in production; npm run demo is for local review only.

The products may require separate sign-in. This link integration implements no token handoff or SSO and sends no learner records in URLs. A non-sensitive entry marker keeps the return control visible for the current Airs browser tab. Returning checks the existing study media lifecycle before leaving.

## Public preflight

Open Flowst signed out in desktop and mobile browsers. Sign in, select Airs, select Open Airs and verify entry into /airs/new after Airs authentication. Import one permitted source, review attribution, approve Misu's proposed plan, explain aloud with Amina, apply the idea to a fresh situation and verify saved evidence. Verify the return control, logout, owner isolation and old saved-chat entry. A live voice failure blocks claiming a complete spoken demonstration; record or fix the actual failure.

Do not advertise YouTube/TikTok transcription until the account's real source checks pass. A supplied transcript is an honest fallback and must be labelled. Kai's separate interpretation and longitudinal improvement remain target work.

Verify judge access to both URLs and the public repository while signed out. Deployment protection must allow judges to reach the entry; authenticated learner screens still retain ownership controls. Update the repository README with confirmed demo URLs only after checking them.

## Mounted Flowst route

The current integration mounts Airs in a titled iframe at app.useflowst.com/airs; the outer Flowst URL remains unchanged during source review and planning. Configure the runtime with a same-site HTTPS origin to avoid cross-site refresh-cookie restrictions. Flowst delegates microphone/autoplay and never passes an auth token in the URL. Both sides validate postMessage origin and exact frame source; before parent-route changes, Airs runs the existing media exit guard and replies with a correlated result. A denied/failed response prevents that route change. Standalone Airs remains independently runnable. Test the real browser microphone prompts and owner sign-in before advertising a complete spoken demo.
