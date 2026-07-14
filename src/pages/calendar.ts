// Calendar (Anbaukalender) page
import { h, clear, esc } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore, findCrop, findBed, CROP_PALETTE, fmtDate } from './utils';
import { addDays } from '../lib/date';
import { pageH } from '../components/ui/page-h';
import { openPlantingForm } from './fieldplan';

let currentView: 'gantt' | 'list' = 'gantt';

export function render(root: HTMLElement): void {
  clear(root);
  const year = stateStore.state.meta.season;
  root.appendChild(pageH({
    title: 'Anbaukalender',
    desc: `Saison ${year} · ${stateStore.state.plantings.length} Bepflanzungen`,
    actions: `<div class="btn-group">
                 <button class="btn ${currentView === 'gantt' ? 'active' : ''}" data-view="gantt">Gantt</button>
                 <button class="btn ${currentView === 'list' ? 'active' : ''}" data-view="list">Liste</button>
               </div>
               <button class="btn btn-primary" id="cal-new">${icon('plus')} Bepflanzung</button>`,
  }));
  const body = h('<div id="cal-body"></div>');
  root.appendChild(body);
  if (currentView === 'gantt') calGantt(body, year);
  else calList(body);
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.addEventListener('click', () => {
    currentView = b.dataset.view as typeof currentView;
    render(root);
  }));
  root.querySelector('#cal-new')!.addEventListener('click', () => openPlantingForm());
}

function calGantt(body: HTMLElement, year: number) {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31);
  const totalDays = (yearEnd.getTime() - yearStart.getTime()) / 86_400_000;
  const months = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const items = stateStore.state.plantings.filter(p => p.year === year).map(p => {
    const c = findCrop(p.crop);
    const b = findBed(p.bed);
    const start = p.sowDate ? new Date(p.sowDate) : new Date(year, 2, 1);
    const end = p.expectedHarvest ? new Date(p.expectedHarvest) : addDays(start, (c?.days || 90) * 86_400_000);
    return { id: p.id, label: `${c?.name || '?'} · ${b?.name || '?'}`, start, end, color: CROP_PALETTE[c?.name || ''] || '#4a7c3a' };
  });
  body.innerHTML = `
    <div class="card" style="overflow:auto">
      <div class="gantt-row" style="background:var(--bg-soft);font-size:11px;font-weight:600;color:var(--ink-soft)">
        <div class="gantt-label">Kultur / Beet</div>
        <div class="gantt-months" style="grid-template-columns:repeat(12,1fr)">${months.map(m => `<div class="gantt-month">${m}</div>`).join('')}</div>
      </div>
      ${items.length ? items.map(it => {
        const leftPct = Math.max(0, (it.start.getTime() - yearStart.getTime()) / totalDays * 100);
        const rightPct = Math.min(100, (it.end.getTime() - yearStart.getTime()) / totalDays * 100);
        const widthPct = rightPct - leftPct;
        return `<div class="gantt-row">
          <div class="gantt-label">${esc(it.label)}</div>
          <div class="gantt-track" style="position:relative">
            <div class="gantt-grid" style="grid-template-columns:repeat(12,1fr)">${Array(12).fill(0).map(() => '<div></div>').join('')}</div>
            <div class="gantt-bar" style="left:${leftPct}%;width:${widthPct}%;background:${it.color}" title="${fmtDate(it.start)} – ${fmtDate(it.end)}">
              ${fmtDate(it.start)} → ${fmtDate(it.end)}
            </div>
          </div>
        </div>`;
      }).join('') : '<div class="empty-state"><div class="icon">📅</div><h3>Keine Bepflanzungen</h3></div>'}
    </div>
  `;
}

function calList(body: HTMLElement) {
  const items = stateStore.state.plantings.map(p => {
    const c = findCrop(p.crop);
    const b = findBed(p.bed);
    return { ...p, cropName: c?.name, bedName: b?.name, color: CROP_PALETTE[c?.name || ''] };
  }).sort((a, b) => (a.sowDate || 'z').localeCompare(b.sowDate || 'z'));
  body.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Kultur</th><th>Beet</th><th>Saat</th><th>Ernte ab</th><th>Ertrag erwartet</th><th>Jahr</th></tr></thead>
        <tbody>
          ${items.map(p => `<tr>
            <td><span class="badge" style="background:${p.color || '#888'};color:#fff">${esc(p.cropName || '?')}</span></td>
            <td>${esc(p.bedName || '?')}</td>
            <td>${fmtDate(p.sowDate)}</td>
            <td>${fmtDate(p.expectedHarvest)}</td>
            <td class="text-mono">${p.expectedYield.toFixed(1)} kg</td>
            <td>${p.year}</td>
          </tr>`).join('') || '<tr><td colspan="6" class="table-empty">Keine Bepflanzungen</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
}
