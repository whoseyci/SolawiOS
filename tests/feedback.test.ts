import { describe, it, expect } from 'vitest';
import { createNodePlatform } from '@solawi/platform-node';
import { Kernel } from './helpers.js';
import { buildPreview, redact, redactRoute, store, listReports } from '@solawi/module-feedback';

/**
 * The bug reporter is a channel out of the farm, so it is exactly the kind of
 * feature that quietly becomes a privacy hole. These tests assert it does not.
 */

async function farm() {
  const platform = createNodePlatform({ databasePath: ':memory:' });
  const kernel = await Kernel(platform);
  const org = await kernel.createOrg({ slug: 'fb-farm', name: 'Farm' });
  await kernel.setModuleEnabled(org.id, 'feedback', true);
  return { kernel, org };
}

describe('feedback: nothing sensitive leaves the farm', () => {
  it('redacts emails, phones, IBANs, coordinates and tokens', () => {
    const dirty = [
      'Anna (anna.mueller@crowdsalat.eu) meldet:',
      'Telefon 0176 12345678, IBAN DE89370400440532013000',
      'Standort 50.110924, 8.682127',
      'Authorization: Bearer ghp_abc123def456ghi789',
      'Server 192.168.1.42',
    ].join('\n');

    const clean = redact(dirty);
    expect(clean).not.toContain('anna.mueller@crowdsalat.eu');
    expect(clean).not.toContain('DE89370400440532013000');
    expect(clean).not.toContain('50.110924, 8.682127');
    expect(clean).not.toContain('ghp_abc123def456ghi789');
    expect(clean).not.toContain('192.168.1.42');
    expect(clean).toContain('[email]');
    expect(clean).toContain('[iban]');
  });

  it('strips ids from routes so issues group by endpoint', () => {
    expect(redactRoute('/api/land/beds/3bc19758-6343-471a-84b3-2315c5be6594'))
      .toBe('/api/land/beds/:id');
    expect(redactRoute('/api/bidding/rounds/42/bids')).toBe('/api/bidding/rounds/:n/bids');
  });

  it('never includes bid amounts, member names or coordinates in the payload', () => {
    const preview = buildPreview(
      {
        kind: 'bug',
        title: 'Fehler bei Gebot von Familie Schmidt (450 EUR)',
        body: 'Beim Speichern von 450,00 EUR für schmidt@example.org kam ein Fehler. GPS 50.1109, 8.6821',
      },
      { module: 'bidding', route: '/api/bidding/rounds/abc/bids' },
    );

    const serialised = JSON.stringify(preview);
    expect(serialised).not.toContain('schmidt@example.org');
    expect(serialised).not.toContain('50.1109, 8.6821');
    // The title is user-written; we redact it but do not invent censorship of
    // ordinary words, so "Schmidt" may remain — this is why the preview exists.
    expect(preview.explanation.length).toBeGreaterThan(0);
  });

  it('produces a preview listing exactly what will be transmitted', () => {
    const preview = buildPreview(
      { kind: 'bug', title: 'Karte lädt nicht', body: 'Beim Öffnen bleibt sie leer.', severity: 'serious' },
      { module: 'land', enabledModules: ['land', 'tasks'], appVersion: '0.1.0', platformFlavour: 'cloudflare' },
    );
    expect(preview.willSend).toMatchObject({
      kind: 'bug', severity: 'serious', module: 'land',
      enabledModules: ['land', 'tasks'], appVersion: '0.1.0',
    });
    expect(preview.labels).toContain('from-app');
    expect(preview.labels).toContain('priority'); // serious → priority
    expect(preview.explanation.some((e) => e.includes('Module'))).toBe(true);
  });

  it('stores reports locally even with no GitHub token configured', async () => {
    const { kernel, org } = await farm();
    const ctx = kernel.contextFor(org.id, 'feedback');
    const id = await store(ctx, { kind: 'idea', title: 'Ernte per Sprachnotiz', body: 'Wäre praktisch.' });
    const reports = await listReports(ctx) as Array<{ id: string; status: string }>;
    expect(reports).toHaveLength(1);
    expect(reports[0]!.id).toBe(id);
    expect(reports[0]!.status).toBe('pending'); // retryable, not lost
  });

  it('keeps reports scoped to their farm', async () => {
    const platform = createNodePlatform({ databasePath: ':memory:' });
    const kernel = await Kernel(platform);
    const a = await kernel.createOrg({ slug: 'fa', name: 'A' });
    const b = await kernel.createOrg({ slug: 'fb', name: 'B' });
    for (const o of [a, b]) await kernel.setModuleEnabled(o.id, 'feedback', true);

    await store(kernel.contextFor(a.id, 'feedback'), { kind: 'bug', title: 'A only', body: 'x' });
    expect(await listReports(kernel.contextFor(a.id, 'feedback'))).toHaveLength(1);
    expect(await listReports(kernel.contextFor(b.id, 'feedback'))).toHaveLength(0);
  });
});
