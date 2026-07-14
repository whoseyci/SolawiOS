// Members page
import { h, clear, esc } from '../lib/dom';
import { icon } from '../lib/icons';
import { stateStore, findMember, findDepot, activeShare, shareLabel, fmtDate } from './utils';
import { initials } from '../lib/format';
import { pageH } from '../components/ui/page-h';
import { filterBar, FilterField } from '../components/ui/filter-bar';
import { openModal, confirmDialog } from '../components/ui/modal';
import { toast } from '../components/ui/toast';
import { badge } from '../components/ui/badge';
import { emptyState } from '../components/ui/empty-state';
import { uid } from '../lib/uid';
import { download } from '../lib/download';
import type { Member, ShareType } from '../types';

let filter: { q: string; status: string; depot: string; share: string } = { q: '', status: '', depot: '', share: '' };

export function render(root: HTMLElement): void {
  clear(root);
  root.appendChild(pageH({
    title: 'Mitglieder',
    desc: `${stateStore.state.members.length} gesamt · ${stateStore.state.members.filter(m => m.status === 'aktiv').length} aktiv · ${stateStore.state.members.filter(m => m.status === 'warteliste').length} auf Warteliste`,
    actions: `
      <button class="btn" id="members-export">${icon('download')} CSV Export</button>
      <button class="btn btn-primary" id="members-new">${icon('plus')} Neues Mitglied</button>
    `,
  }));

  const fields: FilterField[] = [
    { type: 'search', id: 'member-search', placeholder: 'Name, Email, Telefon…', onChange: 'window.__search && window.__search(this.value)' },
    {
      type: 'select', id: 'member-status', onChange: 'window.__filterStatus && window.__filterStatus(this.value)',
      options: [
        { value: '', label: 'Alle Status' },
        { value: 'aktiv', label: 'Aktiv' },
        { value: 'pausiert', label: 'Pausiert' },
        { value: 'warteliste', label: 'Warteliste' },
        { value: 'ausgeschieden', label: 'Ausgeschieden' },
      ],
    },
    {
      type: 'select', id: 'member-depot', onChange: 'window.__filterDepot && window.__filterDepot(this.value)',
      options: [{ value: '', label: 'Alle Depots' }, ...stateStore.state.depots.map(d => ({ value: d.id, label: d.name }))],
    },
    {
      type: 'select', id: 'member-share', onChange: 'window.__filterShare && window.__filterShare(this.value)',
      options: [
        { value: '', label: 'Alle Anteile' },
        { value: 'small', label: 'Klein' },
        { value: 'medium', label: 'Mittel' },
        { value: 'large', label: 'Groß' },
      ],
    },
  ];
  const fb = filterBar({ fields, countEl: `<span class="text-sm text-soft" id="member-count"></span>` });
  root.appendChild(fb);

  const list = h('<div class="card"><div id="member-list"></div></div>') as HTMLElement;
  root.appendChild(list);

  // Wire up global handlers
  (window as any).__search = (v: string) => { filter.q = v; renderList(list); };
  (window as any).__filterStatus = (v: string) => { filter.status = v; renderList(list); };
  (window as any).__filterDepot = (v: string) => { filter.depot = v; renderList(list); };
  (window as any).__filterShare = (v: string) => { filter.share = v; renderList(list); };

  root.querySelector('#members-export')!.addEventListener('click', exportMembersCSV);
  root.querySelector('#members-new')!.addEventListener('click', () => openMemberForm());

  renderList(list);
}

function renderList(card: HTMLElement): void {
  let list = stateStore.state.members.slice();
  if (filter.q) list = list.filter(m => (m.name + m.email + m.phone + m.city).toLowerCase().includes(filter.q.toLowerCase()));
  if (filter.status) list = list.filter(m => m.status === filter.status);
  if (filter.depot) list = list.filter(m => m.depot === filter.depot);
  if (filter.share) list = list.filter(m => activeShare(m.id)?.type === filter.share);
  list.sort((a, b) => a.name.localeCompare(b.name, 'de'));
  const countEl = document.getElementById('member-count');
  if (countEl) countEl.textContent = `${list.length} Mitglieder`;

  const container = card.querySelector('#member-list') as HTMLElement;
  if (!list.length) {
    container.innerHTML = '';
    container.appendChild(emptyState('Keine Mitglieder gefunden', 'Lege ein neues Mitglied an oder ändere die Filter.', 'users'));
    return;
  }
  container.innerHTML = list.map(m => {
    const sc: 'primary' | 'warn' | 'info' | 'neutral' = m.status === 'aktiv' ? 'primary' : m.status === 'pausiert' ? 'warn' : m.status === 'warteliste' ? 'info' : 'neutral';
    return `<div class="member-row" data-id="${m.id}">
      <div class="row gap-2"><span class="avatar-sm">${initials(m.name)}</span><div><div class="member-name"></div><div class="member-sub"></div></div></div>
      <div class="text-sm"></div>
      <div class="text-sm"></div>
      <div class="text-sm"></div>
      <div>${badge(m.status, sc)}</div>
      <div class="text-right text-sm text-muted"></div>
    </div>`;
  }).join('');
  // Set text safely
  container.querySelectorAll<HTMLElement>('.member-row').forEach(row => {
    const m = list.find(x => x.id === row.dataset.id)!;
    const sh = activeShare(m.id);
    const depot = findDepot(m.depot);
    row.querySelector('.member-name')!.textContent = m.name;
    row.querySelector('.member-sub')!.textContent = m.email || '';
    row.children[1].textContent = depot?.name ?? '—';
    row.children[2].textContent = sh ? `${shareLabel(sh.type)} (${sh.type})` : '—';
    row.children[3].textContent = m.phone || '';
    row.children[5].textContent = `seit ${fmtDate(m.since)}`;
    row.addEventListener('click', () => openMemberDetail(m.id));
  });
}

export function openMemberForm(id: string | null = null): void {
  const m = id ? findMember(id) : null;
  const sh = m ? activeShare(m.id) : null;
  const body = h(`
    <div class="form-grid">
      <div class="form-row"><label>Name *</label><input id="f-name" value=""/></div>
      <div class="form-row"><label>Status</label>
        <select id="f-status">
          <option value="aktiv">Aktiv</option>
          <option value="pausiert">Pausiert</option>
          <option value="warteliste">Warteliste</option>
          <option value="ausgeschieden">Ausgeschieden</option>
        </select>
      </div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Email</label><input id="f-email" type="email"/></div>
      <div class="form-row"><label>Telefon</label><input id="f-phone"/></div>
    </div>
    <div class="form-grid">
      <div class="form-row"><label>Adresse</label><input id="f-address"/></div>
      <div class="form-row"><label>PLZ / Ort</label><input id="f-city"/></div>
    </div>
    <div class="form-grid-3">
      <div class="form-row"><label>Beitritt</label><input id="f-since" type="date"/></div>
      <div class="form-row"><label>Depot</label>
        <select id="f-depot">
          <option value="">— Kein Depot —</option>
          ${stateStore.state.depots.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-row"><label>Ernteanteil</label>
        <select id="f-share">
          <option value="">— Kein Anteil —</option>
          <option value="small">Klein</option>
          <option value="medium">Mittel</option>
          <option value="large">Groß</option>
        </select>
      </div>
    </div>
    <div class="form-row"><label>Notizen</label><textarea id="f-notes" rows="2"></textarea></div>
    <div class="form-row"><label>Allergien / Unverträglichkeiten (Komma-getrennt)</label><input id="f-allergies"/></div>
  `);
  // Set values
  (body.querySelector('#f-name') as HTMLInputElement).value = m?.name ?? '';
  (body.querySelector('#f-status') as HTMLSelectElement).value = m?.status ?? 'aktiv';
  (body.querySelector('#f-email') as HTMLInputElement).value = m?.email ?? '';
  (body.querySelector('#f-phone') as HTMLInputElement).value = m?.phone ?? '';
  (body.querySelector('#f-address') as HTMLInputElement).value = m?.address ?? '';
  (body.querySelector('#f-city') as HTMLInputElement).value = m?.city ?? '';
  (body.querySelector('#f-since') as HTMLInputElement).value = m?.since ?? '';
  (body.querySelector('#f-depot') as HTMLSelectElement).value = m?.depot ?? '';
  (body.querySelector('#f-share') as HTMLSelectElement).value = sh?.type ?? '';
  (body.querySelector('#f-notes') as HTMLTextAreaElement).value = m?.notes ?? '';
  (body.querySelector('#f-allergies') as HTMLInputElement).value = (m?.allergies ?? []).join(', ');

  const modal = openModal({
    title: m ? `Mitglied bearbeiten: ${m.name}` : 'Neues Mitglied',
    body, wide: true,
    footer: `<button class="btn" data-cancel>Abbrechen</button><button class="btn btn-primary" data-save>${m ? 'Speichern' : 'Anlegen'}</button>`,
  });
  modal.footer!.querySelector('[data-cancel]')!.addEventListener('click', () => modal.close());
  modal.footer!.querySelector('[data-save]')!.addEventListener('click', () => {
    const data: Partial<Member> = {
      name: (body.querySelector('#f-name') as HTMLInputElement).value.trim(),
      status: (body.querySelector('#f-status') as HTMLSelectElement).value as Member['status'],
      email: (body.querySelector('#f-email') as HTMLInputElement).value.trim(),
      phone: (body.querySelector('#f-phone') as HTMLInputElement).value.trim(),
      address: (body.querySelector('#f-address') as HTMLInputElement).value.trim(),
      city: (body.querySelector('#f-city') as HTMLInputElement).value.trim(),
      since: (body.querySelector('#f-since') as HTMLInputElement).value || null,
      depot: (body.querySelector('#f-depot') as HTMLSelectElement).value || null,
      notes: (body.querySelector('#f-notes') as HTMLTextAreaElement).value,
      allergies: (body.querySelector('#f-allergies') as HTMLInputElement).value.split(',').map(s => s.trim()).filter(Boolean),
    };
    if (!data.name) { toast('Name ist erforderlich', { kind: 'error' }); return; }
    let member: Member;
    if (m) {
      Object.assign(m, data);
      member = m;
      toast('Mitglied aktualisiert', { kind: 'success' });
    } else {
      member = { id: uid('m'), ...data, joinedAt: new Date().toISOString() } as Member;
      stateStore.update(s => { s.members.push(member); });
      toast('Mitglied angelegt', { kind: 'success' });
    }
    const shareType = (body.querySelector('#f-share') as HTMLSelectElement).value as ShareType | '';
    const existing = stateStore.state.shares.find(s => s.member === member.id && s.active);
    if (shareType) {
      if (existing) {
        stateStore.update(s => {
          const e = s.shares.find(x => x.id === existing.id)!;
          e.type = shareType;
          e.monthlyPrice = s.meta.sharePrice[shareType];
        });
      } else {
        stateStore.update(s => {
          s.shares.push({
            id: uid('s'), member: member.id, type: shareType, active: true,
            start: data.since || new Date().toISOString(), end: null,
            monthlyPrice: s.meta.sharePrice[shareType],
          });
        });
      }
    } else if (existing) {
      stateStore.update(s => {
        const e = s.shares.find(x => x.id === existing.id)!;
        e.active = false;
        e.end = new Date().toISOString();
      });
    }
    modal.close();
    document.dispatchEvent(new CustomEvent('solawios:refresh'));
  });
}

function openMemberDetail(id: string): void {
  const m: Member = findMember(id)!;
  const sh = activeShare(m.id);
  const depot = findDepot(m.depot);
  const payments = stateStore.state.payments.filter(p => p.member === m.id);
  const totalPaid = payments.filter(p => p.kind === 'beitrag').reduce((a, p) => a + p.amount, 0);
  const month = new Date();
  const monthPay = payments.filter(p => p.kind === 'beitrag' && p.date && p.date.slice(0, 7) === month.toISOString().slice(0, 7)).reduce((a, p) => a + p.amount, 0);
  const expected = sh ? sh.monthlyPrice : 0;
  const orders = stateStore.state.orders.filter(o => o.member === m.id);
  const body = h(`
    <div class="detail-h">
      <div class="detail-avatar"></div>
      <div class="grow">
        <div class="detail-name"></div>
        <div class="detail-meta"></div>
        <div class="detail-meta"></div>
      </div>
      <div id="md-status"></div>
    </div>
    <div class="grid grid-3 mb-3">
      <div class="stat"><div class="stat-label">Ernteanteil</div><div class="stat-value text-lg" id="md-share"></div><div class="text-sm text-soft" id="md-share-sub"></div></div>
      <div class="stat accent"><div class="stat-label">Beitrag bezahlt</div><div class="stat-value text-lg" id="md-paid"></div><div class="text-sm text-soft" id="md-paid-sub"></div></div>
      <div class="stat info"><div class="stat-label">Depot</div><div class="stat-value text-lg" id="md-depot"></div><div class="text-sm text-soft" id="md-depot-sub"></div></div>
    </div>
    <div class="tabs" id="md-tabs"></div>
    <div id="md-body"></div>
  `);
  body.querySelector('.detail-avatar')!.textContent = initials(m.name);
  body.querySelector('.detail-name')!.textContent = m.name;
  body.querySelector('.detail-meta')!.textContent = `${m.email || ''} · ${m.phone || ''}`;
  (body.querySelectorAll('.detail-meta')[1] as HTMLElement).textContent = `${m.address || ''} ${m.city || ''}`;
  const statusTone: 'primary' | 'warn' | 'info' | 'neutral' = m.status === 'aktiv' ? 'primary' : m.status === 'pausiert' ? 'warn' : m.status === 'warteliste' ? 'info' : 'neutral';
  body.querySelector('#md-status')!.innerHTML = badge(m.status, statusTone);
  (body.querySelector('#md-share') as HTMLElement).textContent = sh ? shareLabel(sh.type) : '—';
  (body.querySelector('#md-share-sub') as HTMLElement).textContent = sh ? `${expected} / Monat` : 'Kein aktiver Anteil';
  (body.querySelector('#md-paid') as HTMLElement).textContent = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(totalPaid);
  (body.querySelector('#md-paid-sub') as HTMLElement).textContent = `diesen Monat: ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(monthPay)} / ${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(expected)}`;
  (body.querySelector('#md-depot') as HTMLElement).textContent = depot?.name ?? '—';
  (body.querySelector('#md-depot-sub') as HTMLElement).textContent = depot?.address ?? 'Kein Depot gewählt';

  const tabs = [
    { id: 'hist', label: 'Beiträge & Historie' },
    { id: 'orders', label: 'Bestellungen' },
    { id: 'notes', label: 'Notizen' },
  ];
  const tabsEl = body.querySelector('#md-tabs')!;
  tabs.forEach(t => {
    const el = h(`<div class="tab" data-tab="${t.id}">${t.label}</div>`) as HTMLElement;
    el.addEventListener('click', () => showTab(t.id));
    tabsEl.appendChild(el);
  });
  function showTab(name: string) {
    tabsEl.querySelectorAll<HTMLElement>('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    const target = body.querySelector('#md-body') as HTMLElement;
    clear(target);
    if (name === 'hist') {
      target.innerHTML = `<div class="table-wrap"><table class="table"><thead><tr><th>Datum</th><th>Art</th><th>Beschreibung</th><th class="text-right">Betrag</th></tr></thead>
        <tbody>${payments.sort((a, b) => (b.date || '').localeCompare(a.date || '')).map(p => `<tr>
          <td>${fmtDate(p.date)}</td>
          <td>${p.kind === 'beitrag' ? badge('Beitrag', 'primary') : p.kind === 'ausgabe' ? badge('Ausgabe', 'neutral') : badge('Sonstig', 'info')}</td>
          <td>${esc(p.note || '')}</td>
          <td class="text-right text-mono">${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(p.amount)}</td>
        </tr>`).join('') || '<tr><td colspan="4" class="table-empty">Keine Einträge</td></tr>'}
        </tbody></table></div>
        <div class="mt-3 text-sm text-soft">Aktive Anteile: ${stateStore.state.shares.filter(s => s.member === m.id && s.active).map(s => `${s.type} (${s.monthlyPrice})`).join(', ') || '—'}</div>`;
    } else if (name === 'orders') {
      target.innerHTML = orders.length
        ? `<div class="table-wrap"><table class="table"><thead><tr><th>Datum</th><th>Lieferung</th><th>Status</th><th class="text-right">Betrag</th></tr></thead><tbody>${orders.map(o => `<tr><td>${fmtDate(o.date)}</td><td>${fmtDate(o.delivery)}</td><td>${o.status === 'geliefert' ? badge('geliefert', 'primary') : badge('offen', 'warn')}</td><td class="text-right text-mono">${new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(o.total)}</td></tr>`).join('')}</tbody></table></div>`
        : '<div class="empty-state"><div class="icon"></div><h3>Keine Bestellungen</h3></div>';
    } else {
      target.innerHTML = `
        <div class="form-row"><label>Notizen</label><textarea id="md-notes" rows="6"></textarea></div>
        <button class="btn btn-primary" id="md-save-notes">${icon('floppy-disk')} Speichern</button>
      `;
      const ta = target.querySelector('#md-notes') as HTMLTextAreaElement;
      ta.value = m.notes || '';
      target.querySelector('#md-save-notes')!.addEventListener('click', () => {
        stateStore.update(s => { const x = s.members.find(y => y.id === m.id); if (x) x.notes = ta.value; });
        toast('Notizen gespeichert', { kind: 'success' });
      });
    }
  }
  showTab('hist');

  const modal = openModal({ title: 'Mitglied', body, wide: true });
  // Add edit/delete footer buttons
  const editBtn = h(`<button class="btn" data-edit>${icon('pencil-simple')} Bearbeiten</button>`) as HTMLElement;
  const delBtn = h(`<button class="btn btn-danger" data-del>${icon('trash')} Löschen</button>`) as HTMLElement;
  editBtn.addEventListener('click', () => { modal.close(); openMemberForm(m.id); });
  delBtn.addEventListener('click', async () => {
    if (await confirmDialog({ message: `Mitglied "${m.name}" wirklich löschen?`, okText: 'Löschen', okClass: 'btn-danger' })) {
      stateStore.update(s => {
        s.members = s.members.filter(x => x.id !== m.id);
        s.shares = s.shares.filter(x => x.member !== m.id);
      });
      modal.close();
      toast('Mitglied gelöscht', { kind: 'success' });
      document.dispatchEvent(new CustomEvent('solawios:refresh'));
    }
  });
  // We need a footer. If modal has none, add one.
  let footer = modal.footer;
  if (!footer) {
    const f = h('<div class="modal-footer modal-f"></div>') as HTMLElement;
    f.append(delBtn, editBtn);
    modal.root.querySelector('.modal')!.appendChild(f);
  } else {
    footer.append(delBtn, editBtn);
  }
}

function exportMembersCSV(): void {
  const rows: string[][] = [['Name', 'Status', 'Email', 'Telefon', 'Adresse', 'PLZ/Ort', 'Depot', 'Anteil', 'Beitritt', 'Beitrag/Monat']];
  for (const m of stateStore.state.members) {
    const s = activeShare(m.id);
    const d = findDepot(m.depot);
    rows.push([m.name, m.status, m.email || '', m.phone || '', m.address || '', m.city || '', d?.name || '', s?.type || '', m.since || '', String(s?.monthlyPrice || '')]);
  }
  download('mitglieder.csv', rows.map(r => r.map(x => `"${String(x).replace(/"/g, '""')}"`).join(';')).join('\n'), 'text/csv');
}
