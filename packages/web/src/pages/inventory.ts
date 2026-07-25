import { el, mount, sheet, toast, spinner, empty } from '../lib/ui.js';
import { t } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';
import { ctx } from '../lib/session.js';

interface Item {
  id: string; name: string; kind: string; home_location: string | null;
  condition: string; holder: string | null; days_out: number | null; service_due: boolean;
}

/** Tools: where is it, who has it, what needs servicing. */
export function renderInventory(root: HTMLElement): void {
  const box = el('div', {}, spinner());
  mount(root, box);

  async function load(): Promise<void> {
    try {
      const { data } = await get<{ items: Item[] }>('/api/inventory');
      if (data.items.length === 0) {
        mount(box, empty('\u{1F527}', t('inv.none'),
          el('button', { class: 'btn btn-primary', onclick: addSheet }, t('inv.add'))));
        return;
      }
      const out = data.items.filter((i) => i.holder);
      mount(box,
        el('button', { class: 'btn btn-primary btn-block', style: 'margin-bottom:.75rem', onclick: addSheet },
          t('inv.add')),
        out.length > 0 && el('div', { class: 'card' },
          el('h2', {}, t('inv.outNow')),
          ...out.map((i) => el('div', { class: 'row-between' },
            el('span', {}, i.name, ' — ', el('span', { class: 'muted' }, i.holder!)),
            // A gentle nudge, not an accusation.
            i.days_out !== null && i.days_out > 10
              ? el('span', { class: 'badge badge-warn' }, t('inv.daysOut', { n: i.days_out }))
              : el('span', { class: 'muted' }, t('inv.daysOut', { n: i.days_out ?? 0 })),
          )),
        ),
        el('div', { class: 'stack' }, ...data.items.map(card)),
      );
    } catch {
      mount(box, el('div', { class: 'banner banner-error' }, t('common.error')));
    }
  }

  function card(i: Item): HTMLElement {
    return el('div', { class: 'card' },
      el('div', { class: 'row-between' },
        el('div', { style: 'flex:1' },
          el('h3', {}, i.name),
          el('div', { class: 'row', style: 'gap:.35rem;flex-wrap:wrap' },
            el('span', { class: 'badge' }, t(`inv.kind.${i.kind}`)),
            i.condition !== 'ok' && el('span', { class: 'badge badge-danger' }, t(`inv.cond.${i.condition}`)),
            i.service_due && el('span', { class: 'badge badge-warn' }, t('inv.serviceDue')),
            i.home_location && el('span', { class: 'muted' }, i.home_location),
          ),
        ),
        i.holder
          ? el('button', {
              class: 'btn', onclick: async () => {
                await post(`/api/inventory/${i.id}/return`, {}, { queue: true });
                toast(t('inv.returned')); void load();
              },
            }, t('inv.return'))
          : el('button', {
              class: 'btn btn-primary', onclick: async () => {
                await post(`/api/inventory/${i.id}/borrow`, { holder: ctx().person.displayName }, { queue: true });
                toast(t('inv.borrowed')); void load();
              },
            }, t('inv.borrow')),
      ),
      el('div', { class: 'row', style: 'gap:.4rem;margin-top:.5rem' },
        el('button', {
          class: 'btn btn-ghost', style: 'min-height:36px;font-size:.8rem',
          onclick: async () => {
            await post(`/api/inventory/${i.id}/condition`, { condition: 'broken' });
            toast(t('obs.saved')); void load();
          },
        }, t('inv.reportBroken')),
        el('button', {
          class: 'btn btn-ghost', style: 'min-height:36px;font-size:.8rem',
          onclick: async () => {
            await post(`/api/inventory/${i.id}/service`, {});
            toast(t('obs.saved')); void load();
          },
        }, t('inv.serviced')),
      ),
    );
  }

  function addSheet(): void {
    const name = el('input', { type: 'text', required: true }) as HTMLInputElement;
    const kind = el('select', {},
      ...['tool', 'machine', 'consumable', 'infrastructure', 'seed']
        .map((k) => el('option', { value: k }, t(`inv.kind.${k}`))),
    ) as HTMLSelectElement;
    const loc = el('input', { type: 'text' }) as HTMLInputElement;
    const maint = el('input', { type: 'number', min: '0' }) as HTMLInputElement;

    const body = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        await post('/api/inventory', {
          name: name.value, kind: kind.value, homeLocation: loc.value || undefined,
          maintenanceDays: maint.value ? Number(maint.value) : undefined,
        });
        close(); void load();
      },
    },
      el('div', { class: 'field' }, el('label', {}, t('inv.name')), name),
      el('div', { class: 'field' }, el('label', {}, t('inv.kindLabel')), kind),
      el('div', { class: 'field' }, el('label', {}, `${t('inv.location')} — ${t('common.optional')}`), loc),
      el('div', { class: 'field' }, el('label', {}, `${t('inv.maintenance')} — ${t('common.optional')}`), maint),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('common.save')),
    );
    const close = sheet(t('inv.add'), body);
  }

  void load();
}
