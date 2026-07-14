// Harvest page
import { h, clear } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore, findCrop, findBed, CROP_PALETTE, fmtDate, HARVEST_QUALITY_TONE } from './utils';
import { fmtNum } from '../lib/format';
import { pageH } from '../components/ui/page-h';
import { tabs, Tab } from '../components/ui/tabs';
import { openModal } from '../components/ui/modal';
import { toast } from '../components/ui/toast';
import { badge } from '../components/ui/badge';
import { emptyState } from '../components/ui/empty-state';
import { uid } from '../lib/uid';
import { download } from '../lib/download';
import type { Harvest } from '../types';

let currentTab: 'log' | 'by-crop' | 'by-week' = 'log';

export function render(root: HTMLElement): void {
  clear(root);
  const total = stateStore.state.harvest.reduce((a, h) => a + h.amount, 0);
  root.appendChild(pageH({
    title: 'Ernteerfassung',
    desc: `Saison ${stateStore.state.meta.season} · ${total.toFixed(1)} kg geerntet · ${stateStore.state.harvest.length} Buchungen`,
    actions: `<button class="btn" id="harv-export">${icon('download')} CSV</button>
               <button class="btn btn-primary" id="harv-new">${icon('plus')} Ernte buchen</button>`,
  }));
  const tabsEl = tabs([
    { id: 'log', label: 'Erfassung' },
    { id: 'by-crop', label: 'Nach Kultur' },
    { id: 'by-week', label: 'Nach Woche' },
  ] as Tab[], currentTab, t => { currentTab = t as typeof currentTab; render(root); });
  root.appendChild(tabsEl);
  const body = h('<div id="harv-body"></div>');
  root.appendChild(body);
  if (currentTab === 'log') harvLog(body);
  if (currentTab === 'by-crop') harvByCrop(body);
  if (currentTab === 'by-week') harvByWeek(body);
  root.querySelector('#harv-export')!.addEventListener('click', exportHarvestCSV);
  root.querySelector('#harv-new')!.addEventListener('click', () => openHarvestForm());
}

function harvLog(body: HTMLElement) {
  if (!stateStore.state.harvest.length) {
    body.appendChild(emptyState('Noch keine Ernte gebucht', 'Trage die erste Ernte ein.', 'basket'));
    return;
  }
  const sorted = stateStore.state.harvest.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  body.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Datum</th><th>Kultur</th><th>Beet</th><th class="text-right">Menge</th><th>Einheit</th><th>Qualität</th><th>Empfänger</th><th>Notiz</th><th></th></tr></thead>
        <tbody>
          ${sorted.map(h => {
            const c = findCrop(h.crop);
            const b = findBed(h.bed);
            return `<tr>
              <td>${fmtDate(h.date)}</td>
              <td><span class="badge" style="background:${CROP_PALETTE[c?.name || ''] || '#888'};color:#fff">${c?.name || '?'}</span></td>
              <td>${b?.name || '—'}</td>
              <td class="table-num"><b>${fmtNum(h.amount)}</b></td>
              <td>${h.unit || 'kg'}</td>
              <td>${badge(h.quality, HARVEST_QUALITY_TONE[h.quality])}</td>
              <td>${h.destination || '—'}</td>
              <td class="text-sm text-soft">${h.note || ''}</td>
              <td><button class="btn btn-sm btn-danger" data-del="${h.id}">${icon('x')}</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach(b => b.addEventListener('click', () => deleteHarvest(b.dataset.del!)));
}

function harvByCrop(body: HTMLElement) {
  const totals: Record<string, number> = {};
  stateStore.state.harvest.forEach(h => {
    const c = findCrop(h.crop);
    if (!c) return;
    totals[c.name] = (totals[c.name] || 0) + h.amount;
  });
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = Math.max(...sorted.map(s => s[1]), 1);
  body.innerHTML = `
    <div class="grid" style="grid-template-columns: 1fr 1fr; gap: 16px;">
      <div class="card card-pad">
        <div class="card-title mb-3">Erntemengen nach Kultur</div>
        ${sorted.length ? sorted.map(([name, amount]) => `<div class="row gap-2 mb-2">
          <div style="width:140px;font-size:12px">${name}</div>
          <div class="grow"><div class="progress"><div class="progress-bar" style="width:${amount / max * 100}%;background:${CROP_PALETTE[name] || 'var(--primary)'}"></div></div></div>
          <div class="text-mono text-sm" style="min-width:70px;text-align:right">${fmtNum(amount)} kg</div>
        </div>`).join('') : '<div class="text-soft">Keine Daten</div>'}
      </div>
      <div class="card card-pad">
        <div class="card-title mb-3">Verteilung</div>
        <canvas id="harv-pie" style="height:300px"></canvas>
      </div>
    </div>
  `;
  if (sorted.length) {
    import('../components/charts/donut').then(({ drawDonut }) => {
      const c = body.querySelector('#harv-pie') as HTMLCanvasElement;
      if (c) drawDonut(c, sorted.slice(0, 8).map(([name, v]) => ({ label: name, value: v, color: CROP_PALETTE[name] || '#888' })));
    });
  }
}

function harvByWeek(body: HTMLElement) {
  const start = new Date(2026, 2, 15);
  const weeks: Array<{ amount: number }> = [];
  for (let i = 0; i < 40; i++) weeks.push({ amount: 0 });
  stateStore.state.harvest.forEach(h => {
    const idx = Math.floor((new Date(h.date).getTime() - start.getTime()) / (7 * 86_400_000));
    if (idx >= 0 && idx < weeks.length) weeks[idx].amount += h.amount;
  });
  const max = Math.max(...weeks.map(w => w.amount), 1);
  body.innerHTML = `
    <div class="card card-pad">
      <div class="card-title mb-3">Wöchentliche Erntemenge</div>
      <div class="row" style="align-items:flex-end;gap:2px;height:200px">
        ${weeks.map(w => `<div style="flex:1;background:${w.amount > 0 ? 'var(--primary)' : 'var(--line)'};height:${w.amount / max * 100 || 2}%;min-height:2px" title="KW ${Math.floor((w.amount || 0) / 100) + 10}: ${fmtNum(w.amount)} kg"></div>`).join('')}
      </div>
      <div class="row gap-3 mt-2 text-xs text-soft">
        <span>KW 11</span>
        <div class="grow"></div>
        <span>KW 50</span>
      </div>
    </div>
  `;
}

function deleteHarvest(id: string) {
  stateStore.update(s => { s.harvest = s.harvest.filter(h => h.id !== id); });
  toast('Ernte gelöscht');
  document.dispatchEvent(new CustomEvent('solawios:refresh'));
}

export function openHarvestForm(): void {
  const body = h(`
    <div class="form-grid">
      <div class="form-row"><label>Datum *</label><input id="h-date" type="date" value="${new Date().toISOString().slice(0,10)}"/></div>
      <div class="form-row"><label>Kultur *</label>
        <select id="h-crop">${stateStore.state.crops.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-grid-3">
      <div class="form-row"><label>Menge *</label><input id="h-amount" type="number" step="0.1"/></div>
      <div class="form-row"><label>Einheit</label>
        <select id="h-unit">
          <option value="kg">kg</option>
          <option value="g">g</option>
          <option value="Stück">Stück</option>
          <option value="Bund">Bund</option>
          <option value="Kiste">Kiste</option>
        </select>
      </div>
      <div class="form-row"><label>Qualität</label>
        <select id="h-quality">
          <option value="A">A (Premium)</option>
          <option value="B">B (Standard)</option>
          <option value="C">C (Verarbeitung)</option>
        </select>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Beet</label>
        <select id="h-bed"><option value="">—</option>${stateStore.state.beds.map(b => `<option value="${b.id}">${b.name}</option>`).join('')}</select>
      </div>
      <div class="form-row"><label>Empfänger</label>
        <select id="h-dest">
          <option value="Verteilung">Verteilung Mitglieder</option>
          <option value="Hofladen">Hofladen</option>
          <option value="Verarbeitung">Verarbeitung</option>
          <option value="Lager">Lager</option>
          <option value="Kompost">Kompost</option>
        </select>
      </div>
    </div>
    <div class="form-row"><label>Notiz</label><textarea id="h-note" rows="2"></textarea></div>
  `);
  const m = openModal({ title: 'Ernte buchen', body, wide: true, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>Buchen</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    const data: Partial<Harvest> = {
      date: (body.querySelector('#h-date') as HTMLInputElement).value,
      crop: (body.querySelector('#h-crop') as HTMLSelectElement).value,
      amount: Number((body.querySelector('#h-amount') as HTMLInputElement).value) || 0,
      unit: (body.querySelector('#h-unit') as HTMLSelectElement).value,
      quality: (body.querySelector('#h-quality') as HTMLSelectElement).value as Harvest['quality'],
      bed: (body.querySelector('#h-bed') as HTMLSelectElement).value || null,
      destination: (body.querySelector('#h-dest') as HTMLSelectElement).value as Harvest['destination'],
      note: (body.querySelector('#h-note') as HTMLTextAreaElement).value,
    };
    if (!data.date || !data.amount) { toast('Datum und Menge erforderlich', { kind: 'error' }); return; }
    stateStore.update(s => { s.harvest.push({ id: uid('h'), ...data } as Harvest); });
    m.close();
    toast(`${fmtNum(data.amount)} ${data.unit} gebucht`, { kind: 'success' });
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  });
}

export function exportHarvestCSV(): void {
  const rows: string[][] = [['Datum','Kultur','Beet','Menge','Einheit','Qualität','Empfänger','Notiz']];
  stateStore.state.harvest.forEach(h => {
    const c = findCrop(h.crop);
    const b = findBed(h.bed);
    rows.push([h.date, c?.name || '', b?.name || '', String(h.amount), h.unit, h.quality, h.destination, h.note || '']);
  });
  download('ernte.csv', rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
}
