// Agent QA GESCOP — couche 2 : parcours de bout en bout dans un vrai navigateur.
//
// L'application React réelle tourne (routing, layout, React Query, chaque
// page). Seule la couche réseau /api est remplacée par un faux backend en
// mémoire qui répond comme Base44 (listes, création, mise à jour, suppression,
// fonctions, téléversement). Chaque constat est écrit dans qa/out/findings.jsonl
// pour le rapport final.
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RICH, FUNCTIONS } from './fixtures.js';

const QA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(QA, 'out');
const SHOTS = path.join(OUT, 'screens');
fs.mkdirSync(SHOTS, { recursive: true });
const FINDINGS = path.join(OUT, 'findings.jsonl');

const PAGES = [
  '/', '/insights', '/previsions', '/simulateur', '/decisions', '/historique', '/importer',
  '/audit', '/clients', '/produits', '/marketing', '/rh', '/achats', '/tresorerie', '/finance',
  '/kpis', '/anomalies', '/risques', '/recommandations', '/radar', '/taches', '/alertes',
  '/rapports', '/assistant', '/parametres', '/manuel', '/politique-confidentialite', '/onboarding',
  '/immobilisations', '/succursales', '/tarifs', '/facturation', '/parametres/facturation',
];

// Textes qui trahissent un bug d'affichage (valeur non calculée ou mal formatée).
const TEXTES_SUSPECTS = [/\bNaN\b/, /\bundefined\b/, /\bInfinity\b/, /\[object Object\]/, /Invalid Date/, /\bnull\s?\$/];

function noter(f) {
  fs.appendFileSync(FINDINGS, JSON.stringify({ ...f, at: new Date().toISOString() }) + '\n');
}

/** Faux backend Base44 en mémoire. `data` = null -> toutes les listes vides. */
async function fauxBackend(page, data, journal = []) {
  const store = JSON.parse(JSON.stringify(data || {}));
  await page.route(/^https:\/\/(base44\.com|media\.base44\.com|static\.wixstatic\.com|.*\.base44\.app)\//, (r) =>
    r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' }));
  await page.route((u) => u.pathname.startsWith('/api/'), async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const m = url.pathname;
    const method = req.method();
    journal.push(`${method} ${m}`);
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    let e = m.match(/\/entities\/([A-Za-z]+)(?:\/([^/]+))?/);
    if (e) {
      const [, ent, id] = e;
      const rows = (store[ent] ||= []);
      if (id === 'me') return json(RICH.User[0]);
      if (method === 'GET') return id ? json(rows.find((r) => r.id === id) || {}) : json(rows);
      if (method === 'POST') {
        const body = req.postDataJSON() || {};
        if (Array.isArray(body)) { const out = body.map((b, i) => ({ id: `new-${Date.now()}-${i}`, ...b })); rows.push(...out); return json(out); }
        const rec = { id: `new-${Date.now()}`, ...body }; rows.push(rec); return json(rec);
      }
      if (method === 'PUT' || method === 'PATCH') {
        const body = req.postDataJSON() || {};
        const i = rows.findIndex((r) => r.id === id);
        if (i >= 0) rows[i] = { ...rows[i], ...body };
        return json(rows[i] || { id, ...body });
      }
      if (method === 'DELETE') {
        const n = id ? 1 : rows.length;
        store[ent] = id ? rows.filter((r) => r.id !== id) : [];
        return json({ deleted: n, success: true });
      }
    }
    const f = m.match(/\/functions\/([A-Za-z]+)/);
    if (f) {
      if (f[1] === 'importMultiData') return json(page.__importReply ? page.__importReply(req.postDataJSON()) : { results: [] });
      return json(FUNCTIONS[f[1]] || {});
    }
    if (/UploadPublicFile|UploadPrivateFile|UploadFile/.test(m)) return json({ file_url: 'https://files.example/fichier.csv', file_uri: 'private/fichier.csv' });
    if (/CreateFileSignedUrl/.test(m)) return json({ signed_url: 'https://files.example/private/fichier.csv?signature=qa' });
    if (/InvokeLLM/.test(m)) return json({ response: 'ok' });
    return json({});
  });
}

/** Branche les collecteurs d'erreurs sur la page. */
function surveiller(page) {
  const erreurs = [];
  page.on('pageerror', (ex) => erreurs.push({ type: 'exception JS', detail: String(ex.message || ex).slice(0, 300) }));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const t = msg.text();
    if (/favicon|Failed to load resource: the server responded with a status of 404/.test(t)) return;
    erreurs.push({ type: 'console.error', detail: t.slice(0, 300) });
  });
  page.on('dialog', (d) => d.accept());
  return erreurs;
}

async function authentifier(page) {
  await page.goto('/login');
  await page.evaluate(() => localStorage.setItem('PLAYWRIGHT_TEST', 'true'));
}

async function inspecterPage(page, route, scenario, erreurs) {
  const t0 = Date.now();
  await page.goto(route);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(800);
  const ms = Date.now() - t0;
  const texte = await page.locator('body').innerText().catch(() => '');
  const constats = [];

  if (/Cette page n'a pas pu s'afficher/.test(texte)) constats.push({ gravite: 'critique', type: 'page plantée (ErrorBoundary)', detail: texte.split('\n').slice(0, 6).join(' | ').slice(0, 300) });
  if (/\b404\b/.test(texte) && /introuvable|not found|n'existe pas/i.test(texte)) constats.push({ gravite: 'majeur', type: 'route introuvable', detail: route });
  for (const re of TEXTES_SUSPECTS) {
    const lignes = texte.split('\n').filter((l) => re.test(l)).slice(0, 3);
    if (lignes.length) constats.push({ gravite: 'moyen', type: `valeur affichée suspecte ${re}`, detail: lignes.join(' | ').slice(0, 300) });
  }
  for (const e of erreurs.splice(0)) constats.push({ gravite: e.type === 'exception JS' ? 'critique' : 'mineur', ...e });
  if (scenario === 'vide') {
    const zeros = texte.split('\n').filter((l) => /^\s*0(,00)?\s?\$\s*$|^\s*0 \$/.test(l)).length;
    if (zeros > 0) constats.push({ gravite: 'moyen', type: 'donnée absente affichée comme 0 $', detail: `${zeros} montant(s) « 0 $ » affichés sans aucune donnée importée${/Critique/i.test(texte) ? ' — avec statut Critique' : ''}` });
  }
  if (texte.trim().length < 40) constats.push({ gravite: 'majeur', type: 'page vide', detail: `texte visible: "${texte.trim().slice(0, 80)}"` });
  if (ms > 6000) constats.push({ gravite: 'mineur', type: 'lenteur', detail: `${ms} ms` });

  const nom = `${scenario}${route.replace(/\//g, '_') || '_accueil'}`;
  await page.screenshot({ path: path.join(SHOTS, `${nom}.png`), fullPage: false }).catch(() => {});
  for (const c of constats) noter({ couche: 'e2e', scenario, route, ...c });
  return { ms, constats };
}

// ─── 1. Chaque page, sans aucune donnée (nouvel utilisateur) ──────────────
test.describe('Scénario A — compte vide', () => {
  for (const route of PAGES) {
    test(`A ${route}`, async ({ page }) => {
      const erreurs = surveiller(page);
      await fauxBackend(page, null);
      await authentifier(page);
      const { constats } = await inspecterPage(page, route, 'vide', erreurs);
      expect(constats.filter((c) => c.gravite === 'critique'), JSON.stringify(constats)).toEqual([]);
    });
  }
});

// ─── 2. Chaque page, avec un jeu de données complet ──────────────────────
test.describe('Scénario B — PME avec données', () => {
  for (const route of PAGES) {
    test(`B ${route}`, async ({ page }) => {
      const erreurs = surveiller(page);
      await fauxBackend(page, RICH);
      await authentifier(page);
      const { constats } = await inspecterPage(page, route, 'donnees', erreurs);
      expect(constats.filter((c) => c.gravite === 'critique'), JSON.stringify(constats)).toEqual([]);
    });
  }
});

// ─── 3. Mobile : débordement horizontal et menu ──────────────────────────
test.describe('Scénario C — mobile 390 px', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  for (const route of PAGES) {
    test(`C ${route}`, async ({ page }) => {
      const erreurs = surveiller(page);
      await fauxBackend(page, RICH);
      await authentifier(page);
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(600);
      const deb = await page.evaluate(() => {
        const w = window.innerWidth;
        const larges = [...document.querySelectorAll('body *')]
          .filter((el) => { const r = el.getBoundingClientRect(); return r.width > 0 && r.right > w + 4 && getComputedStyle(el).position !== 'fixed'; })
          .filter((el) => !el.closest('[class*="overflow-x-auto"],[class*="overflow-auto"],table'))
          .slice(0, 3).map((el) => `${el.tagName.toLowerCase()}.${String(el.className).split(' ').slice(0, 2).join('.')}`);
        return { scroll: document.documentElement.scrollWidth, w, larges };
      });
      if (deb.scroll > deb.w + 4) noter({ couche: 'e2e', scenario: 'mobile', route, gravite: 'mineur', type: 'débordement horizontal sur mobile', detail: `largeur page ${deb.scroll}px pour écran ${deb.w}px — ${deb.larges.join(', ')}` });
      await page.screenshot({ path: path.join(SHOTS, `mobile${route.replace(/\//g, '_') || '_accueil'}.png`) }).catch(() => {});
      for (const e of erreurs) noter({ couche: 'e2e', scenario: 'mobile', route, gravite: e.type === 'exception JS' ? 'critique' : 'mineur', ...e });
    });
  }
});

// ─── 4. Explorateur : clique chaque bouton de chaque page ────────────────
test.describe('Scénario D — explorateur d\'interactions', () => {
  test.setTimeout(300_000);
  for (const route of PAGES.filter((p) => p !== '/manuel' && p !== '/politique-confidentialite')) {
    test(`D ${route}`, async ({ page }) => {
      const erreurs = surveiller(page);
      await fauxBackend(page, RICH);
      await authentifier(page);
      await page.goto(route);
      await page.waitForLoadState('networkidle').catch(() => {});
      const main = page.locator('main').first();
      const zone = (await main.count()) ? main : page.locator('body');
      const n = Math.min(await zone.locator('button:visible').count(), 30);
      let cliques = 0;
      for (let i = 0; i < n; i++) {
        const b = zone.locator('button:visible').nth(i);
        const label = ((await b.innerText().catch(() => '')) || (await b.getAttribute('aria-label').catch(() => '')) || '').trim().slice(0, 40);
        if (!(await b.isEnabled().catch(() => false))) continue;
        const avant = page.url();
        await b.click({ timeout: 1500, noWaitAfter: true }).catch(() => {});
        cliques++;
        await page.waitForTimeout(350);
        await page.keyboard.press('Escape').catch(() => {});
        const txt = await page.locator('body').innerText().catch(() => '');
        if (/Cette page n'a pas pu s'afficher/.test(txt)) {
          noter({ couche: 'e2e', scenario: 'clics', route, gravite: 'critique', type: 'plantage après clic', detail: `bouton « ${label} »` });
          break;
        }
        for (const e of erreurs.splice(0)) noter({ couche: 'e2e', scenario: 'clics', route, gravite: e.type === 'exception JS' ? 'critique' : 'mineur', type: `${e.type} après clic`, detail: `bouton « ${label} » → ${e.detail}` });
        if (page.url() !== avant) { await page.goto(route); await page.waitForLoadState('networkidle').catch(() => {}); }
      }
      noter({ couche: 'e2e', scenario: 'clics', route, gravite: 'info', type: 'couverture', detail: `${cliques} boutons cliqués` });
    });
  }
});

// ─── 5. Navigation : chaque lien du menu mène à une vraie page ───────────
test('E — tous les liens du menu latéral', async ({ page }) => {
  test.setTimeout(240_000);
  const erreurs = surveiller(page);
  await fauxBackend(page, RICH);
  await authentifier(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle').catch(() => {});
  const hrefs = await page.locator('aside a[href], nav a[href]').evaluateAll((as) => [...new Set(as.map((a) => a.getAttribute('href')))].filter((h) => h && h.startsWith('/')));
  noter({ couche: 'e2e', scenario: 'navigation', route: '/', gravite: 'info', type: 'liens du menu', detail: hrefs.join(' ') });
  for (const h of hrefs) {
    await page.goto(h, { waitUntil: 'domcontentloaded' }).catch(() => noter({ couche: 'e2e', scenario: 'navigation', route: h, gravite: 'moyen', type: 'navigation lente ou bloquée', detail: h }));
    await page.waitForTimeout(400);
    const t = await page.locator('body').innerText();
    if (/\b404\b/.test(t)) noter({ couche: 'e2e', scenario: 'navigation', route: h, gravite: 'majeur', type: 'lien de menu cassé (404)', detail: h });
  }
  const orphelines = PAGES.filter((p) => !hrefs.includes(p) && !['/onboarding', '/politique-confidentialite', '/tarifs', '/parametres/facturation'].includes(p));
  if (orphelines.length) noter({ couche: 'e2e', scenario: 'navigation', route: '-', gravite: 'mineur', type: 'pages absentes du menu', detail: orphelines.join(' ') });
  expect(erreurs.filter((e) => e.type === 'exception JS')).toEqual([]);
});

// ─── 6. Parcours d'import complet (analyse → confirmation → écriture) ────
test('F — parcours d\'import CSV de bout en bout', async ({ page }) => {
  const erreurs = surveiller(page);
  const journal = [];
  const planFixture = JSON.parse(fs.readFileSync(path.join(QA, 'fixtures/plan-ventes.json'), 'utf8'));
  const corpsImport = [];
  page.__importReply = (body) => (corpsImport.push(body), body?.mode === 'analyser')
    ? { results: [{ file_name: 'ventes-quebec.csv', entity: 'Order', plan: planFixture.plan, echantillon: planFixture.echantillon, apercu: [], rows_read: 3, status: 'analyse', quality: { score: 97, valid_rows: 3, total_rows: 3, quarantined_rows: 0 } }], champs_par_entite: { Order: ['order_id', 'customer_id', 'date', 'total', 'payment_status', 'status'] } }
    : { results: [{ file_name: 'ventes-quebec.csv', entity: 'Order', status: 'complete', rows_read: 3, rows: 3, quality: { score: 97 } }] };
  await fauxBackend(page, RICH, journal);
  await authentifier(page);
  await page.goto('/importer');
  await page.setInputFiles('input[type=file]', path.join(QA, 'fixtures/ventes-quebec.csv'));
  const confirmer = page.getByRole('button', { name: /Importer ces données/ });
  await expect(confirmer).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: path.join(SHOTS, 'import_1_plan.png'), fullPage: true });
  await confirmer.click();
  await expect(page.getByText(/Import terminé/).first()).toBeVisible({ timeout: 15000 });
  await page.screenshot({ path: path.join(SHOTS, 'import_2_resultat.png'), fullPage: true });

  const upload = journal.find((l) => /UploadPublicFile|\/UploadFile/.test(l));
  if (upload) noter({ couche: 'e2e', scenario: 'import', route: '/importer', gravite: 'majeur', type: 'fichier client téléversé en PUBLIC', detail: `${upload} — les fichiers financiers sont stockés avec une URL publique au lieu de UploadPrivateFile` });
  const prive = journal.some((l) => /UploadPrivateFile/.test(l));
  if (!prive) noter({ couche: 'e2e', scenario: 'import', route: '/importer', gravite: 'majeur', type: 'téléversement privé absent', detail: "aucun appel UploadPrivateFile pendant l'import" });
  const envois = corpsImport.flatMap((c) => c?.files || []);
  if (envois.some((f) => !f.file_uri || f.file_url)) noter({ couche: 'e2e', scenario: 'import', route: '/importer', gravite: 'majeur', type: 'fichier transmis sans file_uri privé', detail: JSON.stringify(envois).slice(0, 200) });
  expect(upload, 'aucun téléversement public').toBeUndefined();
  expect(prive, 'téléversement privé').toBe(true);
  const appels = journal.filter((l) => /functions\/importMultiData/.test(l)).length;
  noter({ couche: 'e2e', scenario: 'import', route: '/importer', gravite: 'info', type: 'parcours import', detail: `analyse + écriture OK, ${appels} appels importMultiData` });
  for (const e of erreurs) noter({ couche: 'e2e', scenario: 'import', route: '/importer', gravite: 'majeur', ...e });
});

// ─── 7. Import : fichier illisible ou erreur serveur ─────────────────────
test('G — import : message clair quand le serveur échoue', async ({ page }) => {
  const erreurs = surveiller(page);
  page.__importReply = () => ({ error: 'Fichier corrompu (test QA)' });
  await fauxBackend(page, RICH);
  await authentifier(page);
  await page.goto('/importer');
  fs.writeFileSync(path.join(OUT, 'vide.csv'), 'a;b\n');
  await page.setInputFiles('input[type=file]', path.join(OUT, 'vide.csv'));
  const vu = await page.getByText(/Fichier corrompu/).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  if (!vu) noter({ couche: 'e2e', scenario: 'import', route: '/importer', gravite: 'moyen', type: 'erreur d\'import non affichée', detail: 'le message d\'erreur du serveur n\'apparaît pas à l\'utilisateur' });
  for (const e of erreurs) noter({ couche: 'e2e', scenario: 'import-erreur', route: '/importer', gravite: 'mineur', ...e });
});

// ─── 8. Sécurité côté client : pages protégées sans session ──────────────
test.describe('Scénario H — visiteur non connecté', () => {
  for (const route of ['/', '/importer', '/finance', '/parametres']) {
    test(`H ${route}`, async ({ page }) => {
      await fauxBackend(page, null);
      await page.goto(route);
      await page.waitForTimeout(1500);
      if (!/\/login/.test(page.url())) noter({ couche: 'e2e', scenario: 'sans-session', route, gravite: 'critique', type: 'page protégée accessible sans connexion', detail: page.url() });
    });
  }
});

// ─── 9. Paramètres : chaque onglet, avec une fiche entreprise réelle ─────
const ONGLETS = ['entreprise', 'activite', 'organisation', 'produits', 'clients', 'objectifs', 'kpis', 'dictionnaire', 'comprehension', 'radar', 'sources', 'facturation', 'utilisateurs', 'preferences'];
test.describe('Scénario I — onglets Paramètres', () => {
  for (const onglet of ONGLETS) {
    test(`I ${onglet}`, async ({ page }) => {
      const erreurs = surveiller(page);
      const journal = [];
      await fauxBackend(page, RICH, journal);
      await authentifier(page);
      await page.goto(`/parametres?tab=${onglet}`);
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(700);
      const t = await page.locator('body').innerText();
      if (/Cette page n'a pas pu s'afficher/.test(t)) noter({ couche: 'e2e', scenario: 'parametres', route: `/parametres?tab=${onglet}`, gravite: 'critique', type: 'onglet Paramètres planté', detail: (t.match(/Cannot[^\n]*|TypeError[^\n]*/) || [''])[0].slice(0, 200) });
      await page.screenshot({ path: path.join(SHOTS, `parametres_${onglet}.png`) }).catch(() => {});
      for (const e of erreurs) noter({ couche: 'e2e', scenario: 'parametres', route: `/parametres?tab=${onglet}`, gravite: e.type === 'exception JS' ? 'critique' : 'mineur', ...e });
    });
  }
});

// ─── 10. Actions IA principales : le résultat revient bien à l'écran ─────
test('J1 — assistant : question et réponse', async ({ page }) => {
  const erreurs = surveiller(page);
  await fauxBackend(page, RICH);
  await authentifier(page);
  await page.goto('/assistant');
  await page.getByPlaceholder(/Posez votre question/).fill('Quelle est ma marge brute ?');
  await page.keyboard.press('Enter');
  const ok = await page.getByText(/Réponse Signature/).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  if (!ok) noter({ couche: 'e2e', scenario: 'ia', route: '/assistant', gravite: 'majeur', type: 'réponse de l\'assistant non affichée', detail: 'la réponse du backend n\'apparaît pas' });
  for (const e of erreurs) noter({ couche: 'e2e', scenario: 'ia', route: '/assistant', gravite: e.type === 'exception JS' ? 'critique' : 'mineur', ...e });
});

test('J2 — rapports : génération', async ({ page }) => {
  const erreurs = surveiller(page);
  const journal = [];
  await fauxBackend(page, RICH, journal);
  await authentifier(page);
  await page.goto('/rapports');
  await page.waitForLoadState('networkidle').catch(() => {});
  const bouton = page.getByRole('button', { name: /Générer|mensuel/i }).first();
  if (await bouton.count()) {
    await bouton.click();
    await page.waitForTimeout(1500);
    if (!journal.some((l) => /functions\/generateReport/.test(l))) noter({ couche: 'e2e', scenario: 'ia', route: '/rapports', gravite: 'majeur', type: 'génération de rapport non déclenchée', detail: 'aucun appel generateReport' });
  } else noter({ couche: 'e2e', scenario: 'ia', route: '/rapports', gravite: 'moyen', type: 'bouton de génération introuvable', detail: '' });
  await page.screenshot({ path: path.join(SHOTS, 'rapports_genere.png') }).catch(() => {});
  for (const e of erreurs) noter({ couche: 'e2e', scenario: 'ia', route: '/rapports', gravite: e.type === 'exception JS' ? 'critique' : 'mineur', ...e });
});

test('J3 — tableau de bord : lancer l\'analyse', async ({ page }) => {
  const erreurs = surveiller(page);
  const journal = [];
  await fauxBackend(page, RICH, journal);
  await authentifier(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle').catch(() => {});
  const bouton = page.getByRole('button', { name: /Analyser|analyse/i }).first();
  if (await bouton.count()) {
    await bouton.click();
    const ok = await page.getByText(/Analyse terminée/).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
    if (!ok) noter({ couche: 'e2e', scenario: 'ia', route: '/', gravite: 'moyen', type: 'fin d\'analyse non confirmée', detail: `appels: ${journal.filter((l) => /analyzeBusiness/.test(l)).length}` });
  } else noter({ couche: 'e2e', scenario: 'ia', route: '/', gravite: 'info', type: 'bouton d\'analyse absent avec données', detail: '' });
  for (const e of erreurs) noter({ couche: 'e2e', scenario: 'ia', route: '/', gravite: e.type === 'exception JS' ? 'critique' : 'mineur', ...e });
});
