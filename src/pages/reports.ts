// Reports page
import { clear } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore, fmtMoney } from './utils';
import { fmtNum } from '../lib/format';
import { pageH } from '../components/ui/page-h';
import { drawBar } from '../components/charts/bar';
import { drawGroupedBar } from '../components/charts/grouped-bar';
import { drawDonut } from '../components/charts/donut';
import { monthShort } from '../lib/date';
import { download } from '../lib/download';
import { toast } from '../components/ui/toast';

export function render(root: HTMLElement): void {
  clear(root);
  const year = stateStore.state.meta.season;
  root.appendChild(pageH({
    title: 'Berichte',
    desc: `Saison ${year} · Auswertungen`,
    actions: `<button class="btn btn-primary" id="rep-export">${icon('download')} Backup (JSON)</button>`,
  }));
  root.innerHTML += `
    <div class="grid grid-2">
      <div class="card card-pad">
        <div class="card-title">Erntemengen</div>
        <div class="row gap-3 mb-2"><div class="stat-label">Gesamt</div><div class="stat-value" id="rep-hv"></div></div>
        <div class="row gap-3"><div class="stat-label">Anzahl Buchungen</div><div class="text-lg" id="rep-hc"></div></div>
        <div class="row gap-3 mt-2"><div class="stat-label">Kulturen geerntet</div><div class="text-lg" id="rep-hk"></div></div>
        <div class="divider"></div>
        <canvas id="rep-harvest" style="height:320px"></canvas>
      </div>
      <div class="card card-pad">
        <div class="card-title">Mitglieder</div>
        <div class="row gap-3 mb-2"><div class="stat-label">Gesamt</div><div class="stat-value" id="rep-mt"></div></div>
        <div class="row gap-3"><div class="stat-label">Aktiv</div><div class="text-lg" id="rep-ma"></div></div>
        <div class="row gap-3 mt-2"><div class="stat-label">Warteliste</div><div class="text-lg" id="rep-mw"></div></div>
        <div class="divider"></div>
        <canvas id="rep-members" style="height:320px"></canvas>
      </div>
      <div class="card card-pad">
        <div class="card-title">Finanzen</div>
        <div class="row gap-3 mb-2"><div class="stat-label">Einnahmen</div><div class="stat-value" id="rep-fi"></div></div>
        <div class="row gap-3"><div class="stat-label">Ausgaben</div><div class="text-lg" id="rep-fe"></div></div>
        <div class="row gap-3 mt-2"><div class="stat-label">Saldo</div><div class="text-lg" id="rep-fb"></div></div>
        <div class="divider"></div>
        <canvas id="rep-finance" style="height:320px"></canvas>
      </div>
      <div class="card card-pad">
        <div class="card-title">Aufgaben</div>
        <div class="row gap-3 mb-2"><div class="stat-label">Gesamt</div><div class="stat-value" id="rep-tt"></div></div>
        <div class="row gap-3"><div class="stat-label">Erledigt</div><div class="text-lg" id="rep-td"></div></div>
        <div class="row gap-3 mt-2"><div class="stat-label">Quote</div><div class="text-lg" id="rep-tq"></div></div>
        <div class="divider"></div>
        <canvas id="rep-tasks" style="height:320px"></canvas>
      </div>
    </div>
    <div class="card card-pad mt-3">
      <div class="card-title mb-3">Daten-Export</div>
      <div class="row gap-2 wrap">
        <button class="btn" id="rep-json">${icon('download')} Komplett-Export (JSON)</button>
        <label class="btn"><input type="file" id="rep-import" accept=".json" style="display:none"/>${icon('upload')} Importieren</label>
      </div>
    </div>
  `;
  // Populate
  const s = stateStore.state;
  const hv = s.harvest.reduce((a, h) => a + h.amount, 0);
  document.getElementById('rep-hv')!.textContent = `${fmtNum(hv)} kg`;
  document.getElementById('rep-hc')!.textContent = String(s.harvest.length);
  document.getElementById('rep-hk')!.textContent = String(new Set(s.harvest.map(h => h.crop)).size);
  document.getElementById('rep-mt')!.textContent = String(s.members.length);
  document.getElementById('rep-ma')!.textContent = String(s.members.filter(m => m.status === 'aktiv').length);
  document.getElementById('rep-mw')!.textContent = String(s.members.filter(m => m.status === 'warteliste').length);
  const inc = s.payments.filter(p => p.kind === 'beitrag').reduce((a, p) => a + p.amount, 0);
  const exp = s.payments.filter(p => p.kind === 'ausgabe').reduce((a, p) => a + p.amount, 0);
  document.getElementById('rep-fi')!.textContent = fmtMoney(inc);
  document.getElementById('rep-fe')!.textContent = fmtMoney(exp);
  document.getElementById('rep-fb')!.textContent = fmtMoney(inc - exp);
  const tot = s.tasks.length, done = s.tasks.filter(t => t.status === 'done').length;
  document.getElementById('rep-tt')!.textContent = String(tot);
  document.getElementById('rep-td')!.textContent = String(done);
  document.getElementById('rep-tq')!.textContent = tot ? `${Math.round(done / tot * 100)}%` : '0%';
  // Charts
  const byMonth = Array(12).fill(0).map((_, i) => ({ label: monthShort(new Date(year, i, 1)), value: 0 }));
  s.harvest.forEach(h => { const d = new Date(h.date); if (d.getFullYear() === year) byMonth[d.getMonth()].value += h.amount; });
  drawBar(document.getElementById('rep-harvest') as HTMLCanvasElement, byMonth, '#4a7c3a');
  const memByMonth = Array(12).fill(0).map((_, i) => ({ label: monthShort(new Date(year, i, 1)), value: 0 }));
  s.members.forEach(m => { if (!m.since) return; const d = new Date(m.since); if (d.getFullYear() === year) memByMonth[d.getMonth()].value++; });
  drawBar(document.getElementById('rep-members') as HTMLCanvasElement, memByMonth, '#3a6e8a');
  const finByMonth = Array(12).fill(0).map((_, i) => ({ income: 0, expense: 0, label: monthShort(new Date(year, i, 1)) }));
  s.payments.forEach(p => { const d = new Date(p.date); if (d.getFullYear() !== year) return; if (p.kind === 'beitrag') finByMonth[d.getMonth()].income += p.amount; else if (p.kind === 'ausgabe') finByMonth[d.getMonth()].expense += p.amount; });
  drawGroupedBar(document.getElementById('rep-finance') as HTMLCanvasElement, finByMonth, 'income', 'expense');
  const taskStatus = ['backlog','todo','in_progress','done'].map(s => ({ label: ({ backlog: 'Backlog', todo: 'Geplant', in_progress: 'In Arbeit', done: 'Erledigt' } as Record<string, string>)[s] ?? s, value: stateStore.state.tasks.filter(t => t.status === s).length }));
  drawDonut(document.getElementById('rep-tasks') as HTMLCanvasElement, taskStatus.map((t, i) => ({ label: t.label, value: t.value, color: ['#888','#3a6e8a','#b8860b','#4a7c3a'][i] })));
  // Actions
  document.getElementById('rep-json')!.addEventListener('click', exportJSON);
  document.getElementById('rep-import')!.addEventListener('change', e => importJSON(e as Event));
  document.getElementById('rep-export')!.addEventListener('click', exportJSON);
}

export function exportJSON(): void {
  download(`solawios-backup-${new Date().toISOString().slice(0,10)}.json`, JSON.stringify(stateStore.state, null, 2), 'application/json');
}

export function importJSON(e: Event): void {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const data = JSON.parse(reader.result as string);
      stateStore.set(data);
      toast('Import erfolgreich', { kind: 'success' });
      document.dispatchEvent(new CustomEvent('solawios:refresh'));
    } catch {
      toast('Fehler beim Import', { kind: 'error' });
    }
  };
  reader.readAsText(file);
}
