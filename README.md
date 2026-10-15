# Flowst Airs

Flowst Airs is a conversation and feedback application for practising how you explain what you know with a multi agent design to make learning have an engaging and immersive learning experience. Bring a source, agree on a plan with Misu, practise with Amina, and reflect on Kai's feedback before your next attempt.

The focus is verbal intelligence: recalling ideas, organising an explanation, choosing words with care, and reasoning aloud. Airs is designed for recent graduates preparing for interviews, people preparing to create content around their knowledge, and learners who want space to talk through something they are still unsure about.

[Visit Flowst Airs](https://airs.useflowst.com/) to explore the product direction, or [run the local demonstration](#run-a-local-demonstration).

## Why I built Airs

I'm Esther Bawo Tsotso, a research, product and software engineer interested in how educational products should be designed, particularly for teenagers and secondary-school learners.

I first implemented this as an experiment in June because I wanted feedback on what I already knew and what I was learning at school. I wanted to find out whether I could explain an idea clearly, stay faithful to the material, and recognise where my understanding needed more work.

My time at Miva Open University, including my final-year thesis on this implementation, helped shape that question. It led me to explore how AI could give learners useful feedback on their understanding and give educators a clearer view of where support is needed.

For the hackathon, I focused Airs on verbal practice and communication. Preparing for an interview, explaining something you have built, or sharing what you know can feel consequential. I wanted to create a place where people could rehearse those conversations, receive suggestions, and return with a clearer idea of what to practise.

## How a session works

1. Choose what you want to focus on and share your background, goal, audience and available time.
2. Bring one source: a document, selected files from a public repository, a readable webpage, or a supported video transcript. Review the material that will guide the session.
3. Planner Agent Misu reviews that context and proposes a plan with learning objectives and evaluation criteria. You can adjust the scope or time before approving it.
4. Voice Practice Agent Amina guides the conversation within the approved source and objectives. You practise explaining ideas in your own words, work through questions, and apply what you understand.
5. Assessor Agent Kai reviews saved explanations against the approved criteria and suggests a useful next exercise. Its current session feedback covers understanding, clarity, vocabulary and word choice, and reasoning.

The learning loop is **source → reviewed plan → learner approval → guided practice → saved evidence → feedback**. Kai's observations describe the evidence available from that session; they do not establish intelligence or lasting mastery.

## Why I made these product decisions

### Give each agent a clear responsibility

The first orchestration I could think of was to separate planning, conversation and assessment. Misu helps decide what to practise. Amina helps the learner engage with it. Kai reflects on the saved evidence afterward.

This was an approach I could build and experiment with at the time. It gives me distinct responsibilities to investigate and refine as I learn from users. The application backend controls permissions, handoffs and saved state; agent responses propose actions within those boundaries.

### Ground the conversation in a source and an approved goal

I wanted feedback to connect to the material the learner brought especially for independent learners and the understanding they wanted to develop. Reviewing the source and approving Misu's plan gives the conversation a clear direction.

Amina receives those objectives so practice stays guided and can reach a useful conclusion. The learner can review the proposed plan before committing to it. That choice matters to me because the experience should help people develop agency over their learning.

### Make consequential conversations feel approachable

I chose illustrated 3D cartoon companions and animations because I wanted to ease some of the tension around career-defining conversations. New graduates can feel anxious about whether they are ready for the next stage of their lives.

My intention is for practice to feel like talking with a friendly companion that supports your growth. Feedback should give you something useful to work on and room to try again. Confidence and personal agency are goals I want the product to support as it develops.

### Make progress something people can return to

I was inspired by the year-end reflections from products such as YouTube and Spotify. Seeing a record of how you have spent your time on an app can make an experience feel personal. I wanted to explore what that could mean for learning: being able to look back, recognise your efforts, and see what to work on next.

Airs uses the idea of growth **cycles** and **Tides**, collectible milestones associated with areas of verbal practice. The intended experience lets learners close cycles, collect Tides and unlock rewards as they continue. I want those moments to make the learning journey interesting and give people reasons to look forward to their next session.

The growth circles and Tides are also part of a planned Easter egg system. Completing tasks and reaching milestones would progressively unlock new agent animations, different states and expressions, and additional personalisation options. I want continued practice to reveal more of the companion experience and give learners something to look forward to.

The current Growth dashboard uses labelled example evidence, cycles and Tides. It demonstrates that experience; durable rewards and progress based on real learning evidence still need backend implementation.

### Leave room for personal choice

People should have some control over how they practise and how the application feels. The learning journey lets them set their context, goals and pacing. Personalisation and customization is part of making that interaction feel like their own.

## How Airs connects to Flowst

Airs is an independent-learning part of the parent product, Flowst. The broader Flowst direction is to give young people early experiences of learning with AI, connect classroom work with practice at home, and help educators understand students'understanding through learners' feedback.

I want to keep refining the agent orchestration through user feedback. Over time, I would like these companions to be easier to reach on the go, support learning with friends, and help make learning continuous and enjoyable. The classroom, educator and teenage-learning direction is part of the wider product vision.

Using ChatGPT helped me reconsider the limits I had placed on what I could build. I hope to give young people opportunities to explore their own potential with AI early in their lives, with room to ask questions, practise and see themselves develop.

### Live conversations in a 3D environment

I plan to use Agora to build live calls with the agent in a 3D environment. The companion would respond to the learner's inputs in real time, so they could talk through their learning source and reflect on their journey in a live conversation.

This would remain part of the same Misu, Amina and Kai orchestration, with the approved source and learning objectives guiding the interaction. The interactive 3D experience and Agora integration are planned work.

## Run a local demonstration

Use Node.js 22.12 or newer and npm. From this project directory, run:

```sh
npm ci
npm run demo
```

Open [the local Airs home](http://127.0.0.1:4322/home) and select **New session**. Share your context with Misu, confirm her understanding, choose **Link or transcript**, and select a labelled fixture. Review the source, choose your goal and pacing, adjust the plan if needed, and approve it to continue to Amina.

The demonstration uses deterministic sample sources and plans, local authentication, and in-memory records that disappear on restart. It strips provider credentials and does not load `.env.local`; you do not need provider keys for this walkthrough. Live voice is not simulated. Keep the fixture server on loopback.

Canonical study routes are `/home`, `/home/new`, `/home/library` and `/home/:id`. Older `/airs`, `/air` and `/amira` bookmarks redirect while retaining their destination; `/amira` also preserves its query and hash.

## Accounts and voice operation

Open the public landing and select **Sign in**, or **Continue** when your account session has been restored. Protected `/home` routes redirect signed-out visitors to the existing sign-in form and retain their destination. Open `/home/new` to start learning. Save your background, goals and audience. Bring a source, review learning and evaluation goals, and approve practice with Amina. Kai reviews saved attempts and proposes a next exercise. Observations do not establish intelligence, mastery or longitudinal improvement.


For voice practice with your own providers, follow [Configure live operation](#configure-live-operation) and run `npm run dev`. **Start conversation** opens practice and **Start recording** explicitly requests microphone access. Amina starts with the microphone off. Captions follow playback, and Replay uses privately stored replies without another synthesis request. Learner microphone recordings are not saved as audio. Recovery breaks are optional; celebrations and Kai's review require confirmed saved evidence.

Airs has no cumulative per-study voice quota or daily guest voice-start quota. Paid provider charges continue to accrue; private usage accounting is retained. Recorded takes are bounded to two minutes, synthesized replies to 3,000 characters, and optional live calls retain individual duration, lease and output bounds. Saved audio Replay does not dispatch or account for a second synthesis request. Topic practice timing is separate. Development guests retain the deployment-wide model-task allowance (default 30 per day), bounded agent functions, source limits and separate video ingestion ceilings.

Run npx playwright test --config playwright.airs.config.ts for the local development guest journey. Public submission: [estheticallybawo/flowst-air](https://github.com/estheticallybawo/flowst-air). The product remains Flowst Airs.

## Growth in Airs

In the Growth design, each completed growth cycle earns one **Tide** for its capability. Cards show Tides earned and progress toward the next cycle; the collection and completion views explain the evidence behind each Tide.

Growth currently reads example evidence, cycle progress and Tides through `useAirGrowth`. One small indicator identifies the example data. **Explore example progress** holds optional scenario, reflection and completion controls. The data stays in app memory and never consumes real Kai scores or writes rewards. The source-independent snapshot lets owned backend records replace this adapter later; real assessment and durable progression still require backend implementation. See [the implementation record](docs/exec-plans/completed/growth-home-prototype.md).

The regular application uses its existing Cognito sign-in, storage and providers. Preview does not inherit Production variables and has no separate backend configuration. Disabling product navigation is not a substitute for backend settings. The normal development server uses separate `.nuxt-air-dev` artifacts so builds/type checks do not overwrite its runtime.

Run `npm run build` then `npm run test:growth-preview:e2e` to verify the integrated production build locally. The harness deliberately supplies obsolete guest/auth-bypass flags and a fresh test-only signing key to verify that production still requires sign-in. Real anonymous requests check redirects, session status, protected API denial and CSRF. Browser account responses and owned data reads are intercepted to check Continue, Growth/Tides and normal app navigation without provider credentials. This does not verify a live Cognito login or learning providers.

## Technical implementation

Built with Nuxt/Vue, Groq, ElevenLabs, Cognito, DynamoDB, and S3. Source connectors normalise attributed text and give the agents a bounded snapshot of the selected material. A development-only MCP uses the same read-only GitHub adapter.

The implementation separates retrieved data from system instructions, preserves source attribution, and prevents automatic repetition of an uncertain paid request. See [system responsibilities](docs/design-docs/flowst-air-system-design.md) for the application and agent boundaries.

## Configure live operation

Use `.env.example` to create your own local environment. Product configuration uses `AIR_*` keys; those take precedence over explicitly supported legacy `AMINA_*`/`AMIRA_*` deployment aliases. Production Airs and authenticated Flowst use Cognito. Configure `FLOWST_COGNITO_USER_POOL_ID` and `FLOWST_COGNITO_CLIENT_ID`. Private signed guest sessions are available only in local development/testing; set `AIRS_GUEST_ENABLED=false` locally to exercise account sign-in. Production ignores guest enablement and auth-bypass flags. Configure a DynamoDB table with partition/sort keys `pk`/`sk`, `GSI2` (`gsi2pk`/`gsi2sk`), TTL on `expiresAt`, and an S3 bucket. Grant the backend access only to its own resources. Keep keys server-side. Default recorded voice turns use Groq plus the ElevenLabs speech API (`ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID`). The optional live-call path additionally requires the private ElevenLabs conversational agent and authenticated custom LLM callback; those are not prerequisites for recorded turns.

GitHub reads public repositories without authentication by default. `AIR_GITHUB_READ_TOKEN` is optional and must be dedicated to public read access. A private repository is rejected even if that credential could access it.

On authenticated Flowst, video source transcription uses a separate restricted ElevenLabs key, `scribe_v2`, a webhook configured for transcription completion, and HMAC verification. Development guests supply transcript text and cannot start paid video jobs. Set `AIR_VIDEO_WEBHOOK_ID`, `AIR_VIDEO_WEBHOOK_SECRET`, `AIR_VIDEO_API_KEY`, `AIR_VIDEO_USD_PER_MINUTE` (the applicable rate for your account), and `AIR_VIDEO_MONTHLY_BUDGET_USD`, then enable `AIR_VIDEO_ENABLED`. Configure a provider-side key credit limit as an independent ceiling. The app's conservative estimated reservations are not a substitute for the provider's billing ledger. Failed and uncertain submissions retain their reservation.

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

## Documentation and public repository

Start with [AGENTS.md](AGENTS.md), [ARCHITECTURE.md](ARCHITECTURE.md) and [docs/](docs/index.md). DESIGN.md, FRONTEND.md, PLANS.md and PRODUCT_SENSE.md route readers to detail. Design/implementation/verification status remain distinct. Run npm run docs:generate, npm run docs:check and npm run repo:check after relevant changes.

See [public-repository preparation](docs/references/public-repository.md). The independently reviewed slice is published at estheticallybawo/flowst-air. The product aim extends beyond the one-session proof of concept; longitudinal views remain target work.

Persisted `AMIRA`/`MISU` role IDs and existing `AMIRA_*` recovery codes are compatibility contracts, not product branding. Agent-facing modules use Amina; product shells and access modules use Air.

## Creator and acknowledgments

The product idea, research direction and design decisions are mine. I built Airs with Codex from start to finish: fast prototyping, research engineering around the agent orchestration, implementation, testing, and refinement of the prototype and demo. I also used GPT and Codex to brainstorm agent behaviour and develop imagery and animation.

Thank you to OpenAI for ChatGPT and Codex, and to the Andela team for organising the hackathon and giving me the opportunity to build and share this project with a wider audience.

Thank you to Miva Open University. My studies and final-year thesis inspired this exploration of feedback on understanding and the educational questions behind Flowst.

This submission builds on an existing Amina deployment. See [the product brief](PRODUCT_BRIEF.md), [the capstone specification](CAPSTONE_SPEC.md) and [the demo script](DEMO_SCRIPT.md) for its foundation and scope. [Validation](VALIDATION.md) records the checks actually run and remaining provider or deployment work.

## License

Airs is [MIT licensed](LICENSE). Preserve source attribution and any imported repository notices.
