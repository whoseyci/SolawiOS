import { el, mount, sheet, toast, spinner, empty } from '../lib/ui.js';
import { t, fmt } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';
import { ctx } from '../lib/session.js';
import { renderDiscoverableToggle } from './household.js';

interface Household { id: string; name: string; contact_email: string | null }
interface Neighbours { count: number | null; display: string; radiusKm: number; canConnect: boolean }

export function renderMembers(root: HTMLElement): void {
  const box = el('div', {}, spinner());
  mount(root, box);

  void (async () => {
    try {
      const [hh, eq] = await Promise.all([
        get<{ households: Household[] }>('/api/members/households'),
        get<{ shareEquivalents: number }>(`/api/members/share-equivalents?season=${new Date().getFullYear()}`)
          .catch(() => ({ data: { shareEquivalents: 0 }, stale: false })),
      ]);

      const households = hh.data.households;
      mount(box,
        el('div', { class: 'card' },
          el('div', { class: 'row-between' },
            el('div', {},
              el('h2', {}, t('members.households', { count: households.length })),
              el('p', { class: 'muted' }, t('members.equivalents', { n: fmt.num(eq.data.shareEquivalents, 1) })),
            ),
            el('button', { class: 'btn btn-primary', onclick: addSheet }, '+'),
          ),
        ),
        neighbourCard(),
        households.length === 0
          ? empty('\u{1F465}', t('org.none'))
          : el('div', { class: 'stack' }, ...households.map((h) =>
              el('div', { class: 'card' },
                el('h3', {}, h.name),
                h.contact_email && el('div', { class: 'muted' }, h.contact_email),
              ))),
      );
    } catch {
      mount(box, el('div', { class: 'banner banner-error' }, t('common.error')));
    }
  })();

  /**
   * Neighbour discovery: a RADIUS and a COUNT. No map, no names, no dots
   * (ADR-0007). Coordinates never reach this client.
   */
  function neighbourCard(): HTMLElement {
    const out = el('div', { class: 'muted' }, t('common.loading'));
    const radius = el('select', {},
      ...[1, 2, 5, 10].map((r) => el('option', { value: String(r), selected: r === 5 }, `${r} km`)),
    ) as HTMLSelectElement;

    const connectBtn = el('button', { class: 'btn', style: 'display:none' }, t('members.connect'));

    async function refresh(): Promise<void> {
      const hid = ctx().household?.id;
      if (!hid) { out.textContent = t('household.why'); return; }
      try {
        const { data } = await get<Neighbours>(
          `/api/members/neighbours?householdId=${hid}&radiusKm=${radius.value}`);
        out.textContent = data.count === null
          ? t('members.neighboursFew', { r: data.radiusKm })
          : t('members.neighboursCount', { count: data.count, r: data.radiusKm });
        connectBtn.style.display = data.canConnect ? 'inline-flex' : 'none';
      } catch { out.textContent = t('common.error'); }
    }
    radius.addEventListener('change', () => void refresh());
    connectBtn.addEventListener('click', async () => {
      const hid = ctx().household?.id;
      if (!hid) return;
      try {
        const res = await post<{ sent: number }>('/api/members/connect', {
          fromHouseholdId: hid, radiusKm: Number(radius.value), purpose: 'carpool',
        });
        toast(`${res.sent}`, 'ok');
      } catch { toast(t('common.error'), 'error'); }
    });
    void refresh();

    return el('div', {},
      ctx().household ? renderDiscoverableToggle(ctx().household!.discoverable, () => renderMembers(root)) : null,
      el('div', { class: 'card' },
      el('h2', {}, t('members.neighbours')),
      el('div', { class: 'row', style: 'margin-bottom:.5rem' }, radius, connectBtn),
      out,
      el('p', { class: 'hint' }, t('members.privacy')),
    ));
  }

  function addSheet(): void {
    const name = el('input', { type: 'text', required: true }) as HTMLInputElement;
    const email = el('input', { type: 'email' }) as HTMLInputElement;
    const body = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        await post('/api/members/households', { name: name.value, contactEmail: email.value || undefined });
        close(); renderMembers(root);
      },
    },
      el('div', { class: 'field' }, el('label', {}, t('org.name')), name),
      el('div', { class: 'field' }, el('label', {}, `${t('auth.email')} — ${t('common.optional')}`), email),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('common.save')),
    );
    const close = sheet(t('members.title'), body);
  }
}
