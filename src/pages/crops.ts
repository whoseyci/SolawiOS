// Crops page
import { h, clear, esc } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore, CROP_PALETTE } from './utils';
import { pageH } from '../components/ui/page-h';
import { tabs, Tab } from '../components/ui/tabs';
import { openModal } from '../components/ui/modal';
import { toast } from '../components/ui/toast';
import { emptyState } from '../components/ui/empty-state';
import { uid } from '../lib/uid';
import type { Crop } from '../types';

let currentTab: 'list' | 'family' | 'needs' = 'list';

export function render(root: HTMLElement): void {
  clear(root);
  root.appendChild(pageH({
    title: 'Kulturarten',
    desc: `${stateStore.state.crops.length} Kulturen · ${stateStore.state.plantings.length} aktive Anbauplanungen`,
    actions: `<button class="btn btn-primary" id="crops-new">${icon('plus')} Neue Kultur</button>`,
  }));
  const tabsEl = tabs([
    { id: 'list', label: 'Liste' },
    { id: 'family', label: 'Nach Familie' },
    { id: 'needs', label: 'Ansprüche' },
  ] as Tab[], currentTab, t => { currentTab = t as typeof currentTab; render(root); });
  root.appendChild(tabsEl);
  const body = h('<div id="crop-body"></div>');
  root.appendChild(body);
  if (currentTab === 'list') cropList(body);
  if (currentTab === 'family') cropFamily(body);
  if (currentTab === 'needs') cropNeeds(body);
  root.querySelector('#crops-new')!.addEventListener('click', () => openCropForm());
}

function cropList(body: HTMLElement) {
  if (!stateStore.state.crops.length) {
    body.appendChild(emptyState('Keine Kulturen', 'Lege eine neue Kultur an.', 'plant'));
    return;
  }
  const grid = h('<div class="grid grid-3"></div>');
  stateStore.state.crops.forEach(c => {
    const card = h(`
      <div class="card card-pad" style="cursor:pointer" data-id="${c.id}">
        <div class="row gap-2 mb-2">
          <div style="width:32px;height:32px;border-radius:6px;background:${CROP_PALETTE[c.name] || '#888'}"></div>
          <div class="grow">
            <div style="font-weight:600"></div>
            <div class="text-sm text-soft"></div>
          </div>
        </div>
        <div class="text-sm text-soft"></div>
        <div class="row gap-2 mt-2 text-xs"></div>
      </div>
    `) as HTMLElement;
    (card.querySelector('div[style*="font-weight:600"]') as HTMLElement).textContent = c.name;
    (card.querySelector('div.text-sm.text-soft') as HTMLElement).textContent = c.family || '';
    (card.querySelectorAll('div.text-sm.text-soft')[1] as HTMLElement).textContent = c.variety || '—';
    const tags = card.querySelector('.row.gap-2.mt-2') as HTMLElement;
    tags.innerHTML = `
      <span class="badge badge-neutral">${c.days || '?'} Tage</span>
      <span class="badge badge-neutral">${c.cycle || '—'}</span>
      <span class="badge badge-${c.planting === 'Direktsaat' ? 'info' : c.planting === 'Vorkultur' ? 'primary' : 'accent'}">${c.planting || '—'}</span>
    `;
    card.addEventListener('click', () => openCropForm(c.id));
    grid.appendChild(card);
  });
  body.appendChild(grid);
}

function cropFamily(body: HTMLElement) {
  const groups: Record<string, Crop[]> = {};
  stateStore.state.crops.forEach(c => { (groups[c.family || 'Sonstige'] ||= []).push(c); });
  body.innerHTML = Object.entries(groups).map(([fam, items]) => `
    <div class="card mb-3">
      <div class="card-h"><div class="card-title">${esc(fam)} (${items.length})</div></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Kultur</th><th>Sorte</th><th>Familie</th><th>Tage</th><th>Anbauform</th></tr></thead>
          <tbody>${items.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.variety || '—')}</td><td>${esc(c.family || '—')}</td><td class="text-mono">${c.days || '—'}</td><td>${c.planting || '—'}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </div>
  `).join('');
}

function cropNeeds(body: HTMLElement) {
  body.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Kultur</th><th>Licht</th><th>Wasser</th><th>Boden</th><th>Nährstoff</th><th>Gute Nachbarn</th><th>Schlechte Nachbarn</th></tr></thead>
        <tbody>
          ${stateStore.state.crops.map(c => `<tr>
            <td><b>${esc(c.name)}</b></td>
            <td>${c.light || '—'}</td>
            <td>${c.water || '—'}</td>
            <td>${c.soil || '—'}</td>
            <td>${c.nutrition || '—'}</td>
            <td>${(c.companions || []).join(', ') || '—'}</td>
            <td>${(c.antagonists || []).join(', ') || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function openCropForm(id: string | null = null): void {
  const c = id ? stateStore.state.crops.find(x => x.id === id) || null : null;
  const body = h(`
    <div class="form-grid">
      <div class="form-row"><label>Name *</label><input id="cr-name"/></div>
      <div class="form-row"><label>Sorte</label><input id="cr-variety"/></div>
    </div>
    <div class="form-grid-3">
      <div class="form-row"><label>Pflanzenfamilie</label><input id="cr-family"/></div>
      <div class="form-row"><label>Kulturdauer (Tage)</label><input id="cr-days" type="number"/></div>
      <div class="form-row"><label>Zyklus</label>
        <select id="cr-cycle">
          <option value="einjährig">einjährig</option>
          <option value="zweijährig">zweijährig</option>
          <option value="mehrjährig">mehrjährig</option>
        </select>
      </div>
    </div>
    <div class="form-grid-3">
      <div class="form-row"><label>Anbauform</label>
        <select id="cr-planting">
          <option value="Direktsaat">Direktsaat</option>
          <option value="Vorkultur">Vorkultur</option>
          <option value="Pflanzung">Pflanzung</option>
        </select>
      </div>
      <div class="form-row"><label>Lichtbedarf</label>
        <select id="cr-light">
          <option value="sonnig">sonnig</option>
          <option value="halbschattig">halbschattig</option>
          <option value="schattig">schattig</option>
        </select>
      </div>
      <div class="form-row"><label>Wasserbedarf</label>
        <select id="cr-water">
          <option value="niedrig">niedrig</option>
          <option value="mittel">mittel</option>
          <option value="hoch">hoch</option>
        </select>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Boden</label><input id="cr-soil" value="locker, humos, gut durchlüftet"/></div>
      <div class="form-row"><label>Nährstoffbedarf</label>
        <select id="cr-nutrition">
          <option value="Schwachzehrer">Schwachzehrer</option>
          <option value="Mittelzehrer">Mittelzehrer</option>
          <option value="Starkzehrer">Starkzehrer</option>
        </select>
      </div>
    </div>
    <div class="form-row"><label>Gute Nachbarn (Komma-getrennt)</label><input id="cr-comp"/></div>
    <div class="form-row"><label>Schlechte Nachbarn (Komma-getrennt)</label><input id="cr-ant"/></div>
  `);
  if (c) {
    (body.querySelector('#cr-name') as HTMLInputElement).value = c.name;
    (body.querySelector('#cr-variety') as HTMLInputElement).value = c.variety || '';
    (body.querySelector('#cr-family') as HTMLInputElement).value = c.family || '';
    (body.querySelector('#cr-days') as HTMLInputElement).value = String(c.days || '');
    (body.querySelector('#cr-cycle') as HTMLSelectElement).value = c.cycle || 'einjährig';
    (body.querySelector('#cr-planting') as HTMLSelectElement).value = c.planting || 'Direktsaat';
    (body.querySelector('#cr-light') as HTMLSelectElement).value = c.light || 'sonnig';
    (body.querySelector('#cr-water') as HTMLSelectElement).value = c.water || 'mittel';
    (body.querySelector('#cr-soil') as HTMLInputElement).value = c.soil || '';
    (body.querySelector('#cr-nutrition') as HTMLSelectElement).value = c.nutrition || 'Mittelzehrer';
    (body.querySelector('#cr-comp') as HTMLInputElement).value = (c.companions || []).join(', ');
    (body.querySelector('#cr-ant') as HTMLInputElement).value = (c.antagonists || []).join(', ');
  }
  const m = openModal({ title: c ? 'Kultur bearbeiten' : 'Neue Kultur', body, wide: true, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>Speichern</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    const data: Partial<Crop> = {
      name: (body.querySelector('#cr-name') as HTMLInputElement).value.trim(),
      variety: (body.querySelector('#cr-variety') as HTMLInputElement).value,
      family: (body.querySelector('#cr-family') as HTMLInputElement).value,
      days: Number((body.querySelector('#cr-days') as HTMLInputElement).value) || null,
      cycle: (body.querySelector('#cr-cycle') as HTMLSelectElement).value as Crop['cycle'],
      planting: (body.querySelector('#cr-planting') as HTMLSelectElement).value as Crop['planting'],
      light: (body.querySelector('#cr-light') as HTMLSelectElement).value as Crop['light'],
      water: (body.querySelector('#cr-water') as HTMLSelectElement).value as Crop['water'],
      soil: (body.querySelector('#cr-soil') as HTMLInputElement).value,
      nutrition: (body.querySelector('#cr-nutrition') as HTMLSelectElement).value as Crop['nutrition'],
      companions: (body.querySelector('#cr-comp') as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean),
      antagonists: (body.querySelector('#cr-ant') as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean),
    };
    if (!data.name) { toast('Name erforderlich', { kind: 'error' }); return; }
    if (c) {
      stateStore.update(() => { Object.assign(c, data); });
    } else {
      stateStore.update(s => { s.crops.push({ id: uid('c'), ...data } as Crop); });
    }
    m.close();
    toast('Kultur gespeichert', { kind: 'success' });
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  });
}
