import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./e2e',
 workers:1,
 use:{baseURL:'http://127.0.0.1:3000',launchOptions:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH},browserName:'chromium'},
 webServer:{command:'npm run start -- --hostname 0.0.0.0',url:'http://127.0.0.1:3000/dashboard',reuseExistingServer:false,timeout:30000},
});
