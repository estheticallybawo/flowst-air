# Flowst Airs — Bring Your Source

Airs is an independent-learning slice of Flowst focused on retention, understanding and verbal development over time, including explaining AI-assisted code. Bring one document, public repository, readable page, or supported video transcript. Review the included material, approve Misu's plan, explain the idea aloud, and apply it in a new situation.

Built with Nuxt/Vue, Groq, ElevenLabs, Cognito, DynamoDB, and S3. The source connector normalizes attributed text; it never gives Misu unrestricted platform access. A development-only MCP uses the same read-only GitHub adapter.

Flowst Airs is the product; Misu plans, Amina conducts verbal practice, and Kai provides a separate evidence-linked review. The interface, routes, package and source-service configuration use Flowst Airs. Amina remains the verbal learning agent. See [product intent](docs/product-specs/product-brief.md), [the knowledge base](docs/index.md) and [system responsibilities](docs/design-docs/flowst-air-system-design.md) for the full separation and implementation status.

## Run a local demonstration

Use Node 22.12+ (Node 24 recommended):

```sh
npm ci
npm run demo
```

Open `http://127.0.0.1:4322/airs`. Share your context with Misu, edit and confirm her understanding, then choose **Link or transcript** and a labelled fixture. Review the source, choose your goal, 5–15 minutes per topic and a 3- or 5-minute break, review or adjust the plan, and approve it. Misu prepares the handoff; Amina welcomes you with the microphone off. **Start conversation** opens practice; **Start recording** explicitly requests microphone access. Voice turns are the default. Amina’s captions follow actual playback, with full saved text available. Demo sources and their plans are deterministic, local samples; live voice is not simulated. Mock authentication and fixture mode are disabled in production. Local records are in memory and disappear on restart.

Canonical study routes are `/airs`, `/airs/new`, `/airs/library` and `/airs/:id`. Existing `/air` routes remain compatible. Existing `/amira` bookmarks redirect while preserving the destination, query and hash.

## Configure live operation

Use `.env.example` to create your own local environment. Product configuration uses `AIR_*` keys; those take precedence over explicitly supported legacy `AMINA_*`/`AMIRA_*` deployment aliases. Configure Cognito, a DynamoDB table with partition/sort keys `pk`/`sk`, `GSI2` (`gsi2pk`/`gsi2sk`), TTL on `expiresAt`, and an S3 bucket. Grant the backend access only to its own resources. Keep keys server-side. Configure Groq and the existing ElevenLabs conversation agent/custom LLM callback for voice.

GitHub reads public repositories without authentication by default. `AIR_GITHUB_READ_TOKEN` is optional and must be dedicated to public read access. A private repository is rejected even if that credential could access it.

Video source transcription uses a separate restricted ElevenLabs key, `scribe_v2`, a webhook configured for transcription completion, and HMAC verification. Set `AIR_VIDEO_WEBHOOK_ID`, `AIR_VIDEO_WEBHOOK_SECRET`, `AIR_VIDEO_API_KEY`, `AIR_VIDEO_USD_PER_MINUTE` (the applicable rate for your account), and `AIR_VIDEO_MONTHLY_BUDGET_USD`, then enable `AIR_VIDEO_ENABLED`. Configure a provider-side key credit limit as an independent ceiling. The app's conservative estimated reservations are not a substitute for the provider's billing ledger. Failed and uncertain submissions retain their reservation.

Before enabling platform claims, verify a permitted YouTube and TikTok example end to end on the deployed account. Metadata parsing is deliberately conservative: changed, blocked, unlisted, private, live, or unverifiable videos fall back to supplied transcripts. No platform cookies, login bypass, or media-downloading tool is included.

## What is read and stored

Use [the voice-turn preflight](docs/references/voice-turn-preflight.md) for real microphone, captions and pacing checks.

Use [the deployed video checklist](DEPLOYED_VIDEO_CHECKLIST.md) to run the real provider and voice checks yourself after deployment.

- One source per session. GitHub uses selected files pinned to a commit; websites use one readable HTML page.
- Video learning uses speech transcript text. Visuals, diagrams, and on-screen text are not inspected. AI transcripts may contain errors.
- Supplied TXT/SRT/VTT text is labelled as supplied, not verified against the video. Plain text gets no invented timestamps.
- Drafts expire after 30 minutes. Access ends immediately; physical draft cleanup uses DynamoDB TTL and may occur later. Confirmed snapshots and learning records remain until deleted.
- Cancelling a draft does not guarantee cancellation of provider work. Deleting Flowst Airs records does not delete the source or independent provider records.
- Source text reaches the configured planning/tutoring provider; video links reach the transcription provider. This is not an on-device-only app.

## MCP and verification

See `mcp/codex-config.example.toml`. Run Codex from this project or use an absolute launcher path. The stdio launcher strips application secrets and does not load `.env.local`. Its four tools are `get_repository`, `get_source_revision`, `list_study_files`, and `read_study_file`. Tool annotations describe behavior; fixed endpoints, validated arguments, bounded responses, and restricted credentials enforce it.

```sh
npm run typecheck
npm test
npm run test:sources:e2e
npm run mcp:review
npm run build
```

The MCP review makes real read-only requests against `octocat/Hello-World` and compares a pinned file hash with the production reader. It does not write to GitHub or register a global MCP server.

## Built with Codex

Codex assisted planning, repository inspection, implementation, test creation, and public-export preparation. The implementation separates retrieved data from system instructions, preserves snapshot attribution, and prevents automatic repetition of an uncertain paid request. See `VALIDATION.md` for checks actually run, results, and unresolved provider/deployment checks. Do not describe unperformed checks as passed.

This submission builds on an existing Amina deployment. See `PRODUCT_BRIEF.md`, `CAPSTONE_SPEC.md`, and `DEMO_SCRIPT.md` for the new slice and demonstration boundaries. MIT licensed; preserve source attribution and any imported repository notices.

Persisted `AMIRA`/`MIRO` role IDs and existing `AMIRA_*` recovery codes are compatibility contracts, not product branding. Agent-facing modules use Amina; product shells and access modules use Air.

## Documentation and public repository

Start with [AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [docs/](docs/index.md). DESIGN.md, FRONTEND.md, PLANS.md and PRODUCT_SENSE.md route readers to detail. Design/implementation/verification status remain distinct. Run npm run docs:generate, npm run docs:check and npm run repo:check after relevant changes.

See [public-repository preparation](docs/references/public-repository.md). The independently reviewed slice is published at estheticallybawo/flowst-air. The product aim extends beyond the one-session proof of concept; longitudinal views remain target work.
# flowst-air

## Context-aware career conversation

Open /airs/new. Standalone requires no registration: Airs creates a private, expiring guest session. Save your background, goals and audience. Bring a source, review learning and evaluation goals, and approve practice with Amina. Kai reviews saved attempts and proposes a next exercise. Observations do not establish intelligence, mastery or longitudinal improvement.

Production requires a random server-only AIRS_GUEST_SECRET of at least 32 characters plus configured storage and model/speech providers. Do not reuse provider keys as this secret. Paid video transcription is unavailable for guests; provide a transcript instead. Local fixtures need no provider secrets. Flowst uses its existing sign-in and native Airs routes.

Run npx playwright test --config playwright.airs.config.ts for the guest journey. Public submission: [estheticallybawo/flowst-air](https://github.com/estheticallybawo/flowst-air). The product remains Flowst Airs.
