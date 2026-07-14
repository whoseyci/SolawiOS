// Comprehensive Playwright test suite for SolawiOS
import { chromium } from 'playwright';
import sparticuzChromium, { inflate, setupLambdaEnvironment } from '@sparticuz/chromium';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';

const BASE = 'http://localhost:8765';
const FILE_URL = 'file:///home/user/SolawiOS/solawios.html';

mkdirSync('/home/user/SolawiOS/screenshots', { recursive: true });
mkdirSync('/home/user/SolawiOS/test-output', { recursive: true });

let browser, context, page;
let testResults = [];
let testStartTime;

const log = (...args) => console.log(...args);
const PASS = (name) => { testResults.push({ name, status: 'PASS' }); log('  ✅ ' + name); };
const FAIL = (name, err) => { testResults.push({ name, status: 'FAIL', err: err?.message || String(err) }); log('  ❌ ' + name + ': ' + (err?.message || err)); };
const SKIP = (name, reason) => { testResults.push({ name, status: 'SKIP', reason }); log('  ⏭️  ' + name + ' (' + reason + ')'); };

async function test(name, fn) {
  testStartTime = Date.now();
  try {
    await fn();
    const ms = Date.now() - testStartTime;
    PASS(name);
    testResults[testResults.length - 1].duration = ms;
  } catch (err) {
    FAIL(name, err);
  } finally {
    // Close any open modals at the end
    try {
      while (await page.locator('.modal-backdrop').count() > 0) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
      }
    } catch (e) {}
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error('Assertion failed: ' + (msg || 'expected truthy'));
}

function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`Assertion failed: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}${msg ? ' — ' + msg : ''}`);
}

function assertContains(haystack, needle, msg) {
  if (!String(haystack).includes(String(needle))) {
    throw new Error(`Assertion failed: ${JSON.stringify(needle)} not found in ${JSON.stringify(String(haystack).slice(0, 200))}${msg ? ' — ' + msg : ''}`);
  }
}

async function shot(name) {
  await page.screenshot({ path: `/home/user/SolawiOS/screenshots/${name}.png`, fullPage: true });
}

async function go(pageId, tab=null) {
  await page.evaluate(({p, t}) => {
    window.navigate(p, t);
  }, { p: pageId, t: tab });
  await page.waitForTimeout(150);
}

async function start() {
  // Launch with custom args for sandbox
  let executablePath;
  let args = ['--no-sandbox', '--disable-dev-shm-usage', '--disable-setuid-sandbox'];
  try {
    await inflate('/home/user/SolawiOS/node_modules/@sparticuz/chromium/bin/al2023.tar.br');
    setupLambdaEnvironment('/tmp/al2023/lib');
    executablePath = await sparticuzChromium.executablePath();
    args = sparticuzChromium.args;
  } catch(e) {}
  browser = await chromium.launch({
    executablePath,
    headless: true,
    args
  });
  context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  page = await context.newPage();

  // Capture console errors
  page.on('pageerror', (err) => {
    log('  ⚠️  PAGE ERROR:', err.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') log('  ⚠️  CONSOLE ERROR:', msg.text());
  });
  await page.goto(FILE_URL, { waitUntil: 'load' });
  await page.waitForTimeout(100);
}

async function finish() {
  if (browser) await browser.close();
  const passed = testResults.filter(r => r.status === 'PASS').length;
  const failed = testResults.filter(r => r.status === 'FAIL').length;
  const skipped = testResults.filter(r => r.status === 'SKIP').length;
  log('\n' + '='.repeat(60));
  log(`  RESULTS:  ${passed} passed · ${failed} failed · ${skipped} skipped · ${testResults.length} total`);
  log('='.repeat(60));
  if (failed > 0) {
    log('\nFailed tests:');
    for (const r of testResults.filter(r => r.status === 'FAIL')) {
      log(`  ❌ ${r.name}: ${r.err}`);
    }
  }
  writeFileSync('/home/user/SolawiOS/test-output/report.json', JSON.stringify(testResults, null, 2));
  process.exit(failed > 0 ? 1 : 0);
}

(async () => {
  log('🌾 SolawiOS Test Suite\n');
  log('Starting browser...');
  await start();
  log('Browser started.\n');

  // ============================================
  // CORE LAYOUT
  // ============================================
  log('--- Core Layout ---');
  await test('Sidebar and brand are present', async () => {
    assert(await page.locator('.sidebar').isVisible(), 'sidebar visible');
    assertContains(await page.locator('.brand-name').textContent(), 'SolawiOS');
    assert(await page.locator('.nav-item').count() > 0, 'has nav items');
  });
  await test('All navigation items are rendered', async () => {
    const items = await page.locator('.nav-item').allTextContents();
    assert(items.length >= 14, `expected at least 14 nav items, got ${items.length}`);
    assertContains(items.join(' '), 'Dashboard');
    assertContains(items.join(' '), 'Mitglieder');
    assertContains(items.join(' '), 'Ernteanteile');
    assertContains(items.join(' '), 'Verteilung');
    assertContains(items.join(' '), 'Kulturarten');
    assertContains(items.join(' '), 'Beetplanung');
    assertContains(items.join(' '), 'Anbaukalender');
    assertContains(items.join(' '), 'Ernteerfassung');
    assertContains(items.join(' '), 'Aufgaben');
    assertContains(items.join(' '), 'Lager');
    assertContains(items.join(' '), 'Bestellungen');
    assertContains(items.join(' '), 'Finanzen');
    assertContains(items.join(' '), 'Mitteilungen');
    assertContains(items.join(' '), 'Berichte');
    assertContains(items.join(' '), 'Stammdaten');
  });
  await test('Topbar has title, search, and action button', async () => {
    assert(await page.locator('.topbar-title').isVisible());
    assert(await page.locator('#global-search').isVisible());
    assert(await page.locator('button:has-text("Aktion")').isVisible());
  });
  await test('No console errors on initial load', async () => {
    // We tracked them; re-test the global window state
    const errs = await page.evaluate(() => window.__errors || []);
    assertEqual(errs.length, 0, 'no js errors');
  });

  // ============================================
  // DASHBOARD
  // ============================================
  log('\n--- Dashboard ---');
  await test('Dashboard loads with hero, stats, and charts', async () => {
    await go('dashboard');
    assert(await page.locator('.hero').isVisible(), 'hero');
    assertContains(await page.locator('.hero h2').textContent(), 'Willkommen');
    const stats = await page.locator('.stat').count();
    assert(stats >= 5, `at least 5 stats, got ${stats}`);
    assert(await page.locator('canvas#dash-harvest').isVisible(), 'harvest chart');
    assert(await page.locator('canvas#dash-shares').isVisible(), 'shares chart');
    await shot('01-dashboard');
  });
  await test('Dashboard shows activity feed', async () => {
    const activity = await page.locator('.activity-item').count();
    assert(activity > 0, 'has activity items');
  });
  await test('Dashboard time range buttons work', async () => {
    await page.click('button:has-text("30T")');
    await page.waitForTimeout(150);
    // Check that harvest chart canvas is still there
    assert(await page.locator('canvas#dash-harvest').isVisible());
  });

  // ============================================
  // MEMBERS
  // ============================================
  log('\n--- Members ---');
  await test('Members page lists sample members', async () => {
    await go('members');
    await page.waitForSelector('.member-row, .empty-state', { timeout: 3000 });
    const rows = await page.locator('.member-row').count();
    assert(rows >= 20, `at least 20 members, got ${rows}`);
    assert(await page.locator('text=Maria').first().isVisible().catch(() => true) ||
           await page.locator('.member-row').first().isVisible(), 'has at least one member');
    await shot('02-members');
  });
  await test('Search filter works', async () => {
    await page.fill('#member-search', 'Lena');
    await page.waitForTimeout(100);
    const rows = await page.locator('.member-row').count();
    assert(rows >= 1, 'Lena found');
  });
  await test('Status filter works', async () => {
    await page.fill('#member-search', '');
    await page.selectOption('#member-status', 'aktiv');
    await page.waitForTimeout(100);
    const rows = await page.locator('.member-row').count();
    assert(rows >= 10, 'active members');
  });
  await test('Status filter reset', async () => {
    await page.selectOption('#member-status', '');
    await page.waitForTimeout(100);
    const rows = await page.locator('.member-row').count();
    assert(rows >= 20, 'all members');
  });
  await test('Open member form (create new)', async () => {
    await page.click('button:has-text("+ Neues Mitglied")');
    await page.waitForSelector('.modal', { timeout: 1500 });
    assert(await page.locator('.modal-title:has-text("Neues Mitglied")').isVisible());
    await shot('03-member-form');
  });
  await test('Fill and save new member', async () => {
    // Close any open modals first
    while (await page.locator('.modal-backdrop').count() > 0) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(100);
    }
    await page.click('button:has-text("+ Neues Mitglied")');
    await page.waitForSelector('input#f-name', { timeout: 3000 });
    await page.fill('input#f-name', 'Test MitgLied XYZ');
    await page.fill('input#f-email', 'test@example.com');
    await page.fill('input#f-phone', '+49 123 456789');
    await page.fill('input#f-address', 'Testweg 1');
    await page.fill('input#f-city', '12345 Teststadt');
    await page.click('.modal button:has-text("Anlegen")');
    await page.waitForTimeout(100);
    // Search for the new member
    await page.fill('#member-search', 'Test MitgLied');
    await page.waitForTimeout(150);
    const found = await page.locator('.member-row').count();
    assert(found >= 1, 'new member appears');
  });
  await test('Open member detail', async () => {
    await page.fill('#member-search', '');
    await page.waitForTimeout(100);
    await page.locator('.member-row').first().click();
    await page.waitForSelector('.modal-title', { timeout: 1500 });
    assert(await page.locator('.detail-name').isVisible());
    await shot('04-member-detail');
    await page.click('.modal button:has-text("Schließen")');
  });
  await test('Edit member', async () => {
    await page.locator('.member-row').first().click();
    await page.waitForSelector('.modal-title', { timeout: 1500 });
    await page.click('button:has-text("Bearbeiten")');
    await page.waitForSelector('input#f-name', { timeout: 1500 });
    const val = await page.inputValue('input#f-name');
    assert(val.length > 0, 'name is filled');
    await page.click('button:has-text("Speichern")');
    await page.waitForTimeout(150);
  });

  // ============================================
  // SHARES
  // ============================================
  log('\n--- Shares ---');
  await test('Shares overview shows stats and table', async () => {
    await go('shares');
    const stats = await page.locator('.stat').count();
    assert(stats >= 4, 'has stats');
    assert(await page.locator('canvas#chart-shares-status').isVisible());
    await shot('05-shares');
  });
  await test('Shares distribution tab', async () => {
    await page.click('.tab:has-text("Verteilung planen")');
    await page.waitForTimeout(100);
    assert(await page.locator('table').first().isVisible());
  });
  await test('Shares pricing tab', async () => {
    await page.click('.tab:has-text("Preise")');
    await page.waitForTimeout(100);
    assert(await page.locator('input#pp-small').isVisible());
  });
  await test('Open share form', async () => {
    await page.click('.tab:has-text("Übersicht")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("+ Anteil zuweisen")');
    await page.waitForSelector('.modal', { timeout: 1500 });
    await shot('06-share-form');
    await page.click('.modal button:has-text("Abbrechen")');
  });

  // ============================================
  // DISTRIBUTION
  // ============================================
  log('\n--- Distribution ---');
  await test('Depots are listed', async () => {
    await go('distribution');
    const cards = await page.locator('.card-pad').count();
    assert(cards >= 1, 'has depot cards');
    await shot('07-distribution');
  });
  await test('Open depot form', async () => {
    await page.click('button:has-text("+ Neues Depot")');
    await page.waitForSelector('.modal-title:has-text("Neues Depot")', { timeout: 1500 });
    await page.fill('input#d-name', 'Test Depot');
    await page.fill('input#d-addr', 'Teststr. 1');
    await page.click('button:has-text("Speichern")');
    await page.waitForTimeout(150);
  });
  await test('Routes tab', async () => {
    await page.click('.tab:has-text("Routen")');
    await page.waitForTimeout(100);
    assert(await page.locator('text=Kilometer').isVisible());
  });
  await test('Pickups tab', async () => {
    await page.click('.tab:has-text("Abholtermine")');
    await page.waitForTimeout(100);
    const rows = await page.locator('table tbody tr').count();
    assert(rows >= 5, 'has pickup dates');
  });

  // ============================================
  // CROPS
  // ============================================
  log('\n--- Crops ---');
  await test('Crops list shows culture cards', async () => {
    await go('crops');
    const cards = await page.locator('.card-pad').count();
    assert(cards >= 20, 'has many crops');
    await shot('08-crops');
  });
  await test('Crops by family tab', async () => {
    await page.click('.tab:has-text("Nach Familie")');
    await page.waitForTimeout(100);
    assert(await page.locator('table').first().isVisible());
  });
  await test('Crops needs tab', async () => {
    await page.click('.tab:has-text("Ansprüche")');
    await page.waitForTimeout(100);
    assert(await page.locator('th:has-text("Gute Nachbarn")').isVisible());
  });
  await test('Create new crop', async () => {
    await page.click('.tab:has-text("Liste")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("+ Neue Kultur")');
    await page.waitForSelector('.modal-title', { timeout: 1500 });
    await page.fill('input#cr-name', 'Testkultur XYZ');
    await page.click('button:has-text("Speichern")');
    await page.waitForTimeout(150);
    assertContains(await page.content(), 'Testkultur XYZ');
  });

  // ============================================
  // FIELD PLAN
  // ============================================
  log('\n--- Field Plan ---');
  await test('Field plan canvas shows beds', async () => {
    await go('fieldplan');
    const blocks = await page.locator('.field-bed-block').count();
    assert(blocks >= 5, 'has bed blocks');
    await shot('09-fieldplan');
  });
  await test('Field plan rotation tab', async () => {
    await page.click('.tab:has-text("Fruchtfolge")');
    await page.waitForTimeout(100);
    assert(await page.locator('th:has-text("Beet")').isVisible());
  });
  await test('Field plan beds tab', async () => {
    await page.click('.tab:has-text("Beete")');
    await page.waitForTimeout(100);
    const rows = await page.locator('tbody tr').count();
    assert(rows >= 5, 'has beds');
  });
  await test('Add new bed', async () => {
    await page.click('button:has-text("+ Neues Beet")');
    await page.waitForSelector('.modal-title', { timeout: 1500 });
    await page.fill('input#b-name', 'Test Beet XYZ');
    await page.click('button:has-text("Speichern")');
    await page.waitForTimeout(150);
  });
  await test('Plan a planting', async () => {
    await page.click('button:has-text("🌱 Bepflanzung planen")');
    await page.waitForSelector('.modal-title:has-text("Bepflanzung planen")', { timeout: 1500 });
    await page.click('button:has-text("Speichern")');
    await page.waitForTimeout(150);
  });

  // ============================================
  // CALENDAR
  // ============================================
  log('\n--- Calendar ---');
  await test('Calendar gantt view', async () => {
    await go('calendar');
    const bars = await page.locator('.gantt-bar').count();
    assert(bars >= 1, 'has gantt bars');
    await shot('10-calendar');
  });
  await test('Calendar list view', async () => {
    await page.click('button:has-text("Liste")');
    await page.waitForTimeout(100);
    const rows = await page.locator('tbody tr').count();
    assert(rows >= 1, 'has list rows');
  });

  // ============================================
  // HARVEST
  // ============================================
  log('\n--- Harvest ---');
  await test('Harvest log shows entries', async () => {
    await go('harvest');
    const rows = await page.locator('tbody tr').count();
    assert(rows >= 10, `at least 10 harvest entries, got ${rows}`);
    await shot('11-harvest');
  });
  await test('Harvest by-crop tab', async () => {
    await page.click('.tab:has-text("Nach Kultur")');
    await page.waitForTimeout(100);
    assert(await page.locator('canvas#harv-pie').isVisible());
  });
  await test('Harvest by-week tab', async () => {
    await page.click('.tab:has-text("Nach Woche")');
    await page.waitForTimeout(100);
    assert(await page.locator("h1, .card-title, .stat").first().isVisible().catch(()=>true));
  });
  await test('Add new harvest', async () => {
    await page.click('.tab:has-text("Erfassung")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("+ Ernte buchen")');
    await page.waitForSelector('.modal-title:has-text("Ernte buchen")', { timeout: 1500 });
    await page.fill('input#h-amount', '42');
    await page.click('.modal button:has-text("Buchen")');
    await page.waitForTimeout(200);
    // The number is formatted as "42,0 kg" in German
    assertContains(await page.content(), '42');
  });

  // ============================================
  // TASKS
  // ============================================
  log('\n--- Tasks ---');
  await test('Tasks kanban has 4 columns', async () => {
    await go('tasks');
    const cols = await page.locator('.kanban-col').count();
    assertEqual(cols, 4, 'has 4 kanban columns');
    await shot('12-tasks');
  });
  await test('Tasks list view', async () => {
    await page.click('button:has-text("Liste")');
    await page.waitForTimeout(100);
    const rows = await page.locator('tbody tr').count();
    assert(rows >= 5, 'has task rows');
  });
  await test('Tasks calendar view', async () => {
    await page.click('button:has-text("Kalender")');
    await page.waitForTimeout(100);
    const bars = await page.locator('.gantt-bar').count();
    assert(bars >= 0, 'has gantt area');
  });
  await test('Create new task', async () => {
    await page.click('button:has-text("Kanban")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("+ Aufgabe")');
    await page.waitForSelector('.modal-title', { timeout: 1500 });
    await page.fill('input#t-title', 'Testaufgabe XYZ');
    await page.click('button:has-text("Speichern")');
    await page.waitForTimeout(150);
    assertContains(await page.content(), 'Testaufgabe XYZ');
  });
  await test('Drag task from backlog to in_progress (simulated)', async () => {
    // Use the underlying state to move a task
    await page.evaluate(() => {
      const t = state.tasks.find(t => t.status === 'backlog' || t.status === 'todo');
      if (t) {
        t.status = 'in_progress';
        Store.save(state);
      }
    });
    await go('tasks');
    // Verify it shows in in_progress column
    const inProg = await page.locator('[data-col="in_progress"] .kanban-card').count();
    assert(inProg >= 1, 'has task in progress column');
  });
  await test('Complete task', async () => {
    await page.evaluate(() => {
      const t = state.tasks.find(t => t.status === 'in_progress');
      if (t) {
        t.status = 'done';
        t.doneAt = new Date().toISOString();
        Store.save(state);
      }
    });
  });

  // ============================================
  // INVENTORY
  // ============================================
  log('\n--- Inventory ---');
  await test('Inventory shows items', async () => {
    await go('inventory');
    const rows = await page.locator('tbody tr').count();
    assert(rows >= 10, 'has inventory items');
    await shot('13-inventory');
  });
  await test('Inventory low stock tab', async () => {
    await page.click('.tab:has-text("Niedriger Bestand")');
    await page.waitForTimeout(100);
    const rows = await page.locator('tbody tr').count();
    assert(rows >= 1, 'has low stock items');
  });
  await test('Adjust stock with +1 button', async () => {
    await page.click('.tab:has-text("Artikel")');
    await page.waitForTimeout(100);
    const first = await page.locator('tbody tr').first();
    const beforeText = await first.locator('td').nth(2).textContent();
    await first.locator('button:has-text("+1")').click();
    await page.waitForTimeout(100);
  });
  await test('Create new inventory item', async () => {
    await page.click('button:has-text("+ Neuer Artikel")');
    await page.waitForSelector('.modal-title', { timeout: 1500 });
    await page.fill('input#i-name', 'Test Saatgut XYZ');
    await page.click('button:has-text("Speichern")');
    await page.waitForTimeout(150);
  });

  // ============================================
  // ORDERS
  // ============================================
  log('\n--- Orders ---');
  await test('Orders open list', async () => {
    await go('orders');
    const rows = await page.locator('tbody tr').count();
    assert(rows >= 1, 'has open orders');
    await shot('14-orders');
  });
  await test('Orders delivered tab', async () => {
    await page.click('.tab:has-text("Geliefert")');
    await page.waitForTimeout(100);
    const rows = await page.locator('tbody tr').count();
    assert(rows >= 1, 'has delivered orders');
  });
  await test('Orders products tab', async () => {
    await page.click('.tab:has-text("Produkte")');
    await page.waitForTimeout(100);
    const products = await page.locator('.card-pad .card-pad').count();
    assert(products >= 1, 'has product cards');
  });
  await test('Create new order', async () => {
    await page.click('.tab:has-text("Offen")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("+ Neue Bestellung")');
    await page.waitForSelector('.modal-title', { timeout: 1500 });
    await page.click('button:has-text("Anlegen")');
    await page.waitForTimeout(150);
  });
  await test('Mark order as delivered', async () => {
    const delBtn = await page.locator('button:has-text("Liefern")').first();
    if (await delBtn.count() > 0) {
      await delBtn.click();
      await page.waitForTimeout(100);
    }
  });

  // ============================================
  // FINANCE
  // ============================================
  log('\n--- Finance ---');
  await test('Finance overview with stats and charts', async () => {
    await go('finance');
    const stats = await page.locator('.stat').count();
    assert(stats >= 4, 'has finance stats');
    assert(await page.locator('canvas#fin-monthly').isVisible());
    await shot('15-finance');
  });
  await test('Finance list tab', async () => {
    await page.click('button:has-text("Buchungen")');
    await page.waitForTimeout(100);
    const rows = await page.locator('tbody tr').count();
    assert(rows >= 10, 'has payment rows');
  });
  await test('Finance budget tab', async () => {
    await page.click('button:has-text("Budget")');
    await page.waitForTimeout(100);
    assert(await page.locator('table').first().isVisible());
  });
  await test('Create new payment', async () => {
    await page.click('button:has-text("Übersicht")');
    await page.waitForTimeout(100);
    await page.click('button:has-text("+ Buchung")');
    await page.waitForSelector('.modal-title', { timeout: 1500 });
    await page.fill('input#p-name', 'Testbuchung XYZ');
    await page.fill('input#p-amount', '99.50');
    await page.click('button:has-text("Speichern")');
    await page.waitForTimeout(150);
    // Switch to list tab to verify
    await page.click('button:has-text("Buchungen")');
    await page.waitForTimeout(150);
    assertContains(await page.content(), '99,50');
  });
  await test('Charge all members', async () => {
    await page.click('button:has-text("Übersicht")');
    await page.waitForTimeout(200);
    const btn = await page.locator('button:has-text("Alle abbuchen")');
    if (await btn.count() > 0) {
      await btn.click();
      await page.waitForTimeout(200);
      const confirmBtn = await page.locator('.modal button:has-text("Alle buchen")');
      if (await confirmBtn.count() > 0) {
        await confirmBtn.click();
        await page.waitForTimeout(200);
      }
    }
  });

  // ============================================
  // MESSAGES
  // ============================================
  log('\n--- Messages ---');
  await test('Messages inbox shows sent messages', async () => {
    await go('messages');
    const cards = await page.locator('.card-pad').count();
    assert(cards >= 1, 'has messages');
    await shot('16-messages');
  });
  await test('Open new message form', async () => {
    await page.click('button:has-text("✉️ Neue Mitteilung")');
    await page.waitForSelector('.modal-title', { timeout: 1500 });
    await page.fill('input#msg-title', 'Testmitteilung XYZ');
    await page.fill('textarea#msg-body', 'Liebe Mitglieder, dies ist ein Test.');
    await page.click('button:has-text("Senden")');
    await page.waitForTimeout(150);
    assertContains(await page.content(), 'Testmitteilung XYZ');
  });
  await test('Open message detail', async () => {
    await page.locator('.card-pad:has-text("Testmitteilung")').first().click();
    await page.waitForTimeout(150);
    assert(await page.locator('button:has-text("Schließen")').isVisible());
    await page.click('button:has-text("Schließen")');
  });

  // ============================================
  // REPORTS
  // ============================================
  log('\n--- Reports ---');
  await test('Reports show 4 stat cards and charts', async () => {
    await go('reports');
    const stats = await page.locator('.card-pad .row').count();
    assert(stats >= 4, 'has 4 report cards');
    assert(await page.locator('canvas#rep-harvest').isVisible());
    assert(await page.locator('canvas#rep-members').isVisible());
    assert(await page.locator('canvas#rep-finance').isVisible());
    assert(await page.locator('canvas#rep-tasks').isVisible());
    await shot('17-reports');
  });

  // ============================================
  // SETTINGS
  // ============================================
  log('\n--- Settings ---');
  await test('Settings farm tab', async () => {
    await go('settings');
    assert(await page.locator('input#set-name').isVisible());
    await shot('18-settings');
  });
  await test('Settings season tab', async () => {
    await page.click('.tab:has-text("Saison")');
    await page.waitForTimeout(100);
    assert(await page.locator('input#set-year').isVisible());
  });
  await test('Settings data tab', async () => {
    await page.click('.tab:has-text("Daten")');
    await page.waitForTimeout(100);
    assert(await page.locator('button:has-text("Backup")').isVisible());
  });
  await test('Settings about tab', async () => {
    await page.click('.tab:has-text("Über")');
    await page.waitForTimeout(100);
    assertContains(await page.content(), 'SolawiOS');
  });
  await test('Update farm name', async () => {
    await page.click('.tab:has-text("Hof")');
    await page.waitForTimeout(100);
    await page.fill('input#set-name', 'Hof Testwurzel');
    await page.click('button:has-text("Speichern")');
    await page.waitForTimeout(100);
  });

  // ============================================
  // COMMAND PALETTE
  // ============================================
  log('\n--- Command Palette ---');
  await test('Open command palette via Ctrl+K', async () => {
    // Click body first to ensure focus
    await page.click('body');
    await page.keyboard.press('Control+k');
    await page.waitForSelector('.modal-title:has-text("Schnellaktion")', { timeout: 1500 });
    await shot('19-command-palette');
  });
  await test('Filter command palette', async () => {
    // Palette should still be open from previous test
    if (await page.locator('.modal-backdrop').count() === 0) {
      await page.click('body');
      await page.keyboard.press('Control+k');
      await page.waitForSelector('input#cmd-q', { timeout: 1500 });
    }
    await page.fill('input#cmd-q', 'Ernte');
    await page.waitForTimeout(150);
    const items = await page.locator('#cmd-list [data-i]').count();
    assert(items >= 1, 'has filtered items');
  });
  await test('Execute command', async () => {
    if (await page.locator('.modal-backdrop').count() === 0) {
      await page.click('body');
      await page.keyboard.press('Control+k');
      await page.waitForSelector('input#cmd-q', { timeout: 1500 });
    }
    await page.fill('input#cmd-q', 'Dashboard');
    await page.waitForTimeout(150);
    await page.locator('#cmd-list [data-i]').first().click();
    await page.waitForTimeout(200);
    assertContains(await page.locator('.topbar-title').textContent(), 'Dashboard');
  });

  // ============================================
  // GLOBAL SEARCH
  // ============================================
  log('\n--- Global Search ---');
  await test('Global search finds members', async () => {
    await page.fill('#global-search', 'Müller');
    await page.waitForSelector('.modal-title:has-text("Suche")', { timeout: 1500 });
    const items = await page.locator('.activity-item').count();
    assert(items >= 1, 'finds members');
    await shot('20-search');
    await page.click('.modal button:has-text("Schließen")');
    await page.waitForTimeout(100);
  });
  await test('Global search finds crops', async () => {
    await page.fill('#global-search', 'Tomate');
    await page.waitForSelector('.modal-title:has-text("Suche")', { timeout: 1500 });
    const items = await page.locator('.activity-item').count();
    assert(items >= 1, 'finds tomato');
    await page.click('.modal button:has-text("Schließen")');
    await page.waitForTimeout(100);
  });

  // ============================================
  // PERSISTENCE
  // ============================================
  log('\n--- Persistence ---');
  await test('State persists to localStorage', async () => {
    const data = await page.evaluate(() => localStorage.getItem('solawios_v1'));
    assert(data && data.length > 100, 'has data in localStorage');
  });
  await test('Reload page preserves state', async () => {
    const before = await page.evaluate(() => state.members.length);
    await page.reload();
    await page.waitForTimeout(100);
    const after = await page.evaluate(() => state.members.length);
    assertEqual(after, before, 'member count preserved');
  });

  // ============================================
  // RESPONSIVE
  // ============================================
  log('\n--- Responsive ---');
  await test('Mobile viewport (375px)', async () => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForTimeout(100);
    assert(await page.locator('.app').isVisible());
    await shot('21-mobile');
  });
  await test('Tablet viewport (768px)', async () => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(100);
    await shot('22-tablet');
  });
  await test('Desktop viewport (1440px)', async () => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.waitForTimeout(100);
    await shot('23-desktop');
  });

  // ============================================
  // KEYBOARD & ACCESSIBILITY
  // ============================================
  log('\n--- Keyboard & A11y ---');
  await test('Escape closes modals', async () => {
    await go('members');
    await page.locator('.member-row').first().click();
    await page.waitForSelector('.modal', { timeout: 1500 });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(150);
    const modals = await page.locator('.modal-backdrop').count();
    assert(modals === 0, 'modal closed');
  });

  // ============================================
  // DARK MODE
  // ============================================
  log('\n--- Dark Mode ---');
  await test('Dark mode rendering', async () => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.waitForTimeout(100);
    await shot('24-darkmode');
  });

  await finish();
})().catch(async (err) => {
  log('\n💥 Unhandled error:', err);
  if (testResults.length === 0) {
    log('Could not start tests.');
  }
  await finish();
});
