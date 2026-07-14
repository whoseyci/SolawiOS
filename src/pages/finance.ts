// Finance page
import { h, clear } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore, fmtDate, fmtMoney } from './utils';
import { monthName, TODAY, sameMonth } from '../lib/date';
import { pageH } from '../components/ui/page-h';
import { openModal } from '../components/ui/modal';
import { toast } from '../components/ui/toast';
import { badge } from '../components/ui/badge';
import { uid } from '../lib/uid';
import { download } from '../lib/download';
import type { Payment } from '../types';
import { pickColor } from '../components/charts/canvas-utils';

let currentTab: 'overview' | 'list' | 'budget' = 'overview';

export function render(root: HTMLElement): void {
  clear(root);
  const year = stateStore.state.meta.season;
  root.appendChild(pageH({
    title: 'Finanzen',
    desc: `Saison ${year}`,
    actions: `<div class="btn-group">
                 <button class="btn ${currentTab === 'overview' ? 'active' : ''}" data-view="overview">Übersicht</button>
                 <button class="btn ${currentTab === 'list' ? 'active' : ''}" data-view="list">Buchungen</button>
                 <button class="btn ${currentTab === 'budget' ? 'active' : ''}" data-view="budget">Budget</button>
               </div>
               <button class="btn btn-primary" id="fin-new">${icon('plus')} Buchung</button>`,
  }));
  const body = h('<div id="fin-body"></div>');
  root.appendChild(body);
  if (currentTab === 'overview') finOverview(body, year);
  if (currentTab === 'list') finList(body, year);
  if (currentTab === 'budget') finBudget(body, year);
  root.querySelectorAll<HTMLButtonElement>('[data-view]').forEach(b => b.addEventListener('click', () => {
    currentTab = b.dataset.view as typeof currentTab;
    render(root);
  }));
  root.querySelector('#fin-new')!.addEventListener('click', () => openPaymentForm());
}

function finOverview(body: HTMLElement, year: number) {
  const income = stateStore.state.payments.filter(p => p.kind === 'beitrag' && p.date && new Date(p.date).getFullYear() === year).reduce((s, p) => s + p.amount, 0);
  const expenses = stateStore.state.payments.filter(p => p.kind === 'ausgabe' && p.date && new Date(p.date).getFullYear() === year).reduce((s, p) => s + p.amount, 0);
  const other = stateStore.state.payments.filter(p => p.kind === 'sonstig' && p.date && new Date(p.date).getFullYear() === year).reduce((s, p) => s + p.amount, 0);
  const balance = income - expenses + other;
  const monthly = Array.from({ length: 12 }, (_, i) => ({ income: 0, expense: 0, label: monthName(new Date(year, i, 1)) }));
  stateStore.state.payments.forEach(p => {
    const d = new Date(p.date);
    if (d.getFullYear() !== year) return;
    const m = d.getMonth();
    if (p.kind === 'beitrag') monthly[m].income += p.amount;
    else if (p.kind === 'ausgabe') monthly[m].expense += p.amount;
  });
  const expected = stateStore.state.shares.filter(s => s.active).reduce((s, sh) => s + (sh.monthlyPrice || 0), 0);
  const received = stateStore.state.payments.filter(p => p.kind === 'beitrag' && p.date && sameMonth(p.date, TODAY)).reduce((s, p) => s + p.amount, 0);

  body.innerHTML = `
    <div class="grid grid-4 mb-4">
      <div class="stat"><div class="stat-label">Einnahmen</div><div class="stat-value">${fmtMoney(income)}</div><div class="text-sm text-soft">Mitgliederbeiträge</div></div>
      <div class="stat danger"><div class="stat-label">Ausgaben</div><div class="stat-value">${fmtMoney(expenses)}</div><div class="text-sm text-soft">laufender Betrieb</div></div>
      <div class="stat ${balance >= 0 ? 'primary' : 'danger'}"><div class="stat-label">Saldo</div><div class="stat-value">${fmtMoney(balance)}</div><div class="text-sm text-soft">${balance >= 0 ? 'positiv' : 'negativ'}</div></div>
      <div class="stat warn"><div class="stat-label">Offene Beiträge (Monat)</div><div class="stat-value">${fmtMoney(expected - received)}</div><div class="text-sm text-soft">erwartet: ${fmtMoney(expected)}</div></div>
    </div>
    <div class="card mb-3">
      <div class="card-h"><div class="card-title">Monatliche Einnahmen & Ausgaben</div></div>
      <div class="card-body"><canvas id="fin-monthly" style="height:320px"></canvas></div>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="card-h"><div class="card-title">Ausgaben nach Kategorie</div></div>
        <div class="card-body"><canvas id="fin-expense" style="height:220px"></canvas></div>
      </div>
      <div class="card">
        <div class="card-h"><div class="card-title">Beitragsstatus Mitglieder</div></div>
        <div class="card-body" id="fin-memstatus"></div>
      </div>
    </div>
  `;
  // Charts
  import('../components/charts/grouped-bar').then(({ drawGroupedBar }) => {
    const c = body.querySelector('#fin-monthly') as HTMLCanvasElement;
    if (c) drawGroupedBar(c, monthly, 'income', 'expense', '#4a7c3a', '#a83a2a', 'Einnahmen', 'Ausgaben');
  });
  const exp: Record<string, number> = {};
  stateStore.state.payments.filter(p => p.kind === 'ausgabe' && new Date(p.date).getFullYear() === year).forEach(p => {
    exp[p.category || 'Sonstige'] = (exp[p.category || 'Sonstige'] || 0) + p.amount;
  });
  import('../components/charts/donut').then(({ drawDonut }) => {
    const c = body.querySelector('#fin-expense') as HTMLCanvasElement;
    if (c) drawDonut(c, Object.entries(exp).map(([k, v]) => ({ label: k, value: v, color: pickColor(k) })));
  });
  // Member status
  const expectedNow = stateStore.state.shares.filter(s => s.active).reduce((s, sh) => s + (sh.monthlyPrice || 0), 0);
  const receivedNow = stateStore.state.payments.filter(p => p.kind === 'beitrag' && p.date && sameMonth(p.date, TODAY)).reduce((s, p) => s + p.amount, 0);
  const pct = expectedNow ? receivedNow / expectedNow * 100 : 0;
  const mem = body.querySelector('#fin-memstatus') as HTMLElement;
  mem.innerHTML = `
    <div class="text-sm text-soft">Monat ${monthName(TODAY)}</div>
    <div class="text-lg text-mono mt-1">${fmtMoney(receivedNow)} / ${fmtMoney(expectedNow)}</div>
    <div class="progress mt-2"><div class="progress-bar" style="width:${pct}%"></div></div>
    <div class="text-sm text-soft mt-2">${pct.toFixed(0)}% eingegangen</div>
    <div class="divider"></div>
    <div class="row gap-2">
      <button class="btn btn-sm btn-primary" id="charge-all">${icon('lightning')} Alle abbuchen</button>
      <button class="btn btn-sm" id="export-fin">${icon('download')} CSV</button>
    </div>
  `;
  mem.querySelector('#charge-all')!.addEventListener('click', () => chargeAllMembers());
  mem.querySelector('#export-fin')!.addEventListener('click', exportFinanceCSV);
}

function finList(body: HTMLElement, _year: number) {
  const list = stateStore.state.payments.slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  body.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Datum</th><th>Art</th><th>Name</th><th>Kategorie</th><th>Mitglied</th><th class="text-right">Betrag</th><th></th></tr></thead>
        <tbody>
          ${list.map(p => {
            const m = p.member ? stateStore.state.members.find(x => x.id === p.member) : null;
            return `<tr>
              <td>${fmtDate(p.date)}</td>
              <td>${p.kind === 'beitrag' ? badge('Beitrag', 'primary') : p.kind === 'ausgabe' ? badge('Ausgabe', 'neutral') : badge('Sonstig', 'info')}</td>
              <td></td>
              <td></td>
              <td>${m ? m.name : '—'}</td>
              <td class="table-num">${fmtMoney(p.amount)}</td>
              <td class="text-right"><button class="btn btn-sm btn-danger" data-del="${p.id}">${icon('x')}</button></td>
            </tr>`;
          }).join('') || '<tr><td colspan="7" class="table-empty">Keine Buchungen</td></tr>'}
        </tbody>
      </table>
    </div>
  `;
  body.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(row => {
    const id = row.querySelector('[data-del]')?.getAttribute('data-del');
    const p = stateStore.state.payments.find(x => x.id === id);
    if (!p) return;
    (row.cells[2] as HTMLElement).textContent = p.name || '';
    (row.cells[3] as HTMLElement).textContent = p.category || '';
  });
  body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach(b => b.addEventListener('click', () => {
    stateStore.update(s => { s.payments = s.payments.filter(p => p.id !== b.dataset.del); });
    toast('Buchung gelöscht');
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  }));
}

function finBudget(body: HTMLElement, year: number) {
  const cats = ['Saatgut', 'Pflanzgut', 'Dünger', 'Werkzeug', 'Personal', 'Verteilung', 'Pacht', 'Versicherung', 'Sonstiges'];
  const expenses = stateStore.state.payments.filter(p => p.kind === 'ausgabe' && p.date && new Date(p.date).getFullYear() === year);
  body.innerHTML = `
    <div class="card card-pad">
      <div class="row gap-2 mb-3">
        <button class="btn btn-sm btn-primary" id="fb-fill">${icon('magic-wand')} Mit Erfahrungswerten füllen</button>
        <button class="btn btn-sm" id="fb-save">${icon('floppy-disk')} Budget speichern</button>
      </div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Kategorie</th><th class="text-right">Budget</th><th class="text-right">Bisher ausgegeben</th><th class="text-right">Differenz</th><th>Fortschritt</th></tr></thead>
          <tbody id="fb-rows"></tbody>
          <tfoot><tr><td><b>Summe</b></td><td class="table-num" id="fb-sum-budget"></td><td class="table-num" id="fb-sum-spent"></td><td class="table-num" id="fb-sum-diff"></td><td></td></tr></tfoot>
        </table>
      </div>
    </div>
  `;
  function render() {
    const rows = body.querySelector('#fb-rows') as HTMLElement;
    rows.innerHTML = '';
    let sumB = 0, sumS = 0;
    cats.forEach(c => {
      const budget = stateStore.state.budget[c] || 0;
      const spent = expenses.filter(p => p.category === c).reduce((s, p) => s + p.amount, 0);
      const diff = budget - spent;
      const pct = budget ? spent / budget * 100 : 0;
      sumB += budget; sumS += spent;
      const tr = h(`
        <tr>
          <td><b>${c}</b></td>
          <td class="text-right"><input type="number" step="50" data-cat="${c}" class="text-right" style="width:120px" value="${budget}"/></td>
          <td class="text-mono text-right">${fmtMoney(spent)}</td>
          <td class="text-mono text-right" style="color:${diff < 0 ? 'var(--danger)' : 'var(--primary)'}">${fmtMoney(diff)}</td>
          <td><div class="progress" style="width:100px"><div class="progress-bar ${pct > 90 ? 'danger' : 'warn'}" style="width:${Math.min(100, pct)}%"></div></div></td>
        </tr>
      `) as HTMLElement;
      rows.appendChild(tr);
    });
    rows.querySelectorAll<HTMLInputElement>('input').forEach(inp => {
      inp.addEventListener('input', () => {
        stateStore.update(s => { s.budget[inp.dataset.cat!] = Number(inp.value) || 0; });
        render();
      });
    });
    (body.querySelector('#fb-sum-budget') as HTMLElement).textContent = fmtMoney(sumB);
    (body.querySelector('#fb-sum-spent') as HTMLElement).textContent = fmtMoney(sumS);
    (body.querySelector('#fb-sum-diff') as HTMLElement).textContent = fmtMoney(sumB - sumS);
  }
  body.querySelector('#fb-fill')!.addEventListener('click', () => {
    stateStore.update(s => {
      s.budget = { Saatgut: 1200, Pflanzgut: 600, Dünger: 400, Werkzeug: 350, Personal: 8000, Verteilung: 1200, Pacht: 2400, Versicherung: 1100, Sonstiges: 600 };
    });
    toast('Budget gespeichert', { kind: 'success' });
    render();
  });
  body.querySelector('#fb-save')!.addEventListener('click', () => { Store.save(stateStore.state); toast('Budget gespeichert', { kind: 'success' }); });
  render();
}

import { Store } from '../lib/store';

export function openPaymentForm(): void {
  const body = h(`
    <div class="form-grid">
      <div class="form-row"><label>Datum *</label><input id="p-date" type="date" value="${new Date().toISOString().slice(0,10)}"/></div>
      <div class="form-row"><label>Art *</label>
        <select id="p-kind">
          <option value="beitrag">Beitrag (Einnahme)</option>
          <option value="ausgabe">Ausgabe</option>
          <option value="sonstig">Sonstige Buchung</option>
        </select>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Bezeichnung *</label><input id="p-name"/></div>
      <div class="form-row"><label>Kategorie</label>
        <select id="p-cat">
          <option value="">—</option>
          <option value="Saatgut">Saatgut</option>
          <option value="Pflanzgut">Pflanzgut</option>
          <option value="Dünger">Dünger</option>
          <option value="Werkzeug">Werkzeug</option>
          <option value="Personal">Personal</option>
          <option value="Verteilung">Verteilung</option>
          <option value="Pacht">Pacht</option>
          <option value="Versicherung">Versicherung</option>
          <option value="Mitgliederbeitrag">Mitgliederbeitrag</option>
          <option value="Sonstiges">Sonstiges</option>
        </select>
      </div>
    </div>
    <div class="form-grid-3">
      <div class="form-row"><label>Betrag (€) *</label><input id="p-amount" type="number" step="0.01"/></div>
      <div class="form-row"><label>Mitglied (optional)</label>
        <select id="p-member">
          <option value="">—</option>
          ${stateStore.state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Zahlungsweg</label>
        <select id="p-method">
          <option value="bank">Überweisung</option>
          <option value="lastschrift">Lastschrift</option>
          <option value="bar">Bargeld</option>
          <option value="paypal">PayPal</option>
        </select>
      </div>
    </div>
    <div class="form-row"><label>Notiz</label><textarea id="p-note" rows="2"></textarea></div>
  `);
  const m = openModal({ title: 'Neue Buchung', body, wide: true, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>Speichern</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    const data: Partial<Payment> = {
      date: (body.querySelector('#p-date') as HTMLInputElement).value,
      kind: (body.querySelector('#p-kind') as HTMLSelectElement).value as Payment['kind'],
      name: (body.querySelector('#p-name') as HTMLInputElement).value,
      category: (body.querySelector('#p-cat') as HTMLSelectElement).value,
      amount: Number((body.querySelector('#p-amount') as HTMLInputElement).value) || 0,
      member: (body.querySelector('#p-member') as HTMLSelectElement).value || null,
      method: (body.querySelector('#p-method') as HTMLSelectElement).value as Payment['method'],
      note: (body.querySelector('#p-note') as HTMLTextAreaElement).value,
    };
    if (!data.date || !data.name || !data.amount) { toast('Pflichtfelder fehlen', { kind: 'error' }); return; }
    stateStore.update(s => { s.payments.push({ id: uid('p'), ...data } as Payment); });
    m.close();
    toast('Buchung gespeichert', { kind: 'success' });
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  });
}

export async function chargeAllMembers(): Promise<void> {
  if (!await (await import('../components/ui/modal')).confirmDialog({ message: `Beiträge für ${monthName(TODAY)} für alle aktiven Mitglieder buchen?`, okText: 'Alle buchen' })) return;
  const month = new Date().toISOString().slice(0, 7);
  let added = 0;
  stateStore.update(s => {
    for (const sh of s.shares.filter(x => x.active)) {
      const exists = s.payments.find(p => p.kind === 'beitrag' && p.member === sh.member && p.date && p.date.slice(0, 7) === month);
      if (exists) continue;
      s.payments.push({
        id: uid('p'),
        date: new Date().toISOString(),
        kind: 'beitrag',
        name: `Mitgliederbeitrag ${monthName(TODAY)}`,
        category: 'Mitgliederbeitrag',
        amount: sh.monthlyPrice,
        member: sh.member,
        method: 'lastschrift',
        note: '',
      });
      added++;
    }
  });
  toast(`${added} Beiträge gebucht`, { kind: 'success' });
  document.dispatchEvent(new CustomEvent('solawios:refresh'));
}

export function exportFinanceCSV(): void {
  const rows: string[][] = [['Datum','Art','Name','Kategorie','Mitglied','Betrag','Zahlungsweg']];
  stateStore.state.payments.forEach(p => {
    const m = p.member ? stateStore.state.members.find(x => x.id === p.member) : null;
    rows.push([p.date, p.kind, p.name, p.category, m?.name || '', String(p.amount), p.method]);
  });
  download('finanzen.csv', rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
}
