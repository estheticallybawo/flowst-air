# Test video imports yourself

No paid video smoke test has been run by Codex. The YouTube metadata check passed for `https://youtu.be/YH18H2XXa6Q` (Flowst Demo, 2:58). Actual transcription and TikTok remain unverified. These checks can incur ElevenLabs charges.

## Prepare the deployed version

1. Deploy this reviewed version; the existing deployment does not receive local changes automatically. Use the standalone export as the deployment root, install with `npm ci`, and build with `npm run build`. Keep your Cognito, Groq, voice-agent, DynamoDB and S3 settings server-side. Do not commit an environment file.
2. Enable DynamoDB TTL on `expiresAt`. Use Cognito authentication in production. Fixture mode and mock login are development-only.
3. Create an ElevenLabs speech-to-text webhook pointing to `https://YOUR-DOMAIN/api/study/sources/transcription-webhook`. Set `AIRS_VIDEO_WEBHOOK_ID` and `AIRS_VIDEO_WEBHOOK_SECRET` from that webhook.
4. Configure `AIRS_VIDEO_API_KEY`, preferably a restricted key with a provider-side credit limit. Set `AIRS_VIDEO_USD_PER_MINUTE` to your account's applicable rate and `AIRS_VIDEO_MONTHLY_BUDGET_USD` to your chosen estimated monthly ingestion allowance. This is separate from voice practice; failed or uncertain submissions retain their conservative reservation.
5. Set `AIRS_VIDEO_ENABLED=true` and redeploy. The webhook must be reachable from ElevenLabs: a deployment login wall prevents delivery. Keep application authentication and webhook signature verification enabled.

## Test one YouTube journey

1. Sign in, create a new session, choose **Link or transcript**, and inspect the permitted YouTube link above.
2. Check the title and duration. Inspection should not submit a paid job. A supplied-transcript fallback does not count as successful platform transcription.
3. Select **Create transcript** once. Check that processing appears and refreshing resumes the draft. There is one concurrent job and two paid submissions per account per UTC day; do not repeatedly create new drafts when the provider is slow.
4. Wait for the signed callback to make the transcript ready. Check the **AI-generated transcript of the video's speech** label, words, available timestamps, and limitation explaining that visuals were not inspected.
5. Compare a short passage with the original speech. Follow a YouTube timestamp citation and check that it opens the appropriate part. Report inaccurate speech or timing rather than treating it as verified.
6. Confirm the reviewed source, create Misu's plan, and approve it. With a real microphone, explain one idea, request a hint if needed, and apply it to a new situation. Check that the saved record refers to the same source snapshot.
7. End the call before changing or abandoning the session. Delete test learning records you do not want retained.

## Test one TikTok journey

Repeat with a completed public TikTok video you own or have permission to use, under 30 minutes. Platform access can differ between a browser and the deployed server. If duration or public access cannot be verified, the correct result is a clear supplied-transcript fallback. TikTok timestamps may appear beside the original link rather than as seek links.

## Check failures without extra paid jobs

- Try unsupported, private/unavailable, ongoing-live, and over-30-minute video links. They should not start transcription.
- Upload a small TXT, SRT or VTT transcript. Check the learner-supplied label. Plain text must not invent timestamps.
- Verify another account cannot read an inspected draft. A cancelled draft must not become usable after a delayed callback; cancellation does not promise to stop already-submitted provider work.
- Automated tests cover forged signatures, duplicate/early callbacks, quota reservations and uncertain dispatch. Do not submit duplicate paid jobs just to reproduce them manually.

## Record the result

For each platform, record deployment version, date, source URL, duration, transcription outcome, language, one checked timestamp, callback outcome, and whether the complete voice/application journey worked. Keep secrets and learner speech out of a public report. Only describe a platform as verified after its real end-to-end check passes.

Open the deployed URL in a signed-out/private browser. Judges should reach the landing page and ordinary signup/sign-in without a Vercel team login. Check the public repository similarly after publication.
