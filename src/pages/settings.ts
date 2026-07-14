// Settings page
import { h, clear, esc } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore } from './utils';
import { pageH } from '../components/ui/page-h';
import { tabs, Tab } from '../components/ui/tabs';
import { toast } from '../components/ui/toast';
import { confirmDialog } from '../components/ui/modal';
import type { State } from '../types';

let currentTab: 'farm' | 'season' | 'data' | 'about' = 'farm';

export function render(root: HTMLElement): void {
  clear(root);
  root.appendChild(pageH({
    title: 'Stammdaten',
    desc: 'Hof, Saison, Konfiguration',
  }));
  const tabsEl = tabs([
    { id: 'farm', label: 'Hof' },
    { id: 'season', label: 'Saison' },
    { id: 'data', label: 'Daten' },
    { id: 'about', label: 'Über' },
  ] as Tab[], currentTab, t => { currentTab = t as typeof currentTab; render(root); });
  root.appendChild(tabsEl);
  const body = h('<div id="set-body"></div>');
  root.appendChild(body);
  if (currentTab === 'farm') settingsFarm(body);
  if (currentTab === 'season') settingsSeason(body);
  if (currentTab === 'data') settingsData(body);
  if (currentTab === 'about') settingsAbout(body);
}

function settingsFarm(body: HTMLElement) {
  const m = stateStore.state.meta;
  body.innerHTML = `
    <div class="card card-pad" style="max-width:680px">
      <div class="form-grid">
        <div class="form-row"><label>Name des Hofs</label><input id="set-name" value="${esc(m.farm.name)}"/></div>
        <div class="form-row"><label>Gegründet</label><input id="set-since" type="number" value="${m.farm.since}"/></div>
      </div>
      <div class="form-grid-3">
        <div class="form-row"><label>Fläche (ha)</label><input id="set-ha" type="number" step="0.1" value="${m.farm.hectares}"/></div>
        <div class="form-row"><label>Mitgliederziel</label><input id="set-mem" type="number" value="${m.farm.members_target}"/></div>
        <div class="form-row"><label>Währung</label>
          <select id="set-cur">
            <option ${m.currency === 'EUR' ? 'selected' : ''}>EUR</option>
            <option ${m.currency === 'CHF' ? 'selected' : ''}>CHF</option>
            <option ${m.currency === 'USD' ? 'selected' : ''}>USD</option>
          </select>
        </div>
      </div>
      <button class="btn btn-primary" id="set-save">${icon('floppy-disk')} Speichern</button>
    </div>
  `;
  body.querySelector('#set-save')!.addEventListener('click', () => {
    stateStore.update(s => {
      s.meta.farm.name = (body.querySelector('#set-name') as HTMLInputElement).value;
      s.meta.farm.since = Number((body.querySelector('#set-since') as HTMLInputElement).value);
      s.meta.farm.hectares = Number((body.querySelector('#set-ha') as HTMLInputElement).value);
      s.meta.farm.members_target = Number((body.querySelector('#set-mem') as HTMLInputElement).value);
      s.meta.currency = (body.querySelector('#set-cur') as HTMLSelectElement).value as State['meta']['currency'];
    });
    toast('Stammdaten gespeichert', { kind: 'success' });
  });
}

function settingsSeason(body: HTMLElement) {
  body.innerHTML = `
    <div class="card card-pad" style="max-width:680px">
      <div class="form-grid">
        <div class="form-row"><label>Saison-Jahr</label><input id="set-year" type="number" value="${stateStore.state.meta.season}"/></div>
        <div class="form-row"><label>Heutiges Datum (Demo)</label><input id="set-today" type="date" value="${new Date().toISOString().slice(0,10)}"/></div>
      </div>
      <button class="btn btn-primary" id="set-save">${icon('floppy-disk')} Speichern</button>
    </div>
  `;
  body.querySelector('#set-save')!.addEventListener('click', () => {
    stateStore.update(s => { s.meta.season = Number((body.querySelector('#set-year') as HTMLInputElement).value); });
    toast('Saison aktualisiert', { kind: 'success' });
  });
}

function settingsData(body: HTMLElement) {
  const totalSize = JSON.stringify(stateStore.state).length;
  const counts = Object.entries(stateStore.state).filter(([k]) => Array.isArray(stateStore.state[k as keyof State])).map(([k, v]) => `${k}: ${(v as unknown[]).length}`).join(' · ');
  body.innerHTML = `
    <div class="card card-pad" style="max-width:680px">
      <div class="row gap-2 mb-3">
        <div class="stat-label">Datensätze</div>
        <div class="text-mono">${counts}</div>
      </div>
      <div class="row gap-2 mb-3">
        <div class="stat-label">Speicher</div>
        <div class="text-mono">${(totalSize / 1024).toFixed(1)} KB</div>
      </div>
      <div class="divider"></div>
      <div class="card-title mb-2">Schnellaktionen</div>
      <div class="row gap-2 wrap">
        <button class="btn" id="data-backup">${icon('download')} Backup (JSON)</button>
        <label class="btn"><input type="file" id="data-import" accept=".json" style="display:none"/>${icon('upload')} Wiederherstellen</label>
        <button class="btn btn-danger" id="data-reset">${icon('trash')} Alle Daten löschen</button>
      </div>
      <div class="divider"></div>
      <div class="text-sm text-soft">Daten werden lokal im Browser gespeichert (localStorage). Für eine gemeinsame Nutzung mit dem Team empfehlen wir regelmäßige Backups oder den SolawiOS-Server.</div>
    </div>
  `;
  body.querySelector('#data-backup')!.addEventListener('click', exportJSON);
  body.querySelector('#data-import')!.addEventListener('change', e => importJSON(e as Event));
  body.querySelector('#data-reset')!.addEventListener('click', async () => {
    if (await confirmDialog({ message: 'Wirklich alle Daten löschen? Diese Aktion kann nicht rückgängig gemacht werden.', okText: 'Alles löschen', okClass: 'btn-danger' })) {
      stateStore.reset();
      location.reload();
    }
  });
}

function settingsAbout(body: HTMLElement) {
  const m = stateStore.state.meta;
  body.innerHTML = `
    <div class="card card-pad" style="max-width:680px">
      <h2 style="margin-top:0">🌾 SolawiOS</h2>
      <p class="text-soft">Solidarisches landwirtschaftliches Betriebssystem — die open-source Software-Suite für Community Supported Agriculture Höfe.</p>
      <div class="divider"></div>
      <div class="grid grid-2 text-sm">
        <div><b>Version</b></div><div>2.0.0</div>
        <div><b>Hof</b></div><div>${esc(m.farm.name)}</div>
        <div><b>Fläche</b></div><div>${m.farm.hectares} ha</div>
        <div><b>Gegründet</b></div><div>${m.farm.since}</div>
        <div><b>Saison</b></div><div>${m.season}</div>
        <div><b>Module</b></div><div>15</div>
      </div>
      <div class="divider"></div>
      <p class="text-sm text-soft">Built with care for small farms, big communities.</p>
    </div>
  `;
}

import { exportJSON, importJSON } from './reports';
export { exportJSON, importJSON };

export async function resetAllData(): Promise<void> {
  if (await confirmDialog({ message: 'Wirklich alle Daten löschen?', okText: 'Alles löschen', okClass: 'btn-danger' })) {
    stateStore.reset();
    location.reload();
  }
}
