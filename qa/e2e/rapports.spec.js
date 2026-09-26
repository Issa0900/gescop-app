// Rapports de bout en bout (ANO-15) : la page calcule les chiffres avec le
// moteur KPI, generateReport les stocke (faux backend : il renvoie ce qu'il
// recoit), et le rapport, le diaporama et l'ancien rapport n'affichent que
// des chiffres reels — jamais le dossier de demonstration d'avant.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'out', 'screens');
fs.mkdirSync(OUT, { recursive: true });

// Premier jour du mois, n mois avant le mois en cours (AAAA-MM-JJ).
const mois = (n, jour = 1) => {
  const d = new Date();
  const r = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, jour));
  return r.toISOString().slice(0, 10);
};

const DONNEES = {
  Company: [{ id: 'co1', name: 'Atelier Vérité Test', onboarded: true, currency: 'CAD' }],
  Order: [
    { id: 'o1', order_id: 'A-1', date: mois(1, 5), total_revenue: 5000, cost: 3000, status: 'completed', customer_id: 'C1' },
    { id: 'o2', order_id: 'A-2', date: mois(1, 20), total_revenue: 7000, cost: 4000, status: 'completed', customer_id: 'C2' },
    { id: 'o3', order_id: 'B-1', date: mois(2, 10), total_revenue: 10000, cost: 6000, status: 'completed', customer_id: 'C1' },
    { id: 'o4', order_id: 'C-1', date: mois(3, 10), total_revenue: 8000, cost: 5000, status: 'completed', customer_id: 'C3' },
  ],
  Expense: [1, 2, 3].map((n) => ({ id: `e${n}`, date: mois(n, 15), amount: n === 1 ? 1500 : 1000, category: 'Loyer' })),
  Payroll: [1, 2, 3].map((n) => ({ id: `p${n}`, employee_id: 'E1', period: mois(n).slice(0, 7), total_cost: 2000 })),
  Cashflow: [1, 2, 3].map((n) => ({ id: `cf${n}`, date: mois(n, 25), closing_cash: 20000 + n * 1000 })),
  // Rapport genere avant le correctif : pas de `chiffres`.
  Report: [{ id: 'ancien', type: 'mensuel', period: 'ancien rapport', summary: 'Résumé ancien', created_date: mois(4),
    comparison: { currentLabel: 'mois A', previousLabel: 'mois B', metrics: [{ key: 'revenus', label: 'Revenus', current: 0, previous: 900, unit: '$', trend: 'non-mesurable', delta: null, deltaPct: null }] } }],
};

async function fauxBackend(page, envois, ajouts = {}) {
  const store = JSON.parse(JSON.stringify({ ...DONNEES, ...ajouts }));
  await page.route(/^https:\/\/(base44\.com|media\.base44\.com|static\.wixstatic\.com|.*\.base44\.app)\//, (r) =>
    r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const req = route.request();
    const m = new URL(req.url()).pathname;
    const json = (body) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    const e = m.match(/\/entities\/([A-Za-z]+)(?:\/([^/]+))?/);
    if (e) {
      const [, ent, id] = e;
      if (id === 'me') return json({ id: 'u1', email: 'qa@example.com', full_name: 'QA', role: 'admin' });
      const rows = store[ent] || [];
      if (req.method() === 'GET') return json(id ? rows.find((r) => r.id === id) || {} : rows);
      return json({ id: 'x', ...(req.postDataJSON() || {}) });
    }
    if (/\/functions\/generateReport/.test(m)) {
      const body = req.postDataJSON();
      envois.push(body);
      const report = {
        id: `r-${envois.length}`, type: body.type, period: body.chiffres?.periode?.libelle || '', created_date: new Date().toISOString(),
        summary: 'Synthèse IA de test.', content: '## Test', sections: { Ventes: 'Analyse IA des ventes.' }, chiffres: body.chiffres,
        comparison: { variationAnalysis: [{ label: 'CA', classification: 'CALCULATION', text: 'Le CA varie de 20 %.', confidence: 0.9, sources: ['total_revenue'], status: 'OK' }], keyInsights: ['CA en hausse'] },
      };
      store.Report = [report, ...(store.Report || [])];
      return json({ report });
    }
    return json({});
  });
}

const INTERDITS = [/Nordik/, /Plein Air/, /1\s184\s000/, /42\s850/, /420\s000/, /98,4/, /\bNaN\b/, /\bundefined\b/, /\[object Object\]/];

test('Rapport mensuel : chiffres du moteur, jamais le dossier de démonstration', async ({ page }) => {
  const erreurs = [];
  page.on('pageerror', (ex) => erreurs.push(String(ex.message || ex)));
  const envois = [];
  await fauxBackend(page, envois);
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('PLAYWRIGHT_TEST', 'true'));
  await page.goto('/rapports');

  const boutons = page.getByRole('button', { name: 'Générer le rapport' });
  await expect(boutons.nth(2)).toBeEnabled({ timeout: 20000 });
  await boutons.nth(2).click();
  await expect(page.getByText('Résumé exécutif')).toBeVisible({ timeout: 20000 });

  // Ce que la page a envoye : les chiffres du moteur sur le dernier mois complet.
  const ch = envois[0].chiffres;
  const v = (id) => ch.indicateurs.find((i) => i.id === id);
  expect(v('total_revenue').courant.valeur).toBe(12000);
  expect(v('total_revenue').precedent.valeur).toBe(10000);
  expect(v('net_income').courant.valeur).toBe(12000 - 7000 - 1500 - 2000);
  expect(v('ebitda').courant.valeur).toBe(1500);
  expect(ch.couverture.Order).toBe(2);

  const texte = await page.locator('main').innerText();
  expect(texte).toContain('Atelier Vérité Test');
  expect(texte).toMatch(/12\s000\s\$/);
  expect(texte).toMatch(/\+20\s%/);
  expect(texte).toContain('Synthèse IA de test.');
  expect(texte).toContain('CALCUL');
  for (const re of INTERDITS) expect(texte).not.toMatch(re);
  await page.screenshot({ path: path.join(OUT, 'rapport-mensuel.png'), fullPage: true });

  // Diaporama : memes chiffres, aucune diapositive de demonstration.
  await page.getByRole('button', { name: /Diaporama/ }).click();
  const diapo = page.locator('.fixed.inset-0');
  await expect(diapo.getByText('Atelier Vérité Test').first()).toBeVisible();
  let tout = '';
  for (let i = 0; i < 10; i++) {
    tout += await diapo.innerText();
    await page.keyboard.press('ArrowRight');
  }
  expect(tout).toMatch(/12\s000\s\$/);
  const box = await diapo.boundingBox();
  const vue = page.viewportSize();
  expect(box.y).toBeLessThanOrEqual(1);
  expect(Math.round(box.height)).toBeGreaterThanOrEqual(vue.height - 1);
  for (let i = 0; i < 4; i++) await page.keyboard.press('ArrowLeft');
  await expect(diapo.getByText('Indicateurs clés').first()).toBeVisible();
  for (const re of INTERDITS) expect(tout).not.toMatch(re);
  await page.screenshot({ path: path.join(OUT, 'rapport-diaporama.png') });
  await page.keyboard.press('Escape');

  expect(erreurs).toEqual([]);
});

test('Rapport hebdomadaire et quotidien : période des dernières données, paie mensuelle non répartie', async ({ page }) => {
  const erreurs = [];
  page.on('pageerror', (ex) => erreurs.push(String(ex.message || ex)));
  const envois = [];
  await fauxBackend(page, envois);
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('PLAYWRIGHT_TEST', 'true'));
  await page.goto('/rapports');
  const boutons = page.getByRole('button', { name: 'Générer le rapport' });
  await expect(boutons.nth(1)).toBeEnabled({ timeout: 20000 });
  await boutons.nth(1).click();
  await expect(page.getByText('Synthèse de la semaine')).toBeVisible({ timeout: 20000 });
  const hebdo = envois[0].chiffres;
  expect(hebdo.periode.fin).toBe(mois(1, 20));
  expect(hebdo.indicateurs.find((i) => i.id === 'total_revenue').courant.valeur).toBe(7000);
  expect(hebdo.couverture.Payroll).toBeUndefined();
  const texte = await page.locator('main').innerText();
  for (const re of INTERDITS) expect(texte).not.toMatch(re);
  await page.screenshot({ path: path.join(OUT, 'rapport-hebdo.png'), fullPage: true });

  await boutons.nth(0).click();
  await expect(page.getByText('État général')).toBeVisible({ timeout: 20000 });
  expect(envois[1].chiffres.periode.debut).toBe(mois(1, 20));
  expect(erreurs).toEqual([]);
});

test('Ancien rapport : lisible, avec avertissement, sans chiffre inventé', async ({ page }) => {
  const erreurs = [];
  page.on('pageerror', (ex) => erreurs.push(String(ex.message || ex)));
  await fauxBackend(page, []);
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('PLAYWRIGHT_TEST', 'true'));
  await page.goto('/rapports');
  const consulter = page.getByRole('button', { name: 'Consulter' }).first();
  await expect(consulter).toBeVisible({ timeout: 20000 });
  await consulter.click();
  await expect(page.getByText(/ancien calcul/)).toBeVisible({ timeout: 20000 });
  const texte = await page.locator('main').innerText();
  expect(texte).toContain('Non mesuré');
  for (const re of INTERDITS) expect(texte).not.toMatch(re);
  await page.screenshot({ path: path.join(OUT, 'rapport-ancien.png'), fullPage: true });
  expect(erreurs).toEqual([]);
});

test('Finance : le détail des charges porte sur la même période que le total et s\'additionne', async ({ page }) => {
  const erreurs = [];
  page.on('pageerror', (ex) => erreurs.push(String(ex.message || ex)));
  // Relevé bancaire sur les 2 derniers mois seulement : période commune plus
  // courte que les ventes (cas signalé par Issa le 26 sept.).
  const Transaction = [2, 1].map((n) => ({ id: `t${n}`, date: mois(n, 18), amount: 100, type: 'expense', description: 'Frais bancaires' }));
  await fauxBackend(page, [], { Transaction });
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('PLAYWRIGHT_TEST', 'true'));
  await page.goto('/finance');
  const carte = page.locator('div', { hasText: /^Charges totales/ }).filter({ hasText: /dont/ }).last();
  await expect(carte).toBeVisible({ timeout: 20000 });
  const texte = await carte.innerText();
  const montant = (re) => Number((texte.match(re)?.[1] || '').replace(/[\s\u202f\u00a0]/g, ''));
  const total = montant(/^Charges totales\s*([\d\s\u202f\u00a0]+)\s*\$/m);
  const parts = [...texte.matchAll(/(?:coût des ventes|dépenses|masse salariale|amortissement) ([\d\s\u202f\u00a0]+) \$/g)]
    .map((m) => Number(m[1].replace(/[\s\u202f\u00a0]/g, '')));
  // Juillet + août : coût 3000 + 4000 + 6000 (la commande de juin est hors période), dépenses 1500 + 1000 + 200, paie 2 x 2000.
  expect(total).toBe(13000 + 2700 + 4000);
  expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
  expect(texte).toMatch(/mois couverts par toutes les sources/);
  // Capture a la taille de la fenetre : une capture « page entiere » la redimensionne,
  // ce qui relance l'animation des graphiques (barres vides sur l'image).
  await page.waitForTimeout(2000);
  await page.screenshot({ path: path.join(OUT, 'finance-charges.png') });
  expect(erreurs).toEqual([]);
});
