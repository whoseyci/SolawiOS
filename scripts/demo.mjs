#!/usr/bin/env node
/**
 * Solawi OS — demo.
 *
 * Boots an in-memory instance, creates a farm modelled on crowd salat, and walks
 * through the parts that are hard to believe until you see them run.
 * Touches no files and needs no accounts.
 */

import { createNodePlatform } from '@solawi/platform-node';
import { Kernel } from '@solawi/kernel';
import { buildTranslator, ALL_MODULES } from '@solawi/app';
import { createField, createBedGrid, listBeds, addPerennial } from '@solawi/module-land';
import { createCrop, createPlanting, plantingsOn, checkRotation } from '@solawi/module-cultivation';
import { createShareType, createHousehold, addShare, shareEquivalents, neighbourCount } from '@solawi/module-members';
import { createRound, openRound, placeBid, barState, roundResult, closeRound } from '@solawi/module-bidding';
import { record, rhythm } from '@solawi/module-observations';
import { createTask, suggestSequence } from '@solawi/module-tasks';
import { skipFounding, milestones } from '@solawi/module-founding';

const B = '\x1b[1m', G = '\x1b[32m', Y = '\x1b[33m', D = '\x1b[2m', O = '\x1b[0m';
const h = (s) => console.log(`\n${B}${s}${O}\n${'─'.repeat(s.length)}`);
const li = (s) => console.log(`  ${s}`);
const silent = { debug() {}, info() {}, warn() {}, error() {} };

const platform = createNodePlatform({ databasePath: ':memory:' });
const kernel = new Kernel(platform, silent, buildTranslator());
kernel.use(...ALL_MODULES);
for (const [cap, empty] of [
  ['locations.list', []], ['shares.count', 0], ['shares.equivalents', 0],
  ['budget.target', 0], ['plantings.active', []], ['founding.progress', null],
  ['observations.rhythm', null],
]) kernel.registry.declareEmpty(cap, empty);
await kernel.migrate();

console.log(`${B}Solawi OS — Demo${O}\n${D}In-memory instance, nothing written to disk.${O}`);

// ───────────────────────────────────────────── established farm skips founding
h('1. An established Solawi signs up');
const org = await kernel.createOrg({ slug: 'crowdsalat', name: 'solawi crowd salat', phase: 'operating' });
for (const m of ['land', 'cultivation', 'tasks', 'members', 'bidding', 'observations']) {
  await kernel.setModuleEnabled(org.id, m, true);
}
const fCtx = kernel.contextFor(org.id, 'founding');
await skipFounding(fCtx, 'established_farm');
const ms = await milestones(fCtx);
li(`${G}✓${O} Founding skipped: ${ms.length} milestones marked "not_applicable"`);
li(`${D}  Not "done" — they were never worked through here, and faking it would${O}`);
li(`${D}  poison the duration statistics shared with founding Solawis.${O}`);
li(`${G}✓${O} Phase: ${org.phase}, modules enabled: 6`);

// ───────────────────────────────────────────────────────────────── the field
h('2. The Acker');
const landCtx = kernel.contextFor(org.id, 'land');
const field = await createField(landCtx, { name: 'Hauptacker', areaSqm: 20000 });
await createBedGrid(landCtx, { fieldId: field.id, count: 24, lengthM: 30, widthM: 0.75 });
await addPerennial(landCtx, {
  species: 'Corylus avellana', plantedOn: '2024-11-23', fieldId: field.id,
  expectedYears: 40, note: 'Agroforst-Heckenstreifen',
});
const beds = await listBeds(landCtx);
li(`${G}✓${O} ${beds.length} Beete à 30 × 0,75 m auf 2 ha`);
li(`${G}✓${O} Agroforst-Hecke gepflanzt (Standzeit 40 Jahre — mehrjährig, kein Gemüsesatz)`);

// ─────────────────────────────────────────── cultivation + rotation guard
h('3. Anbauplanung mit Fruchtfolge-Wächter');
const cCtx = kernel.contextFor(org.id, 'cultivation');
const kale = await createCrop(cCtx, {
  botanicalName: 'Brassica oleracea sabellica', family: 'Brassicaceae',
  displayName: 'Grünkohl', synonyms: ['Braunkohl', 'Krauskohl'],
  daysToHarvest: 110, rotationYears: 4,
});
await createPlanting(cCtx, { cropId: kale.id, bedId: beds[0].id, plantedOn: '2025-05-15' });
const warn = await checkRotation(cCtx, { bedId: beds[0].id, cropId: kale.id, plannedDate: '2026-05-15' });
li(`${Y}⚠${O}  ${warn.reason.slice(0, 96)}…`);
li(`${D}   Es warnt — es blockiert nicht. Wer einen Grund hat, pflanzt trotzdem.${O}`);
const onDay = await plantingsOn(cCtx, '2025-09-20');
li(`${G}✓${O} Zeitachse am 20.09.2025: ${onDay.length} Satz, Zustand "${onDay[0]?.phase}"`);

// ────────────────────────────────────────────── members and share weights
h('4. 87 Anteile — und warum Gewichte zählen');
const mCtx = kernel.contextFor(org.id, 'members');
const big = await createShareType(mCtx, { name: 'Großer Anteil', weight: 1.0 });
const small = await createShareType(mCtx, { name: 'Kleiner Anteil', weight: 0.5 });
const households = [];
for (let i = 0; i < 87; i++) {
  const hh = await createHousehold(mCtx, {
    name: `Haushalt ${i + 1}`, discoverable: true,
    lat: 50.11 + (i % 12) * 0.004, lon: 8.68 + Math.floor(i / 12) * 0.004,
  });
  await addShare(mCtx, { householdId: hh.id, shareTypeId: i < 58 ? big : small, season: '2026' });
  households.push(hh);
}
const equivalents = await shareEquivalents(mCtx, '2026');
li(`${G}✓${O} 87 Haushalte: 58 große + 29 kleine = ${B}${equivalents} Anteilsäquivalente${O}`);
li(`${D}   Durch 87 zu teilen wäre sinnlos — deshalb Gewichte.${O}`);

const nb = await neighbourCount(mCtx, households[0].id, 2);
li(`${G}✓${O} Nachbarschaft: ${nb.display} Haushalte im Umkreis von 2 km`);
li(`${D}   Nur die Zahl. Keine Karte, keine Namen, keine Koordinaten verlassen den Server.${O}`);

// ─────────────────────────────────────────────────────── the Bieterrunde
h('5. Bieterrunde — der Balken, der nichts verrät');
const bCtx = kernel.contextFor(org.id, 'bidding');
const round = await createRound(bCtx, {
  season: '2026', targetCents: 10_800_000, shareEquivalents: equivalents,
  displayMode: 'live_bar', batchSize: 5, histogram: true,
});
await openRound(bCtx, round.id);
li(`Jahresbedarf 108.000 € ÷ ${equivalents} = ${B}Richtwert ${(round.target_cents / round.share_equivalents / 100).toFixed(2)} €${O} pro großem Anteil`);
console.log();

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let i = 0; i < 87; i++) {
  const w = i < 58 ? 1.0 : 0.5;
  await placeBid(bCtx, {
    roundId: round.id, householdId: households[i].id, shareWeight: w,
    amountCents: Math.round(1489 * 100 * w * (0.75 + rnd() * 0.55)),
  });
  if ([3, 14, 39, 86].includes(i)) {
    const bar = await barState(bCtx, round.id);
    li(`nach ${String(i + 1).padStart(2)} Geboten → ${bar.phase.padEnd(10)} Position: ${String(bar.position).padEnd(6)} ${D}(${bar.participationHint})${O}`);
  }
}

console.log();
li(`${B}Angriffsversuch: Differenzbildung${O}`);
const before = await barState(bCtx, round.id);
await placeBid(bCtx, { roundId: round.id, householdId: 'spion', amountCents: 999_900, shareWeight: 1.0 });
const after = await barState(bCtx, round.id);
li(`  Balken vor 9.999-€-Gebot: ${before.position}   danach: ${after.position}`);
li(`  ${before.position === after.position ? `${G}✓ unverändert — das Gebot ist nicht rekonstruierbar${O}` : `${Y}⚠ bewegt!${O}`}`);

await closeRound(bCtx, round.id);
const res = await roundResult(bCtx, round.id);
console.log();
li(`${B}Finanzsicht${O} ${D}(rollengebunden, jeder Zugriff protokolliert)${O}`);
li(`  ${res.bidCount} Gebote · ${(res.totalCents / 100).toLocaleString('de-DE')} € von ${(res.targetCents / 100).toLocaleString('de-DE')} € · gedeckt: ${res.covered ? `${G}ja${O}` : 'nein'} (${(res.coverageRatio * 100).toFixed(1)} %)`);

// ────────────────────────────────────────────── observations without people
h('6. Betriebsdaten — ohne Personentracking');
const oCtx = kernel.contextFor(org.id, 'observations');
for (const d of ['2026-06-01', '2026-06-11', '2026-06-22', '2026-07-03']) {
  await record(oCtx, { bedId: beds[0].id, activity: 'weeding', observedAt: `${d}T08:00:00Z`, minutes: 35 });
}
const r = await rhythm(oCtx, beds[0].id, 'weeding');
li(`${G}✓${O} Beet 1 wird etwa alle ${B}${r.meanIntervalDays} Tage${O} gejätet (± ${r.stdDevDays} Tage)`);
const cols = await oCtx.store.all('PRAGMA table_info(observation)');
li(`${G}✓${O} Spalten: ${cols.map((c) => c.name).join(', ')}`);
li(`   ${G}Keine Personenspalte.${O} ${D}Nicht optional — nicht vorhanden.${O}`);

// ───────────────────────────────────────────────── sequencing assistant
h('7. Reihenfolge-Assistent');
const tCtx = kernel.contextFor(org.id, 'tasks');
await createTask(tCtx, { title: 'Beet 2 bepflanzen', activity: 'planting', bedId: beds[1].id });
await createTask(tCtx, { title: 'Beet 1 mulchen', activity: 'mulching', bedId: beds[0].id });
await createTask(tCtx, { title: 'Tomaten ernten', activity: 'harvest', bedId: beds[2].id, urgency: 'hard' });
const adjacency = Object.fromEntries(beds.map((b) => [b.id, beds.filter((x) => x.id !== b.id).map((x) => x.id)]));
for (const s of await suggestSequence(tCtx, { adjacency })) {
  li(`${s.order}. ${s.task.title.padEnd(22)} ${D}— ${s.rationale}${O}`);
}
li(`${D}   Vorschlag, keine Zuteilung. Und nie an eine namentliche Person.${O}`);

h('Fertig');
console.log(`  ${G}Alles oben lief gerade wirklich.${O} Kein Mock, keine Attrappe.\n`);
console.log(`  ${D}Echten Server starten:  npm run dev${O}`);
console.log(`  ${D}Auf Cloudflare:         ./scripts/deploy-cf.sh${O}\n`);
