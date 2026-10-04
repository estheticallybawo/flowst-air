import { defineConfig,devices } from '@playwright/test'
export default defineConfig({
 testDir:'./tests/source-e2e',testMatch:'guest-context.spec.ts',workers:1,timeout:180000,reporter:'list',
 use:{baseURL:'http://127.0.0.1:4323',channel:'chrome'},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'mobile',use:{...devices['Pixel 5']}}],
 webServer:{command:'node scripts/run-source-fixtures.mjs',url:'http://127.0.0.1:4323/',timeout:600000,env:{NUXT_IGNORE_LOCK:'1',AIRS_DEMO_PORT:'4323'}}
})
