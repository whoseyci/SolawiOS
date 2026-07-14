// Orders page
import { h, clear, esc } from '../lib/dom';
import { icon, iconEl } from '../lib/icons';
import { stateStore, findMember, fmtDate, fmtMoney } from './utils';
import { pageH } from '../components/ui/page-h';
import { tabs, Tab } from '../components/ui/tabs';
import { openModal } from '../components/ui/modal';
import { toast } from '../components/ui/toast';
import { badge } from '../components/ui/badge';
import { emptyState } from '../components/ui/empty-state';
import { uid } from '../lib/uid';

let currentTab: 'open' | 'delivered' | 'products' = 'open';
let draftItems: Array<{ product: string; qty: number }> = [];

export function render(root: HTMLElement): void {
  clear(root);
  root.appendChild(pageH({
    title: 'Bestellungen',
    desc: 'Zusatzprodukte, Hofladen, Eier, Brot, etc.',
    actions: `<button class="btn btn-primary" id="ord-new">${icon('plus')} Neue Bestellung</button>`,
  }));
  const tabsEl = tabs([
    { id: 'open', label: 'Offen' },
    { id: 'delivered', label: 'Geliefert' },
    { id: 'products', label: 'Produkte' },
  ] as Tab[], currentTab, t => { currentTab = t as typeof currentTab; render(root); });
  root.appendChild(tabsEl);
  const body = h('<div id="ord-body"></div>');
  root.appendChild(body);
  if (currentTab === 'open' || currentTab === 'delivered') ordList(body, currentTab === 'open' ? 'offen' : 'geliefert');
  if (currentTab === 'products') ordProducts(body);
  root.querySelector('#ord-new')!.addEventListener('click', () => openOrderForm());
}

function ordList(body: HTMLElement, status: 'offen' | 'geliefert') {
  const list = stateStore.state.orders.filter(o => o.status === status);
  if (!list.length) {
    body.appendChild(emptyState('Keine Bestellungen', '', 'shopping-cart'));
    return;
  }
  body.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Bestellnr</th><th>Mitglied</th><th>Datum</th><th>Lieferung</th><th>Produkte</th><th class="text-right">Betrag</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${list.map(o => {
            const m = findMember(o.member);
            return `<tr>
              <td class="text-mono">${o.id.slice(-6).toUpperCase()}</td>
              <td>${m ? m.name : '—'}</td>
              <td>${fmtDate(o.date)}</td>
              <td>${fmtDate(o.delivery)}</td>
              <td class="text-sm">${o.items.map(i => `${i.qty}× ${esc(i.name)}`).join(', ')}</td>
              <td class="table-num">${fmtMoney(o.total)}</td>
              <td>${badge(o.status, o.status === 'geliefert' ? 'primary' : 'warn')}</td>
              <td class="text-right">${status === 'offen' ? `<button class="btn btn-sm btn-primary" data-done="${o.id}">${icon('truck')} Liefern</button>` : ''}<button class="btn btn-sm btn-danger" data-del="${o.id}">${icon('x')}</button></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  body.querySelectorAll<HTMLButtonElement>('[data-done]').forEach(b => b.addEventListener('click', () => {
    stateStore.update(s => { const o = s.orders.find(x => x.id === b.dataset.done)!; o.status = 'geliefert'; o.deliveredAt = new Date().toISOString(); });
    toast('Als geliefert markiert', { kind: 'success' });
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  }));
  body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach(b => b.addEventListener('click', () => {
    stateStore.update(s => { s.orders = s.orders.filter(o => o.id !== b.dataset.del); });
    toast('Bestellung gelöscht');
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  }));
}

function ordProducts(body: HTMLElement) {
  body.innerHTML = `
    <div class="card card-pad">
      <div class="card-title mb-3">Verfügbare Zusatzprodukte</div>
      <div class="grid grid-3">
        ${stateStore.state.products.map(() => `<div class="card card-pad">
          <div class="row gap-2 mb-2"><div style="font-size:24px"></div><div class="grow"><div style="font-weight:600"></div><div class="text-sm text-soft"></div></div></div>
          <div class="text-lg text-mono"></div>
          <div class="text-sm text-soft mt-2"></div>
        </div>`).join('')}
      </div>
    </div>
  `;
  body.querySelectorAll('.card-pad .card-pad').forEach((card, i) => {
    const p = stateStore.state.products[i];
    if (!p) return;
    (card.querySelector('div[style*="font-size:24px"]') as HTMLElement).appendChild(iconEl(p.icon));
    (card.querySelector('div[style*="font-weight:600"]') as HTMLElement).textContent = p.name;
    (card.querySelectorAll('div.text-sm.text-soft')[0] as HTMLElement).textContent = p.unit || '';
    (card.querySelector('div.text-lg.text-mono') as HTMLElement).textContent = fmtMoney(p.price);
    (card.querySelectorAll('div.text-sm.text-soft')[1] as HTMLElement).textContent = p.note || '';
  });
}

export function openOrderForm(): void {
  draftItems = [{ product: stateStore.state.products[0]?.id || '', qty: 1 }];
  const body = h(`
    <div class="form-grid">
      <div class="form-row"><label>Mitglied *</label>
        <select id="o-member">${stateStore.state.members.map(m => `<option value="${m.id}">${m.name}</option>`).join('')}</select>
      </div>
      <div class="form-row"><label>Lieferung am</label><input id="o-delivery" type="date"/></div>
    </div>
    <div class="form-section">Produkte</div>
    <div id="o-items"></div>
    <button class="btn btn-sm" id="o-add">${icon('plus')} Produkt</button>
    <div class="form-section">Summe</div>
    <div class="text-lg text-mono" id="o-total">€ 0,00</div>
  `);
  function renderItems() {
    const wrap = body.querySelector('#o-items') as HTMLElement;
    clear(wrap);
    draftItems.forEach((it, idx) => {
      const row = h(`
        <div class="row gap-2 mb-2">
          <select data-idx="${idx}" data-k="product" class="grow" style="flex:2">
            ${stateStore.state.products.map(p => `<option value="${p.id}" ${p.id === it.product ? 'selected' : ''}>${esc(p.name)} — ${fmtMoney(p.price)}</option>`).join('')}
          </select>
          <input type="number" data-idx="${idx}" data-k="qty" min="1" step="1" value="${it.qty}" style="width:80px"/>
          <button class="btn btn-sm btn-danger" data-rm="${idx}">${icon('x')}</button>
        </div>
      `) as HTMLElement;
      wrap.appendChild(row);
    });
    wrap.querySelectorAll<HTMLSelectElement | HTMLInputElement>('select, input').forEach(el => {
      el.addEventListener('input', () => {
        const idx = Number((el as HTMLElement).dataset.idx);
        const k = (el as HTMLElement).dataset.k;
        if (k === 'qty') draftItems[idx].qty = Number((el as HTMLInputElement).value) || 0;
        if (k === 'product') draftItems[idx].product = (el as HTMLSelectElement).value;
        recalc();
      });
    });
    wrap.querySelectorAll<HTMLButtonElement>('[data-rm]').forEach(b => b.addEventListener('click', () => {
      draftItems.splice(Number(b.dataset.rm), 1);
      renderItems();
      recalc();
    }));
  }
  function recalc() {
    const total = draftItems.reduce((s, it) => {
      const p = stateStore.state.products.find(p => p.id === it.product);
      return s + (p?.price || 0) * (it.qty || 0);
    }, 0);
    (body.querySelector('#o-total') as HTMLElement).textContent = fmtMoney(total);
  }
  body.querySelector('#o-add')!.addEventListener('click', () => {
    draftItems.push({ product: stateStore.state.products[0]?.id || '', qty: 1 });
    renderItems(); recalc();
  });
  renderItems();
  recalc();
  const m = openModal({ title: 'Neue Bestellung', body, wide: true, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>Anlegen</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    const items = draftItems.map(it => {
      const p = stateStore.state.products.find(p => p.id === it.product);
      return { product: it.product, name: p?.name || '', qty: it.qty, price: p?.price || 0, total: (p?.price || 0) * it.qty };
    });
    const total = items.reduce((s, i) => s + i.total, 0);
    stateStore.update(s => {
      s.orders.push({
        id: uid('o'),
        member: (body.querySelector('#o-member') as HTMLSelectElement).value,
        date: new Date().toISOString(),
        delivery: (body.querySelector('#o-delivery') as HTMLInputElement).value || null,
        items, total,
        status: 'offen',
        deliveredAt: null,
      });
    });
    m.close();
    toast('Bestellung angelegt', { kind: 'success' });
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  });
}
