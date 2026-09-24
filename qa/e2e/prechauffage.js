// Premier chargement de l'app sur le serveur de dev : Vite compile alors tous
// les modules, ce qui peut dépasser les 20 s de navigationTimeout du premier
// scénario (constaté sous Windows). On le fait une fois, sans limite serrée.
import { chromium } from '@playwright/test';

export default async function prechauffer(config) {
  const baseURL = config.projects[0].use.baseURL;
  const browser = await chromium.launch(config.projects[0].use.launchOptions || {});
  const page = await browser.newPage();
  // Aucune requête ne doit partir vers l'app en ligne : seul le code est chargé.
  await page.route((u) => !u.href.startsWith(baseURL) || u.pathname.startsWith('/api/'), (r) => r.abort());
  await page.goto(baseURL + '/login', { timeout: 180_000 }).catch(() => {});
  await page.goto(baseURL + '/', { timeout: 180_000 }).catch(() => {});
  await browser.close();
}
