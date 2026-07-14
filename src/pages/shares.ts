// Shares page
import { h, clear } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore } from './utils';
import { pageH } from '../components/ui/page-h';
import { tabs, Tab } from '../components/ui/tabs';
import { openModal, confirmDialog } from '../components/ui/modal';
import { toast } from '../components/ui/toast';
import { fmtMoney } from '../lib/format';
import { fmtDate } from '../lib/date';
import { uid } from '../lib/uid';
import type { ShareType } from '../types';

let currentTab: 'overview' | 'distribution' | 'pricing' = 'overview';

export function render(root: HTMLElement): void {
  clear(root);
  const s = stateStore.state;
  const counts = { small: 0, medium: 0, large: 0 };
  s.shares.filter(x => x.active).forEach(sh => counts[sh.type]++);
  const total = counts.small + counts.medium + counts.large;
  const target = s.meta.farm.members_target;
  const revenue = counts.small * s.meta.sharePrice.small + counts.medium * s.meta.sharePrice.medium + counts.large * s.meta.sharePrice.large;

  root.appendChild(pageH({
    title: 'Ernteanteile',
    desc: 'Verwaltung der Anteile, Preise und Verteilung',
    actions: `<button class="btn" id="shares-recalc">${icon('arrows-clockwise')} Beiträge neu berechnen</button>
               <button class="btn btn-primary" id="shares-new">${icon('plus')} Anteil zuweisen</button>`,
  }));
  const tabsEl = tabs([
    { id: 'overview', label: 'Übersicht' },
    { id: 'distribution', label: 'Verteilung planen' },
    { id: 'pricing', label: 'Preise & Modelle' },
  ] as Tab[], currentTab, t => { currentTab = t as typeof currentTab; render(root); });
  root.appendChild(tabsEl);

  const body = h('<div></div>');
  root.appendChild(body);

  if (currentTab === 'overview') {
    body.innerHTML = `
      <div class="grid grid-4 mb-4">
        <div class="stat"><div class="stat-label">Aktive Anteile</div><div class="stat-value">${total}</div><div class="text-sm text-soft">Ziel: ${target}</div></div>
        <div class="stat accent"><div class="stat-label">Klein</div><div class="stat-value">${counts.small}</div><div class="text-sm text-soft">à ${fmtMoney(s.meta.sharePrice.small)}/Monat</div></div>
        <div class="stat info"><div class="stat-label">Mittel</div><div class="stat-value">${counts.medium}</div><div class="text-sm text-soft">à ${fmtMoney(s.meta.sharePrice.medium)}/Monat</div></div>
        <div class="stat warn"><div class="stat-label">Groß</div><div class="stat-value">${counts.large}</div><div class="text-sm text-soft">à ${fmtMoney(s.meta.sharePrice.large)}/Monat</div></div>
      </div>
      <div class="grid grid-2 mb-3">
        <div class="card">
          <div class="card-h"><div class="card-title">Anteile nach Status</div></div>
          <div class="card-body"><canvas id="chart-shares-status" style="height:260px"></canvas></div>
        </div>
        <div class="card">
          <div class="card-h"><div class="card-title">Auslastung Ziel</div></div>
          <div class="card-body">
            <div class="progress mb-3"><div class="progress-bar" style="width:${Math.min(100, total / target * 100)}%"></div></div>
            <div class="text-sm text-soft">${total} / ${target} (${Math.round(total / target * 100)}%)</div>
            <div class="divider"></div>
            <div class="row gap-3 wrap">
              <div><div class="text-soft text-xs">Einnahmenpotenzial</div><div class="text-lg text-mono">${fmtMoney(revenue)}/Monat</div></div>
              <div><div class="text-soft text-xs">Mitgliederzahl</div><div class="text-lg text-mono">${s.members.filter(m => m.status === 'aktiv').length}</div></div>
            </div>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-h"><div class="card-title">Alle Anteile</div></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Mitglied</th><th>Typ</th><th>Beitrag</th><th>Start</th><th>Ende</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${s.shares.map(sh => {
                const m = s.members.find(x => x.id === sh.member);
                return `<tr>
                  <td>${m ? m.name : '—'}</td>
                  <td><span class="badge badge-${sh.type === 'small' ? 'info' : sh.type === 'medium' ? 'primary' : 'accent'}">${sh.type}</span></td>
                  <td class="text-mono">${fmtMoney(sh.monthlyPrice)}</td>
                  <td>${fmtDate(sh.start)}</td>
                  <td>${fmtDate(sh.end)}</td>
                  <td>${sh.active ? '<span class="badge badge-primary">aktiv</span>' : '<span class="badge badge-neutral">beendet</span>'}</td>
                  <td class="text-right">${sh.active ? `<button class="btn btn-sm btn-danger" data-end="${sh.id}">Beenden</button>` : ''}</td>
                </tr>`;
              }).join('') || '<tr><td colspan="7" class="table-empty">Keine Anteile</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
    // Draw donut
    import('../components/charts/donut').then(({ drawDonut }) => {
      const c = root.querySelector('#chart-shares-status') as HTMLCanvasElement;
      if (c) drawDonut(c, [
        { label: 'Klein', value: counts.small, color: '#3a6e8a' },
        { label: 'Mittel', value: counts.medium, color: '#4a7c3a' },
        { label: 'Groß', value: counts.large, color: '#c97a3a' },
      ]);
    });
    body.querySelectorAll<HTMLButtonElement>('[data-end]').forEach(b => {
      b.addEventListener('click', async () => {
        if (await confirmDialog({ message: 'Anteil beenden?', okText: 'Beenden' })) {
          stateStore.update(s => {
            const sh = s.shares.find(x => x.id === b.dataset.end)!;
            sh.active = false;
            sh.end = new Date().toISOString();
          });
          toast('Anteil beendet', { kind: 'success' });
          render(root);
        }
      });
    });
  } else if (currentTab === 'distribution') {
    const byDepot: Record<string, { name: string; address: string; count: number; small: number; medium: number; large: number }> = {};
    s.depots.forEach(d => byDepot[d.id] = { name: d.name, address: d.address, count: 0, small: 0, medium: 0, large: 0 });
    s.shares.filter(x => x.active).forEach(sh => {
      const m = s.members.find(x => x.id === sh.member);
      if (!m) return;
      const d = m.depot || 'none';
      if (!byDepot[d]) byDepot[d] = { name: 'Ohne Depot', address: '', count: 0, small: 0, medium: 0, large: 0 };
      byDepot[d].count++;
      byDepot[d][sh.type]++;
    });
    body.innerHTML = `
      <div class="card">
        <div class="card-h"><div class="card-title">Anteile je Depot</div></div>
        <div class="table-wrap">
          <table class="table">
            <thead><tr><th>Depot</th><th>Adresse</th><th class="text-right">Klein</th><th class="text-right">Mittel</th><th class="text-right">Groß</th><th class="text-right">Gesamt</th></tr></thead>
            <tbody>
              ${Object.entries(byDepot).map(([_, d]) => `<tr>
                <td><b>${d.name}</b></td>
                <td class="text-sm text-soft">${d.address}</td>
                <td class="table-num">${d.small}</td>
                <td class="table-num">${d.medium}</td>
                <td class="table-num">${d.large}</td>
                <td class="table-num"><b>${d.count}</b></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else {
    const months = seasonMonths();
    const small = s.meta.sharePrice.small, medium = s.meta.sharePrice.medium, large = s.meta.sharePrice.large;
    const revenue = months.length * (counts.small * small + counts.medium * medium + counts.large * large);
    body.innerHTML = `
      <div class="grid grid-2">
        <div class="card card-pad">
          <div class="card-title mb-3">Anteilspreise anpassen</div>
          <div class="form-row"><label>Klein (€/Monat)</label><input id="pp-small" type="number" step="1" value="${small}"/></div>
          <div class="form-row"><label>Mittel (€/Monat)</label><input id="pp-medium" type="number" step="1" value="${medium}"/></div>
          <div class="form-row"><label>Groß (€/Monat)</label><input id="pp-large" type="number" step="1" value="${large}"/></div>
          <button class="btn btn-primary" id="pp-save">${icon('floppy-disk')} Speichern</button>
        </div>
        <div class="card card-pad">
          <div class="card-title mb-3">Saisonprognose</div>
          <div class="text-sm text-soft">${months.length} Verteilungswochen in dieser Saison</div>
          <div class="text-sm mt-2">Erwartete Einnahmen bei aktueller Verteilung:</div>
          <div class="stat-value text-mono" style="font-size:24px">${fmtMoney(revenue)}</div>
          <div class="divider"></div>
          <div class="text-sm">Empfohlene Richtwerte für ${target} Mitglieder:</div>
          <div class="row gap-3 mt-2">
            <div>${icon('check')} ${Math.round(target * 0.4)} Klein</div>
            <div>${icon('check')} ${Math.round(target * 0.45)} Mittel</div>
            <div>${icon('check')} ${Math.round(target * 0.15)} Groß</div>
          </div>
        </div>
      </div>
    `;
    body.querySelector('#pp-save')!.addEventListener('click', () => {
      stateStore.update(s => {
        s.meta.sharePrice.small = Number((body.querySelector('#pp-small') as HTMLInputElement).value);
        s.meta.sharePrice.medium = Number((body.querySelector('#pp-medium') as HTMLInputElement).value);
        s.meta.sharePrice.large = Number((body.querySelector('#pp-large') as HTMLInputElement).value);
      });
      toast('Preise gespeichert', { kind: 'success' });
      render(root);
    });
  }

  root.querySelector('#shares-recalc')!.addEventListener('click', () => {
    stateStore.update(s => {
      s.shares.forEach(sh => { if (sh.active) sh.monthlyPrice = s.meta.sharePrice[sh.type]; });
    });
    toast('Beiträge neu berechnet', { kind: 'success' });
    render(root);
  });
  root.querySelector('#shares-new')!.addEventListener('click', openShareForm);
}

function seasonMonths(): Date[] {
  const start = new Date(stateStore.state.meta.season, 2, 1);
  const end = new Date(stateStore.state.meta.season, 11, 31);
  const weeks: Date[] = [];
  let w = new Date(start);
  while (w < end) { weeks.push(new Date(w)); w.setDate(w.getDate() + 7); }
  return weeks;
}

export function openShareForm(): void {
  const body = h(`
    <div class="form-row">
      <label>Mitglied</label>
      <select id="sf-member">${stateStore.state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}</select>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Anteilstyp</label>
        <select id="sf-type">
          <option value="small">Klein — ${fmtMoney(stateStore.state.meta.sharePrice.small)}/Monat</option>
          <option value="medium" selected>Mittel — ${fmtMoney(stateStore.state.meta.sharePrice.medium)}/Monat</option>
          <option value="large">Groß — ${fmtMoney(stateStore.state.meta.sharePrice.large)}/Monat</option>
        </select>
      </div>
      <div class="form-row"><label>Start</label><input id="sf-start" type="date" value="${new Date().toISOString().slice(0,10)}"/></div>
    </div>
  `);
  const m = openModal({ title: 'Anteil zuweisen', body, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>Anlegen</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    const memberId = (body.querySelector('#sf-member') as HTMLSelectElement).value;
    const type = (body.querySelector('#sf-type') as HTMLSelectElement).value as ShareType;
    const start = (body.querySelector('#sf-start') as HTMLInputElement).value;
    if (stateStore.state.shares.find(x => x.member === memberId && x.active)) {
      toast('Mitglied hat bereits aktiven Anteil', { kind: 'error' });
      return;
    }
    stateStore.update(s => {
      s.shares.push({
        id: uid('s'), member: memberId, type, active: true,
        start: start || new Date().toISOString(), end: null,
        monthlyPrice: s.meta.sharePrice[type],
      });
    });
    m.close();
    toast('Anteil angelegt', { kind: 'success' });
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  });
}
