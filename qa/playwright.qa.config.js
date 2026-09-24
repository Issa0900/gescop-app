import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/prechauffage.js',
  fullyParallel: true,
  // Sous Windows, 4 navigateurs en parallèle saturent le serveur de dev Vite
  // (page.goto dépasse 20 s) : 2 suffisent. QA_WORKERS force une valeur.
  workers: Number(process.env.QA_WORKERS) || (process.platform === 'win32' ? 2 : 4),
  retries: 0,
  timeout: 60_000,
  reporter: [['list'], ['json', { outputFile: 'out/e2e-results.json' }]],
  use: {
    baseURL: 'http://localhost:5175',
    trace: 'retain-on-failure',
    actionTimeout: 3000,
    // Windows : le premier chargement de chaque navigateur dépasse parfois 20 s.
    navigationTimeout: process.platform === 'win32' ? 45000 : 20000,
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  webServer: { command: 'npx vite --port 5175 --strictPort', cwd: '..', url: 'http://localhost:5175', reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
