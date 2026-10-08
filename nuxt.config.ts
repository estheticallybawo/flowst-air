// Air keys take precedence; legacy deployment keys are read only as migration aliases.
const airEnv = (key: string, legacy: string) =>
  process.env[key] ?? process.env[legacy];

export default defineNuxtConfig({
  compatibilityDate: "2026-08-24",
  srcDir: ".",
  buildDir: process.env.FLOWST_BUILD_DIR || ".nuxt",
  // Separate local Flowst Air, Flowst and browser-check optimizer artifacts.
  vite: { cacheDir: `${process.env.FLOWST_BUILD_DIR || ".nuxt"}/vite-cache` },
  ignore: [
    "**/.nuxt-*",
    "**/.tmp",
    "**/.tmp/**",
    "**/.output/**",
    "**/test-results/**",
    "**/playwright-report/**",
    "**/artifacts/**",
  ],
  devtools: { enabled: process.env.NUXT_DEVTOOLS === "true" },
  modules: ["@vite-pwa/nuxt"],
  css: [
    "~/assets/css/main.css",
    "~/assets/css/flowst-app.css",
    "~/assets/css/air.css",
  ],
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      title: "Flowst Airs",
      meta: [
        {
          name: "description",
          content:
            "Bring your source. Understand, explain aloud, and apply its ideas with Flowst Airs.",
        },
        { name: "theme-color", content: "#f7faff" },
        { property: "og:title", content: "Flowst Airs" },
        {
          property: "og:description",
          content: "Bring your source. Find your voice.",
        },
      ],
      link: [
        { rel: "icon", href: "/air-icon.svg", type: "image/svg+xml" },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossorigin: "",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Albert+Sans:wght@400;500;600;700&family=Unbounded:wght@500;600;700&display=swap",
        },
      ],
    },
  },
  runtimeConfig: {
    airsGuestSecret: process.env.AIRS_GUEST_SECRET || "",
    airsGuestDailyModelLimit: Number(
      process.env.AIRS_GUEST_DAILY_MODEL_LIMIT || 30,
    ),
    studyGithubToken:
      airEnv("AIR_GITHUB_READ_TOKEN", "AMINA_GITHUB_READ_TOKEN") || "",
    studySourceFixtureMode:
      airEnv("AIR_SOURCE_FIXTURE_MODE", "AMINA_SOURCE_FIXTURE_MODE") === "true",
    studyVideoEnabled:
      airEnv("AIR_VIDEO_ENABLED", "AMINA_VIDEO_ENABLED") === "true",
    studyVideoApiKey: airEnv("AIR_VIDEO_API_KEY", "AMINA_VIDEO_API_KEY") || "",
    studyVideoWebhookId:
      airEnv("AIR_VIDEO_WEBHOOK_ID", "AMINA_VIDEO_WEBHOOK_ID") || "",
    studyVideoWebhookSecret:
      airEnv("AIR_VIDEO_WEBHOOK_SECRET", "AMINA_VIDEO_WEBHOOK_SECRET") || "",
    studyVideoMonthlyBudgetUsd: Number(
      airEnv(
        "AIR_VIDEO_MONTHLY_BUDGET_USD",
        "AMINA_VIDEO_MONTHLY_BUDGET_USD",
      ) || 0,
    ),
    studyVideoUsdPerMinute: Number(
      airEnv("AIR_VIDEO_USD_PER_MINUTE", "AMINA_VIDEO_USD_PER_MINUTE") || 0,
    ),
    flowstCourseModel: process.env.FLOWST_COURSE_MODEL || "openai/gpt-oss-120b",
    flowstCoursePilotEnabled:
      process.env.FLOWST_COURSE_PILOT_ENABLED === "true",
    flowstInquiryPilotEnabled:
      process.env.FLOWST_INQUIRY_PILOT_ENABLED === "true",
    flowstNeuroMapV1Enabled: process.env.FLOWST_NEUROMAP_V1_ENABLED !== "false",
    flowstAuthMode: process.env.FLOWST_AUTH_MODE || "cognito",
    aminaRealtimeEnabled:
      airEnv("AIR_REALTIME_ENABLED", "AMIRA_REALTIME_ENABLED") === "true",
    studyTextProvider:
      airEnv("AIR_TEXT_PROVIDER", "AMINA_TEXT_PROVIDER") || "groq",
    studyObjectiveFlowEnabled:
      process.env.AIR_OBJECTIVE_FLOW_ENABLED !== "false",
    studyVoiceProvider:
      airEnv("AIR_VOICE_PROVIDER", "AMINA_VOICE_PROVIDER") || "elevenlabs",
    elevenLabsStudyAgentId: process.env.ELEVENLABS_STUDY_AGENT_ID || "",
    elevenLabsStudyLlmSecret: process.env.ELEVENLABS_STUDY_LLM_SECRET || "",
    elevenLabsStudyLlmUrl: process.env.ELEVENLABS_STUDY_LLM_URL || "",
    aminaRealtimeModel:
      airEnv("AIR_REALTIME_MODEL", "AMIRA_REALTIME_MODEL") ||
      "amazon.nova-2-sonic-v1:0",
    aminaRealtimeVoice:
      airEnv("AIR_REALTIME_VOICE", "AMIRA_REALTIME_VOICE") || "tiffany",
    aminaRealtimeSocketUrl:
      airEnv("AIR_REALTIME_SOCKET_URL", "AMIRA_REALTIME_SOCKET_URL") || "",
    airStudyAccessEnabled:
      airEnv("AIR_STUDY_ACCESS_ENABLED", "AMIRA_STUDY_ACCESS_ENABLED") !==
      "false",
    cognitoUserPoolId: process.env.FLOWST_COGNITO_USER_POOL_ID || "",
    cognitoClientId: process.env.FLOWST_COGNITO_CLIENT_ID || "",
    groqApiKey: process.env.GROQ_API_KEY || process.env.GROQ_API_TOKEN || "",
    groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
    flowstTextProvider:
      process.env.FLOWST_TEXT_PROVIDER ||
      (process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY
        ? "qwen"
        : "groq"),
    qwenApiKey: process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || "",
    qwenBaseUrl:
      process.env.QWEN_BASE_URL ||
      "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    qwenModel: process.env.QWEN_MODEL || "qwen-plus",
    elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID || "eleven_flash_v2_5",
    agentCoreEndpoint: process.env.AGENTCORE_ENDPOINT || "",
    agentCoreRuntimeArn: process.env.AGENTCORE_RUNTIME_ARN || "",
    agentCoreBearerToken: process.env.AGENTCORE_BEARER_TOKEN || "",
    neoImageProvider: process.env.NEO_IMAGE_PROVIDER || "stability",
    neoBedrockModelId:
      process.env.NEO_BEDROCK_MODEL_ID || "stability.stable-image-core-v1:1",
    neoBedrockEditModelId:
      process.env.NEO_BEDROCK_EDIT_MODEL_ID ||
      "stability.stable-image-control-structure-v1:0",
    neoAwsRegion:
      process.env.NEO_AWS_REGION || process.env.AWS_REGION || "us-west-2",
    neoGenerationEnabled: process.env.NEO_GENERATION_ENABLED === "true",
    elevenLabsApiKey: process.env.ELEVENLABS_API_KEY || "",
    elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID || "",
    studyAwsPollyVoiceId:
      process.env.FLOWST_STUDY_AWS_POLLY_VOICE_ID || "Joanna",
    studyAwsTranscribeUsdPerMinute: Number(
      process.env.FLOWST_STUDY_AWS_TRANSCRIBE_ESTIMATE_USD_PER_MINUTE || 0.03,
    ),
    studyAwsPollyUsdPerMillion: Number(
      process.env.FLOWST_STUDY_AWS_POLLY_ESTIMATE_USD_PER_MILLION || 16,
    ),
    studyBedrockApiKey: process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_BEDROCK_APIKEY || "",
    studyBedrockModelId:
      process.env.FLOWST_STUDY_BEDROCK_MODEL_ID || "us.amazon.nova-2-lite-v1:0",
    dynamoTable: process.env.FLOWST_DYNAMO_TABLE || "",
    curriculumBucket: process.env.FLOWST_CURRICULUM_BUCKET || "",
    communityMediaBucket: process.env.FLOWST_COMMUNITY_MEDIA_BUCKET || "",
    communityGuardrailId: process.env.FLOWST_COMMUNITY_GUARDRAIL_ID || "",
    communityGuardrailVersion:
      process.env.FLOWST_COMMUNITY_GUARDRAIL_VERSION || "",
    communitySafetyMode: process.env.FLOWST_COMMUNITY_SAFETY_MODE || "aws",
    communityImageModerationConfidence: Number(
      process.env.FLOWST_COMMUNITY_IMAGE_MODERATION_CONFIDENCE || 75,
    ),
    awsRegion: process.env.AWS_REGION || "us-east-1",
    public: {
      studySourceFixtureMode:
        airEnv("AIR_SOURCE_FIXTURE_MODE", "AMINA_SOURCE_FIXTURE_MODE") ===
          "true" &&
        process.env.FLOWST_AUTH_MODE === "mock" &&
        process.env.NODE_ENV !== "production",
      appSurface: "air",
      airsGuestEnabled: process.env.AIRS_GUEST_ENABLED !== "false",
      authRequired: false,
      apiBaseUrl: "/api",
      schoolId: process.env.NUXT_PUBLIC_SCHOOL_ID || "school-aster",
      demoMode: process.env.NUXT_PUBLIC_DEMO_MODE !== "false",
      neoGenerationAvailable: process.env.NEO_GENERATION_ENABLED === "true",
    },
  },
  pwa: {
    registerType: "autoUpdate",
    manifest: {
      name: "Flowst Airs",
      short_name: "Air",
      description: "Source-grounded learning and spoken practice.",
      theme_color: "#fffaf3",
      background_color: "#fffaf3",
      display: "standalone",
      start_url: "/",
      icons: [
        {
          src: "/air-icon.svg",
          sizes: "any",
          type: "image/svg+xml",
          purpose: "any maskable",
        },
      ],
    },
    workbox: {
      // Authenticated SSR pages are not precached HTML.
      navigateFallback: null,
      // Keep the install lightweight. Large agent artwork loads normally on demand.
      globPatterns: ["**/*.{js,css,html,svg,woff2}"],
    },
  },
  nitro: {
    experimental: { websocket: true },
    vercel: { functions: { maxDuration: 120 } },
    preset: process.env.NITRO_PRESET || undefined,
  },
  typescript: {
    strict: true,
    typeCheck: false,
  },
});
