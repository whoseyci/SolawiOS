// Inventory page
import { h, clear } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore } from './utils';
import { pageH } from '../components/ui/page-h';
import { tabs, Tab } from '../components/ui/tabs';
import { openModal, confirmDialog } from '../components/ui/modal';
import { toast } from '../components/ui/toast';
import { badge } from '../components/ui/badge';
import { emptyState } from '../components/ui/empty-state';
import { uid } from '../lib/uid';
import type { InventoryItem } from '../types';

let currentTab: 'items' | 'low' = 'items';

export function render(root: HTMLElement): void {
  clear(root);
  const low = stateStore.state.inventory.filter(i => i.stock <= (i.min || 0)).length;
  root.appendChild(pageH({
    title: 'Lager & Saatgut',
    desc: `${stateStore.state.inventory.length} Artikel · ${low} mit niedrigem Bestand`,
    actions: `<button class="btn btn-primary" id="inv-new">${icon('plus')} Neuer Artikel</button>`,
  }));
  const tabsEl = tabs([
    { id: 'items', label: 'Artikel' },
    { id: 'low', label: 'Niedriger Bestand' },
  ] as Tab[], currentTab, t => { currentTab = t as typeof currentTab; render(root); });
  root.appendChild(tabsEl);
  const body = h('<div id="inv-body"></div>');
  root.appendChild(body);
  invList(body, currentTab === 'low');
  root.querySelector('#inv-new')!.addEventListener('click', () => openInventoryForm());
}

function invList(body: HTMLElement, lowOnly: boolean) {
  const items = stateStore.state.inventory.filter(i => !lowOnly || i.stock <= (i.min || 0));
  if (!items.length) {
    body.appendChild(emptyState('Keine Artikel', lowOnly ? 'Alle Bestände ausreichend.' : 'Lege einen neuen Artikel an.', 'package'));
    return;
  }
  body.innerHTML = `
    <div class="table-wrap">
      <table class="table">
        <thead><tr><th>Artikel</th><th>Kategorie</th><th>Bestand</th><th>Min</th><th>Status</th><th>Letzte Änderung</th><th></th></tr></thead>
        <tbody>
          ${items.map(i => {
            const ok = i.stock > (i.min || 0);
            const crit = i.stock <= (i.min || 0) * 0.5;
            return `<tr>
              <td><b></b><div class="text-sm text-soft"></div></td>
              <td></td>
              <td class="text-mono"></td>
              <td class="text-mono"></td>
              <td>${crit ? badge('Kritisch', 'danger') : ok ? badge('OK', 'primary') : badge('Niedrig', 'warn')}</td>
              <td class="text-sm text-soft"></td>
              <td class="text-right">
                <button class="btn btn-sm" data-adj="1" data-id="${i.id}">+1</button>
                <button class="btn btn-sm" data-adj="-1" data-id="${i.id}">-1</button>
                <button class="btn btn-sm" data-edit="${i.id}">${icon('pencil-simple')}</button>
                <button class="btn btn-sm btn-danger" data-del="${i.id}">${icon('trash')}</button>
              </td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  // Fill text content safely
  body.querySelectorAll<HTMLTableRowElement>('tbody tr').forEach(row => {
    const id = row.querySelector('[data-edit]')?.getAttribute('data-edit')
            ?? row.querySelector('[data-del]')?.getAttribute('data-del');
    const i = stateStore.state.inventory.find(x => x.id === id);
    if (!i) return;
    (row.cells[0].querySelector('b') as HTMLElement).textContent = i.name;
    (row.cells[0].querySelector('.text-sm') as HTMLElement).textContent = i.note || '';
    row.cells[1].textContent = i.category || '—';
    row.cells[2].textContent = `${i.stock} ${i.unit || ''}`;
    row.cells[3].textContent = `${i.min || 0} ${i.unit || ''}`;
    row.cells[5].textContent = new Date(i.updatedAt).toLocaleDateString('de-DE');
  });
  body.querySelectorAll<HTMLButtonElement>('[data-adj]').forEach(b => b.addEventListener('click', () => {
    stateStore.update(s => {
      const i = s.inventory.find(x => x.id === b.dataset.id);
      if (i) { i.stock = Math.max(0, (i.stock || 0) + Number(b.dataset.adj)); i.updatedAt = new Date().toISOString(); }
    });
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  }));
  body.querySelectorAll<HTMLButtonElement>('[data-edit]').forEach(b => b.addEventListener('click', () => openInventoryForm(b.dataset.edit!)));
  body.querySelectorAll<HTMLButtonElement>('[data-del]').forEach(b => b.addEventListener('click', async () => {
    if (await confirmDialog({ message: 'Artikel löschen?', okClass: 'btn-danger' })) {
      stateStore.update(s => { s.inventory = s.inventory.filter(x => x.id !== b.dataset.del); });
      toast('Gelöscht', { kind: 'success' });
      document.dispatchEvent(new CustomEvent('solawios:refresh'));
    }
  }));
}

export function openInventoryForm(id: string | null = null): void {
  const i = id ? stateStore.state.inventory.find(x => x.id === id) : null;
  const body = h(`
    <div class="form-grid">
      <div class="form-row"><label>Name *</label><input id="i-name"/></div>
      <div class="form-row"><label>Kategorie</label>
        <select id="i-cat">
          <option value="Saatgut">Saatgut</option>
          <option value="Pflanzen">Pflanzen</option>
          <option value="Dünger">Dünger</option>
          <option value="Werkzeug">Werkzeug</option>
          <option value="Verbrauchsmaterial">Verbrauchsmaterial</option>
          <option value="Verpackung">Verpackung</option>
          <option value="Sonstiges">Sonstiges</option>
        </select>
      </div>
    </div>
    <div class="form-grid-3">
      <div class="form-row"><label>Bestand</label><input id="i-stock" type="number" step="0.1"/></div>
      <div class="form-row"><label>Mindestbestand</label><input id="i-min" type="number" step="0.1"/></div>
      <div class="form-row"><label>Einheit</label><input id="i-unit" value="Stück"/></div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Einkaufspreis (€)</label><input id="i-price" type="number" step="0.01"/></div>
      <div class="form-row"><label>Lieferant</label><input id="i-supplier"/></div>
    </div>
    <div class="form-row"><label>Notiz</label><textarea id="i-note" rows="2"></textarea></div>
  `);
  if (i) {
    (body.querySelector('#i-name') as HTMLInputElement).value = i.name;
    (body.querySelector('#i-cat') as HTMLSelectElement).value = i.category || 'Saatgut';
    (body.querySelector('#i-stock') as HTMLInputElement).value = String(i.stock);
    (body.querySelector('#i-min') as HTMLInputElement).value = String(i.min);
    (body.querySelector('#i-unit') as HTMLInputElement).value = i.unit || '';
    (body.querySelector('#i-price') as HTMLInputElement).value = String(i.price);
    (body.querySelector('#i-supplier') as HTMLInputElement).value = i.supplier || '';
    (body.querySelector('#i-note') as HTMLTextAreaElement).value = i.note || '';
  }
  const m = openModal({ title: i ? 'Artikel bearbeiten' : 'Neuer Artikel', body, wide: true, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>Speichern</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    const data: Partial<InventoryItem> = {
      name: (body.querySelector('#i-name') as HTMLInputElement).value.trim(),
      category: (body.querySelector('#i-cat') as HTMLSelectElement).value,
      stock: Number((body.querySelector('#i-stock') as HTMLInputElement).value) || 0,
      min: Number((body.querySelector('#i-min') as HTMLInputElement).value) || 0,
      unit: (body.querySelector('#i-unit') as HTMLInputElement).value,
      price: Number((body.querySelector('#i-price') as HTMLInputElement).value) || 0,
      supplier: (body.querySelector('#i-supplier') as HTMLInputElement).value,
      note: (body.querySelector('#i-note') as HTMLTextAreaElement).value,
      updatedAt: new Date().toISOString(),
    };
    if (!data.name) { toast('Name erforderlich', { kind: 'error' }); return; }
    if (i) {
      stateStore.update(() => { Object.assign(i, data); });
    } else {
      stateStore.update(s => { s.inventory.push({ id: uid('i'), ...data } as InventoryItem); });
    }
    m.close();
    toast('Artikel gespeichert', { kind: 'success' });
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  });
}
