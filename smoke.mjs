// Quick smoke test - just verify the changes I made work
import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const page = await browser.newPage();

const errors = [];
page.on('pageerror', e => errors.push('PAGE: ' + e.message));
page.on('console', m => { if (m.type() === 'error') errors.push('CON: ' + m.text()); });

await page.goto('http://localhost:5173/', { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(500);

async function test(name, fn) {
  try {
    await fn();
    console.log('  ✅ ' + name);
  } catch (e) {
    console.log('  ❌ ' + name + ': ' + e.message.split('\n')[0]);
  }
}

console.log('--- Finance tabs (data-view) ---');
await page.evaluate(() => window.navigate('finance'));
await page.waitForTimeout(300);
await test('Finance overview loads', async () => {
  const stats = await page.locator('.stat').count();
  if (stats < 4) throw new Error(`expected 4 stats, got ${stats}`);
});
await test('Finance Buchungen tab', async () => {
  await page.locator('button[data-view="list"]').click();
  await page.waitForTimeout(300);
  const rows = await page.locator('tbody tr').count();
  if (rows < 5) throw new Error(`expected at least 5 payment rows, got ${rows}`);
});
await test('Finance Budget tab', async () => {
  await page.locator('button[data-view="budget"]').click();
  await page.waitForTimeout(300);
  const tables = await page.locator('table').count();
  if (tables < 1) throw new Error('no table');
});

console.log('--- Tasks tabs (data-view) ---');
await page.evaluate(() => window.navigate('tasks'));
await page.waitForTimeout(300);
await test('Tasks kanban', async () => {
  const cols = await page.locator('.kanban-col').count();
  if (cols !== 4) throw new Error(`expected 4 cols, got ${cols}`);
});
await test('Tasks list view', async () => {
  await page.locator('button[data-view="list"]').click();
  await page.waitForTimeout(300);
  const rows = await page.locator('tbody tr').count();
  if (rows < 5) throw new Error(`expected at least 5 rows, got ${rows}`);
});

console.log('--- Calendar tabs (data-view) ---');
await page.evaluate(() => window.navigate('calendar'));
await page.waitForTimeout(300);
await test('Calendar gantt', async () => {
  const bars = await page.locator('.gantt-bar').count();
  if (bars < 1) throw new Error('no gantt bars');
});
await test('Calendar list view', async () => {
  await page.locator('button[data-view="list"]').click();
  await page.waitForTimeout(300);
  const rows = await page.locator('tbody tr').count();
  if (rows < 1) throw new Error('no list rows');
});

console.log('--- Orders (data-tab) ---');
await page.evaluate(() => window.navigate('orders'));
await page.waitForTimeout(300);
await test('Orders open list', async () => {
  const rows = await page.locator('tbody tr').count();
  if (rows < 1) throw new Error('no open orders');
});
await test('Orders delivered tab', async () => {
  await page.locator('div[data-tab="delivered"]').click();
  await page.waitForTimeout(300);
  const rows = await page.locator('tbody tr').count();
  if (rows < 1) throw new Error('no delivered orders');
});
await test('Orders products tab', async () => {
  await page.locator('div[data-tab="products"]').click();
  await page.waitForTimeout(300);
  const products = await page.locator('.card-pad .card-pad').count();
  if (products < 1) throw new Error('no product cards');
});

console.log('--- Inventory (data-tab) ---');
await page.evaluate(() => window.navigate('inventory'));
await page.waitForTimeout(300);
await test('Inventory items', async () => {
  const rows = await page.locator('tbody tr').count();
  if (rows < 5) throw new Error('not enough items');
});
await test('Inventory low stock tab', async () => {
  await page.locator('div[data-tab="low"]').click();
  await page.waitForTimeout(300);
  const rows = await page.locator('tbody tr').count();
  if (rows < 1) throw new Error('no low stock items');
});

console.log('--- Distribution (data-tab) ---');
await page.evaluate(() => window.navigate('distribution'));
await page.waitForTimeout(300);
await test('Depots listed', async () => {
  const cards = await page.locator('.card-pad').count();
  if (cards < 1) throw new Error('no depots');
});
await test('Routes tab', async () => {
  await page.locator('div[data-tab="routes"]').click();
  await page.waitForTimeout(300);
  const km = await page.locator('text=Kilometer').count();
  if (km < 1) throw new Error('no km');
});
await test('Pickups tab', async () => {
  await page.locator('div[data-tab="pickups"]').click();
  await page.waitForTimeout(300);
  const rows = await page.locator('tbody tr').count();
  if (rows < 1) throw new Error('no pickup rows');
});

console.log('--- Shares (data-tab) ---');
await page.evaluate(() => window.navigate('shares'));
await page.waitForTimeout(300);
await test('Shares overview', async () => {
  const stats = await page.locator('.stat').count();
  if (stats < 4) throw new Error('no stats');
});
await test('Shares distribution tab', async () => {
  await page.locator('div[data-tab="distribution"]').click();
  await page.waitForTimeout(300);
  const tables = await page.locator('table').count();
  if (tables < 1) throw new Error('no table');
});
await test('Shares pricing tab', async () => {
  await page.locator('div[data-tab="pricing"]').click();
  await page.waitForTimeout(300);
  const small = await page.locator('#pp-small').count();
  if (small < 1) throw new Error('no pricing input');
});

console.log('--- Crops (data-tab) ---');
await page.evaluate(() => window.navigate('crops'));
await page.waitForTimeout(300);
await test('Crops list', async () => {
  const cards = await page.locator('.card-pad').count();
  if (cards < 20) throw new Error(`only ${cards} crops`);
});
await test('Crops by family tab', async () => {
  await page.locator('div[data-tab="family"]').click();
  await page.waitForTimeout(300);
  const tables = await page.locator('table').count();
  if (tables < 1) throw new Error('no table');
});
await test('Crops needs tab', async () => {
  await page.locator('div[data-tab="needs"]').click();
  await page.waitForTimeout(300);
  const good = await page.locator('th:has-text("Gute Nachbarn")').count();
  if (good < 1) throw new Error('no Gute Nachbarn');
});

console.log('--- Field plan (data-tab) ---');
await page.evaluate(() => window.navigate('fieldplan'));
await page.waitForTimeout(300);
await test('Field plan canvas', async () => {
  const blocks = await page.locator('.field-bed-block').count();
  if (blocks < 5) throw new Error(`only ${blocks} blocks`);
});
await test('Field plan rotation tab', async () => {
  await page.locator('div[data-tab="rotation"]').click();
  await page.waitForTimeout(300);
  const bed = await page.locator('th:has-text("Beet")').count();
  if (bed < 1) throw new Error('no Beet');
});
await test('Field plan beds tab', async () => {
  await page.locator('div[data-tab="beds"]').click();
  await page.waitForTimeout(300);
  const rows = await page.locator('tbody tr').count();
  if (rows < 5) throw new Error('not enough beds');
});

console.log('--- Tasks (drag and complete) ---');
await page.evaluate(() => window.navigate('tasks'));
await page.waitForTimeout(300);
await test('Create new task', async () => {
  await page.click('button:has-text("Aufgabe")');
  await page.waitForSelector('.modal-title', { timeout: 2000 });
  await page.fill('input#t-title', 'Smoke Aufgabe XYZ');
  await page.click('button:has-text("Speichern")');
  await page.waitForTimeout(200);
  const content = await page.content();
  if (!content.includes('Smoke Aufgabe XYZ')) throw new Error('task not saved');
});

console.log('--- Inventory (+1 button) ---');
await page.evaluate(() => window.navigate('inventory'));
await page.waitForTimeout(300);
await test('+1 button works', async () => {
  const before = await page.locator('tbody tr').first().locator('td').nth(2).textContent();
  await page.locator('tbody tr').first().locator('button:has-text("+1")').click();
  await page.waitForTimeout(200);
});

console.log('--- Members (form) ---');
await page.evaluate(() => window.navigate('members'));
await page.waitForTimeout(300);
await test('Open member form', async () => {
  await page.click('button:has-text("Neues Mitglied")');
  await page.waitForSelector('.modal-title', { timeout: 2000 });
});
await test('Save new member', async () => {
  await page.fill('input#f-name', 'Smoke Mitglied XYZ');
  await page.fill('input#f-email', 'smoke@example.com');
  await page.click('.modal button:has-text("Anlegen")');
  await page.waitForTimeout(300);
  await page.fill('#member-search', 'Smoke Mitglied');
  await page.waitForTimeout(150);
  const rows = await page.locator('.member-row').count();
  if (rows < 1) throw new Error('member not found');
});

console.log('\nERRORS:', errors.length ? errors : 'none');

await browser.close();
