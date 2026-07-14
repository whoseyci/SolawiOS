// Field plan page
import { h, clear, esc } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore, findBed, findCrop } from './utils';
import { CROP_PALETTE } from '../data/seed';
import { pageH } from '../components/ui/page-h';
import { tabs, Tab } from '../components/ui/tabs';
import { openModal, confirmDialog } from '../components/ui/modal';
import { toast } from '../components/ui/toast';
import { uid } from '../lib/uid';
import type { Bed, Planting } from '../types';

let currentTab: 'canvas' | 'rotation' | 'beds' = 'canvas';

export function render(root: HTMLElement): void {
  clear(root);
  const s = stateStore.state;
  const totalArea = s.beds.reduce((a, b) => a + b.area, 0);
  root.appendChild(pageH({
    title: 'Beetplanung',
    desc: `${s.beds.length} Beete · ${totalArea.toFixed(1)} m²`,
    actions: `<button class="btn btn-primary" id="fp-new-bed">${icon('plus')} Neues Beet</button>
               <button class="btn" id="fp-new-plant">${icon('plant')} Bepflanzung planen</button>`,
  }));
  const tabsEl = tabs([
    { id: 'canvas', label: 'Feldansicht' },
    { id: 'rotation', label: 'Fruchtfolge' },
    { id: 'beds', label: 'Beete' },
  ] as Tab[], currentTab, t => { currentTab = t as typeof currentTab; render(root); });
  root.appendChild(tabsEl);
  const body = h('<div id="fp-body"></div>');
  root.appendChild(body);
  if (currentTab === 'canvas') fieldCanvas(body);
  if (currentTab === 'rotation') fieldRotation(body);
  if (currentTab === 'beds') fieldBeds(body);
  root.querySelector('#fp-new-bed')!.addEventListener('click', () => openBedForm());
  root.querySelector('#fp-new-plant')!.addEventListener('click', () => openPlantingForm());
}

function fieldCanvas(body: HTMLElement) {
  const year = stateStore.state.meta.season;
  const grid = h(`<div class="grid" style="grid-template-columns: 220px 1fr; gap: 16px;"></div>`);
  const legend = h('<div class="field-beds"></div>');
  stateStore.state.beds.forEach(b => {
    const p = stateStore.state.plantings.find(x => x.bed === b.id && x.year === year);
    const c = p ? findCrop(p.crop) : null;
    const item = h(`
      <div class="field-bed" data-bed="${b.id}">
        <div class="field-bed-color" style="background:${c ? (CROP_PALETTE[c.name] || '#888') : 'var(--line-strong)'}"></div>
        <div class="grow">
          <div></div>
          <div class="text-xs text-soft"></div>
        </div>
      </div>
    `) as HTMLElement;
    (item.querySelector('div.grow > div') as HTMLElement).textContent = b.name;
    (item.querySelector('div.grow > div.text-xs') as HTMLElement).textContent = `${c ? c.name : 'brach'} · ${b.area} m²`;
    item.addEventListener('click', () => openBedForm(b.id));
    legend.appendChild(item);
  });
  const canvas = h('<div class="field-canvas" id="field-canvas"></div>');
  grid.append(legend, canvas);
  body.appendChild(grid);

  const bedW = 110, bedH = 60, padding = 10;
  canvas.style.minHeight = (Math.ceil(stateStore.state.beds.length / 4) * (bedH + padding) + 20) + 'px';
  stateStore.state.beds.forEach((b, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const left = padding + col * (bedW + padding);
    const top = padding + row * (bedH + padding);
    const p = stateStore.state.plantings.find(x => x.bed === b.id && x.year === year);
    const c = p ? findCrop(p.crop) : null;
    const block = h(`
      <div class="field-bed-block" style="left:${left}px;top:${top}px;width:${bedW}px;height:${bedH}px;background:${c ? (CROP_PALETTE[c.name] || '#888') : 'var(--line-strong)'}">
        <div><b>${esc(b.name)}</b></div>
        <div style="font-size:9px;opacity:.9"></div>
      </div>
    `) as HTMLElement;
    (block.querySelector('div[style*="font-size:9px"]') as HTMLElement).textContent = c ? c.name : 'brach';
    block.addEventListener('click', () => openBedForm(b.id));
    canvas.appendChild(block);
  });
}

function fieldRotation(body: HTMLElement) {
  const years = [stateStore.state.meta.season - 2, stateStore.state.meta.season - 1, stateStore.state.meta.season];
  body.innerHTML = `
    <div class="card card-pad">
      <div class="card-title mb-3">Fruchtfolge über 3 Jahre</div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Beet</th>${years.map(y => `<th>${y}</th>`).join('')}</tr></thead>
          <tbody>
            ${stateStore.state.beds.map(b => `<tr>
              <td><b>${esc(b.name)}</b></td>
              ${years.map(y => {
                const p = stateStore.state.plantings.find(x => x.bed === b.id && x.year === y);
                const c = p ? findCrop(p.crop) : null;
                return `<td>${c ? `<span class="badge" style="background:${CROP_PALETTE[c.name] || '#888'};color:#fff">${esc(c.name)}</span>` : '<span class="text-muted text-sm">—</span>'}</td>`;
              }).join('')}
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function fieldBeds(body: HTMLElement) {
  body.innerHTML = `
    <div class="card">
      <div class="card-h"><div class="card-title">Alle Beete</div></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Name</th><th>Bereich</th><th>Größe</th><th>Boden</th><th>Bepflanzung ${stateStore.state.meta.season}</th><th></th></tr></thead>
          <tbody>
            ${stateStore.state.beds.map(b => {
              const p = stateStore.state.plantings.find(x => x.bed === b.id && x.year === stateStore.state.meta.season);
              const c = p ? findCrop(p.crop) : null;
              return `<tr>
                <td><b>${esc(b.name)}</b></td>
                <td>${esc(b.zone || '—')}</td>
                <td class="text-mono">${b.area} m²</td>
                <td>${esc(b.soil || '—')}</td>
                <td>${c ? `<span class="badge" style="background:${CROP_PALETTE[c.name] || '#888'};color:#fff">${esc(c.name)}</span>` : '—'}</td>
                <td class="text-right">
                  <button class="btn btn-sm" data-edit="${b.id}">${icon('pencil-simple')}</button>
                  <button class="btn btn-sm btn-danger" data-del="${b.id}">${icon('trash')}</button>
                </td>
              </tr>`;
            }).join('') || '<tr><td colspan="6" class="table-empty">Keine Beete</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;
  body.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach(b => b.addEventListener('click', () => openBedForm(b.dataset.edit!)));
  body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (await confirmDialog({ message: 'Beet löschen?', okText: 'Löschen', okClass: 'btn-danger' })) {
      stateStore.update(s => {
        s.beds = s.beds.filter(x => x.id !== b.dataset.del);
        s.plantings = s.plantings.filter(p => p.bed !== b.dataset.del);
      });
      toast('Beet gelöscht', { kind: 'success' });
      document.dispatchEvent(new CustomEvent('solawios:refresh'));
    }
  }));
}

export function openBedForm(id: string | null = null): void {
  const b = id ? findBed(id) : null;
  const body = h(`
    <div class="form-grid">
      <div class="form-row"><label>Name *</label><input id="b-name"/></div>
      <div class="form-row"><label>Bereich / Zone</label><input id="b-zone" value="A"/></div>
    </div>
    <div class="form-grid-3">
      <div class="form-row"><label>Größe (m²)</label><input id="b-area" type="number" step="0.1"/></div>
      <div class="form-row"><label>Länge (m)</label><input id="b-len" type="number" step="0.1"/></div>
      <div class="form-row"><label>Breite (m)</label><input id="b-wid" type="number" step="0.1"/></div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Bodentyp</label>
        <select id="b-soil">
          <option value="lehmig">Lehm</option>
          <option value="sandig">Sand</option>
          <option value="tonig">Ton</option>
          <option value="humos">Humus</option>
          <option value="misch">Mischboden</option>
        </select>
      </div>
      <div class="form-row"><label>Position X (m)</label><input id="b-x" type="number" step="0.1"/></div>
    </div>
    <div class="form-row"><label>Notizen</label><textarea id="b-notes" rows="2"></textarea></div>
  `);
  if (b) {
    (body.querySelector('#b-name') as HTMLInputElement).value = b.name;
    (body.querySelector('#b-zone') as HTMLInputElement).value = b.zone || '';
    (body.querySelector('#b-area') as HTMLInputElement).value = String(b.area);
    (body.querySelector('#b-len') as HTMLInputElement).value = String(b.length);
    (body.querySelector('#b-wid') as HTMLInputElement).value = String(b.width);
    (body.querySelector('#b-soil') as HTMLSelectElement).value = b.soil || 'lehmig';
    (body.querySelector('#b-x') as HTMLInputElement).value = String(b.x);
    (body.querySelector('#b-notes') as HTMLTextAreaElement).value = b.notes || '';
  }
  const m = openModal({ title: b ? 'Beet bearbeiten' : 'Neues Beet', body, wide: true, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>Speichern</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    const data: Partial<Bed> = {
      name: (body.querySelector('#b-name') as HTMLInputElement).value.trim(),
      zone: (body.querySelector('#b-zone') as HTMLInputElement).value,
      area: Number((body.querySelector('#b-area') as HTMLInputElement).value) || 0,
      length: Number((body.querySelector('#b-len') as HTMLInputElement).value) || 0,
      width: Number((body.querySelector('#b-wid') as HTMLInputElement).value) || 0,
      soil: (body.querySelector('#b-soil') as HTMLSelectElement).value as Bed['soil'],
      x: Number((body.querySelector('#b-x') as HTMLInputElement).value) || 0,
      notes: (body.querySelector('#b-notes') as HTMLTextAreaElement).value,
    };
    if (!data.name) { toast('Name erforderlich', { kind: 'error' }); return; }
    if (b) {
      stateStore.update(() => { Object.assign(b, data); });
    } else {
      stateStore.update(s => { s.beds.push({ id: uid('b'), ...data } as Bed); });
    }
    m.close();
    toast('Beet gespeichert', { kind: 'success' });
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  });
}

export function openPlantingForm(): void {
  const year = stateStore.state.meta.season;
  const body = h(`
    <div class="form-grid">
      <div class="form-row"><label>Beet *</label>
        <select id="p-bed">${stateStore.state.beds.map(b => `<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select>
      </div>
      <div class="form-row"><label>Kultur *</label>
        <select id="p-crop">${stateStore.state.crops.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-grid-3">
      <div class="form-row"><label>Saat-/Pflanztermin</label><input id="p-sow" type="date"/></div>
      <div class="form-row"><label>Erwartete Ernte ab</label><input id="p-harvest" type="date"/></div>
      <div class="form-row"><label>Erwarteter Ertrag (kg)</label><input id="p-yield" type="number" step="0.1"/></div>
    </div>
    <div class="form-row"><label>Notizen</label><textarea id="p-notes" rows="2"></textarea></div>
  `);
  const m = openModal({ title: `Bepflanzung planen (${year})`, body, wide: true, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>Speichern</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    const data: Partial<Planting> = {
      bed: (body.querySelector('#p-bed') as HTMLSelectElement).value,
      crop: (body.querySelector('#p-crop') as HTMLSelectElement).value,
      year,
      sowDate: (body.querySelector('#p-sow') as HTMLInputElement).value || null,
      expectedHarvest: (body.querySelector('#p-harvest') as HTMLInputElement).value || null,
      expectedYield: Number((body.querySelector('#p-yield') as HTMLInputElement).value) || 0,
      notes: (body.querySelector('#p-notes') as HTMLTextAreaElement).value,
    };
    stateStore.update(s => {
      s.plantings = s.plantings.filter(p => !(p.bed === data.bed && p.year === year));
      s.plantings.push({ id: uid('p'), ...data } as Planting);
    });
    m.close();
    toast('Bepflanzung gespeichert', { kind: 'success' });
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  });
}
