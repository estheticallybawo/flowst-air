import { spawn } from 'node:child_process'
const env = { ...process.env, NODE_ENV: 'development', NUXT_TELEMETRY_DISABLED: '1', NUXT_PUBLIC_APP_SURFACE: 'air', FLOWST_AUTH_MODE: 'mock', AIR_SOURCE_FIXTURE_MODE: 'true', NUXT_IGNORE_LOCK: '1', FLOWST_BUILD_DIR: process.env.FLOWST_BUILD_DIR || '.nuxt-airs-guest-e2e', AIR_VIDEO_ENABLED: 'false', NUXT_PUBLIC_API_BASE_URL: '/api', NUXT_PUBLIC_AUTH_REQUIRED: 'true' }
// Do not load .env.local or inherit provider credentials in a fixture demonstration.
for (const key of Object.keys(env)) if (/^(?:AWS_|GROQ_|ELEVENLABS_|AMINA_|AMIRA_|AIRS_|AIR_VIDEO_|AIR_GITHUB_|FLOWST_DYNAMO_|FLOWST_CURRICULUM_|VERCEL_|QWEN_|DASHSCOPE_)/.test(key)) delete env[key]
env.AIR_VIDEO_ENABLED = 'false'
const child = spawn(process.execPath, ['node_modules/nuxt/bin/nuxt.mjs', 'dev', '--host', '127.0.0.1', '--port', process.env.AIRS_DEMO_PORT || '4322', '--dotenv', '.env.fixture-disabled'], { env, stdio: 'inherit', windowsHide: true })
child.on('error', error => { console.error(error.message); process.exitCode = 1 })
child.on('exit', code => { process.exitCode = code ?? 1 })
