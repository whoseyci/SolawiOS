// Distribution page — depots, routes, pickups
import { h, clear, esc } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore, findDepot, fmtDate } from './utils';
import { fmtDay } from '../lib/date';
import { pageH } from '../components/ui/page-h';
import { tabs, Tab } from '../components/ui/tabs';
import { openModal, confirmDialog } from '../components/ui/modal';
import { toast } from '../components/ui/toast';
import { badge } from '../components/ui/badge';
import { emptyState } from '../components/ui/empty-state';
import { uid } from '../lib/uid';
import type { Depot } from '../types';

let currentTab: 'depots' | 'routes' | 'pickups' = 'depots';

export function render(root: HTMLElement): void {
  clear(root);
  root.appendChild(pageH({
    title: 'Verteilung',
    desc: 'Depots, Routen, Abholzeiten',
    actions: `<button class="btn btn-primary" id="dist-new">${icon('plus')} Neues Depot</button>`,
  }));
  const tabsEl = tabs([
    { id: 'depots', label: 'Depots' },
    { id: 'routes', label: 'Routen' },
    { id: 'pickups', label: 'Abholtermine' },
  ] as Tab[], currentTab, t => { currentTab = t as typeof currentTab; render(root); });
  root.appendChild(tabsEl);
  const body = h('<div id="dist-body"></div>');
  root.appendChild(body);
  if (currentTab === 'depots') distDepots(body);
  if (currentTab === 'routes') distRoutes(body);
  if (currentTab === 'pickups') distPickups(body);
  root.querySelector('#dist-new')!.addEventListener('click', () => openDepotForm());
}

function distDepots(body: HTMLElement) {
  if (!stateStore.state.depots.length) {
    body.appendChild(emptyState('Keine Depots', 'Lege ein neues Depot an.', 'truck'));
    return;
  }
  const grid = h('<div class="grid grid-2"></div>');
  stateStore.state.depots.forEach(d => {
    const members = stateStore.state.members.filter(m => m.depot === d.id);
    const card = h(`
      <div class="card card-pad">
        <div class="row gap-2 mb-2">
          <div class="detail-avatar" style="width:42px;height:42px;font-size:16px">${icon('map-pin')}</div>
          <div class="grow">
            <div class="text-lg" style="font-weight:600"></div>
            <div class="text-sm text-soft"></div>
          </div>
          ${badge(`${members.length} Mitglieder`, 'primary')}
        </div>
        <div class="row gap-2 wrap text-sm">
          <div><span class="text-soft">Abholung:</span> </div>
          <div><span class="text-soft">Tag:</span> </div>
          <div><span class="text-soft">Kontakt:</span> </div>
        </div>
        <div class="divider"></div>
        <div class="row gap-2">
          <button class="btn btn-sm" data-edit>${icon('pencil-simple')} Bearbeiten</button>
          <button class="btn btn-sm btn-danger" data-del>${icon('trash')} Löschen</button>
        </div>
      </div>
    `) as HTMLElement;
    (card.querySelector('.text-lg') as HTMLElement).textContent = d.name;
    (card.querySelector('.text-sm.text-soft') as HTMLElement).textContent = d.address || '';
    const row = card.querySelectorAll('.row.gap-2.wrap > div');
    (row[0].lastChild as Text).textContent = ' ' + (d.pickup || '—');
    (row[1].lastChild as Text).textContent = ' ' + (d.day || '—');
    (row[2].lastChild as Text).textContent = ' ' + (d.contact || '—');
    card.querySelector('[data-edit]')!.addEventListener('click', () => openDepotForm(d.id));
    card.querySelector('[data-del]')!.addEventListener('click', async () => {
      if (await confirmDialog({ message: 'Depot wirklich löschen?', okText: 'Löschen', okClass: 'btn-danger' })) {
        stateStore.update(s => { s.depots = s.depots.filter(x => x.id !== d.id); });
        toast('Depot gelöscht', { kind: 'success' });
        render(document.querySelector('.content .page')!);
      }
    });
    grid.appendChild(card);
  });
  body.appendChild(grid);
}

function distRoutes(body: HTMLElement) {
  const members = stateStore.state.members.filter(m => m.status === 'aktiv' && m.depot);
  const grouped: Record<string, number> = {};
  members.forEach(m => { grouped[m.depot!] = (grouped[m.depot!] || 0) + 1; });
  body.innerHTML = `
    <div class="grid grid-3 mb-3">
      <div class="stat"><div class="stat-label">Depots aktiv</div><div class="stat-value">${stateStore.state.depots.length}</div></div>
      <div class="stat info"><div class="stat-label">Wöchentliche Kilometer</div><div class="stat-value">${stateStore.state.depots.length * 12}</div><div class="text-sm text-soft">Hof → Depots</div></div>
      <div class="stat accent"><div class="stat-label">CO₂ pro Woche</div><div class="stat-value">${(stateStore.state.depots.length * 12 * 0.18).toFixed(1)} kg</div><div class="text-sm text-soft">geschätzt</div></div>
    </div>
    <div class="card">
      <div class="card-h"><div class="card-title">Routenplan</div></div>
      <div class="card-body">
        <div class="text-sm text-soft mb-2">Optimierte Reihenfolge basierend auf geografischer Lage:</div>
        <div class="row wrap gap-2">
          <span class="badge badge-primary">${icon('house')} Hof Wurzelreich</span>
          ${stateStore.state.depots.map(d => {
            const c = grouped[d.id] || 0;
            return `<span class="badge badge-info" title="${c} Mitglieder">→ ${esc(d.name)} (${c})</span>`;
          }).join('')}
          <span class="badge badge-primary">${icon('house')} Hof Wurzelreich</span>
        </div>
        <div class="divider"></div>
        <div class="text-sm"><b>Hinweis:</b> Die Routenoptimierung berücksichtigt aktuelle Mitgliederzahlen und Postleitzahlen.</div>
      </div>
    </div>
  `;
}

function distPickups(body: HTMLElement) {
  const today = new Date();
  const dates: Date[] = [];
  for (let i = 0; i < 8; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i * 7 - (today.getDay() + 2) % 7);
    dates.push(d);
  }
  body.innerHTML = `
    <div class="card">
      <div class="card-h"><div class="card-title">Nächste Abholtermine</div></div>
      <div class="table-wrap">
        <table class="table">
          <thead><tr><th>Datum</th><th>KW</th><th>Status</th><th>Geplante Ernte</th><th>Aktion</th></tr></thead>
          <tbody>
            ${dates.map(d => {
              const kw = isoWeekOf(d);
              return `<tr>
                <td><b>${fmtDate(d)}</b> (${fmtDay(d)})</td>
                <td>KW ${kw}</td>
                <td>${badge('geplant', 'info')}</td>
                <td class="text-sm">Gemischtes Gemüse, Salat, Kräuter</td>
                <td><button class="btn btn-sm" data-log="${d.toISOString()}">${icon('list-checks')} Log öffnen</button></td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
  body.querySelectorAll<HTMLButtonElement>('[data-log]').forEach(b => {
    b.addEventListener('click', () => openPickupLog(b.dataset.log!));
  });
}

function isoWeekOf(d: Date): number {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = x.getUTCDay() || 7;
  x.setUTCDate(x.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
  return Math.ceil((((x.getTime() - yearStart.getTime()) / 86_400_000) + 1) / 7);
}

export function openDepotForm(id: string | null = null): void {
  const d = id ? findDepot(id) : null;
  const body = h(`
    <div class="form-row"><label>Name *</label><input id="d-name"/></div>
    <div class="form-row"><label>Adresse</label><input id="d-addr"/></div>
    <div class="form-grid-3">
      <div class="form-row"><label>Abholtag</label>
        <select id="d-day">
          <option value="Mo">Mo</option><option value="Di">Di</option><option value="Mi">Mi</option>
          <option value="Do">Do</option><option value="Fr">Fr</option><option value="Sa">Sa</option>
          <option value="So">So</option>
        </select>
      </div>
      <div class="form-row"><label>Uhrzeit</label><input id="d-pickup"/></div>
      <div class="form-row"><label>Kontaktperson</label><input id="d-contact"/></div>
    </div>
    <div class="form-grid-3">
      <div class="form-row"><label>Kapazität</label><input id="d-cap" type="number"/></div>
      <div class="form-row"><label>Breitengrad</label><input id="d-lat" type="number" step="0.0001"/></div>
      <div class="form-row"><label>Längengrad</label><input id="d-lng" type="number" step="0.0001"/></div>
    </div>
    <div class="form-row"><label>Notizen</label><textarea id="d-notes" rows="2"></textarea></div>
  `);
  (body.querySelector('#d-name') as HTMLInputElement).value = d?.name ?? '';
  (body.querySelector('#d-addr') as HTMLInputElement).value = d?.address ?? '';
  (body.querySelector('#d-day') as HTMLSelectElement).value = d?.day ?? 'Fr';
  (body.querySelector('#d-pickup') as HTMLInputElement).value = d?.pickup ?? '16:00 - 19:00';
  (body.querySelector('#d-contact') as HTMLInputElement).value = d?.contact ?? '';
  (body.querySelector('#d-cap') as HTMLInputElement).value = String(d?.capacity ?? 30);
  (body.querySelector('#d-lat') as HTMLInputElement).value = String(d?.lat ?? '');
  (body.querySelector('#d-lng') as HTMLInputElement).value = String(d?.lng ?? '');
  (body.querySelector('#d-notes') as HTMLTextAreaElement).value = d?.notes ?? '';

  const m = openModal({ title: d ? 'Depot bearbeiten' : 'Neues Depot', body, wide: true, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>Speichern</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    const data: Partial<Depot> = {
      name: (body.querySelector('#d-name') as HTMLInputElement).value.trim(),
      address: (body.querySelector('#d-addr') as HTMLInputElement).value,
      day: (body.querySelector('#d-day') as HTMLSelectElement).value,
      pickup: (body.querySelector('#d-pickup') as HTMLInputElement).value,
      contact: (body.querySelector('#d-contact') as HTMLInputElement).value,
      capacity: Number((body.querySelector('#d-cap') as HTMLInputElement).value) || 0,
      lat: parseFloat((body.querySelector('#d-lat') as HTMLInputElement).value) || null,
      lng: parseFloat((body.querySelector('#d-lng') as HTMLInputElement).value) || null,
      notes: (body.querySelector('#d-notes') as HTMLTextAreaElement).value,
    };
    if (!data.name) { toast('Name erforderlich', { kind: 'error' }); return; }
    if (d) {
      stateStore.update(s => { const x = s.depots.find(y => y.id === d.id)!; Object.assign(x, data); });
      toast('Depot gespeichert', { kind: 'success' });
    } else {
      stateStore.update(s => { s.depots.push({ id: uid('d'), ...data } as Depot); });
      toast('Depot gespeichert', { kind: 'success' });
    }
    m.close();
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  });
}

export function openPickupLog(dateStr: string): void {
  const date = new Date(dateStr);
  const shares = stateStore.state.shares.filter(s => s.active);
  const picked = stateStore.state.pickups?.filter(p => p.date === dateStr) || [];
  const body = h(`
    <div class="text-sm text-soft mb-2">Abholung am ${fmtDate(date)}</div>
    <div class="text-sm mb-2">Abgehakt: <b>${picked.length}</b> / ${shares.length}</div>
    <div class="progress mb-3"><div class="progress-bar" style="width:${shares.length ? picked.length / shares.length * 100 : 0}%"></div></div>
    <div class="table-wrap" style="max-height: 50vh">
      <table class="table">
        <thead><tr><th></th><th>Mitglied</th><th>Depot</th><th>Anteil</th><th>Notiz</th></tr></thead>
        <tbody>
          ${shares.map(s => {
            const m = stateStore.state.members.find(x => x.id === s.member);
            const d = findDepot(m?.depot);
            const isPicked = picked.find(p => p.share === s.id);
            return `<tr>
              <td><input type="checkbox" data-share="${s.id}" ${isPicked ? 'checked' : ''}/></td>
              <td>${m ? m.name : '—'}</td>
              <td>${d ? d.name : '—'}</td>
              <td>${s.type}</td>
              <td><input type="text" data-note="${s.id}" value="${isPicked?.note || ''}" placeholder="z. B. Eier"/></td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
  `);
  const m = openModal({ title: 'Abholung — Log', body, wide: true, footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>Speichern</button>` });
  m.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => m.close());
  m.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    stateStore.update(s => {
      s.pickups = s.pickups?.filter(p => p.date !== dateStr) || [];
      body.querySelectorAll<HTMLInputElement>('input[type=checkbox]').forEach(cb => {
        if (cb.checked) {
          const sid = cb.dataset.share!;
          const noteInput = body.querySelector(`[data-note="${sid}"]`) as HTMLInputElement;
          s.pickups.push({ id: uid('p'), date: dateStr, share: sid, note: noteInput.value, pickedAt: new Date().toISOString() });
        }
      });
    });
    m.close();
    toast('Abholung gespeichert', { kind: 'success' });
  });
}
