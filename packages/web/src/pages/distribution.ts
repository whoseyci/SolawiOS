import { el, mount, sheet, toast, spinner, emptyIcon } from '../lib/ui.js';
import { icon, iconMarkup } from '../lib/icon.js';
import { t, fmt } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';
import { can } from '../lib/session.js';

interface Day { id: string; date: string; note: string | null; status: string }
interface Sheet {
  day: Day;
  items: Array<{ label: string; qty_full: number | null; qty_half: number | null; unit: string }>;
  pickups: Array<{
    household_id: string; household_name: string; status: string;
    absent: boolean; substitute_household_id: string | null;
  }>;
  counts: { expected: number; collected: number; absent: number; donated: number };
}

/** Distribution: the list a depot caretaker ticks off, absences included. */
export function renderDistribution(root: HTMLElement): void {
  const box = el('div', {}, spinner());
  mount(root, box);

  void (async () => {
    try {
      const { data } = await get<{ days: Day[] }>('/api/distribution/days');
      if (data.days.length === 0) {
        mount(box, emptyIcon(iconMarkup('package', 40), t('dist.none'),
          can('grower') ? el('button', { class: 'btn btn-primary', onclick: newDay }, t('dist.new')) : undefined));
        return;
      }
      mount(box,
        can('grower') && el('button', {
          class: 'btn btn-primary btn-block', style: 'margin-bottom:.75rem', onclick: newDay,
        }, t('dist.new')),
        ...data.days.map((d) => el('button', {
          class: 'card', style: 'width:100%;text-align:left;cursor:pointer',
          onclick: () => openDay(d.id),
        },
          el('div', { class: 'row-between' },
            el('strong', {}, fmt.date(d.date)),
            el('span', { class: 'badge' }, d.status),
          ),
          d.note && el('div', { class: 'muted' }, d.note),
        )),
      );
    } catch {
      mount(box, el('div', { class: 'banner banner-error' }, t('common.error')));
    }
  })();

  async function openDay(id: string): Promise<void> {
    const body = el('div', {}, spinner());
    const close = sheet(t('dist.title'), body);
    try {
      const { data } = await get<Sheet>(`/api/distribution/days/${id}`);
      mount(body,
        el('div', { class: 'row', style: 'flex-wrap:wrap;gap:.4rem;margin-bottom:.75rem' },
          el('span', { class: 'badge' }, `${data.counts.collected} ${t('dist.collected')}`),
          el('span', { class: 'badge badge-warn' }, `${data.counts.expected} ${t('dist.expected')}`),
          data.counts.absent > 0 && el('span', { class: 'badge' }, `${data.counts.absent} ${t('dist.absent')}`),
        ),
        data.items.length > 0 && el('div', { class: 'card' },
          el('h3', {}, t('dist.contents')),
          ...data.items.map((i) => el('div', { class: 'row-between' },
            el('span', {}, i.label),
            el('span', { class: 'muted' },
              `${i.qty_full ?? '–'} / ${i.qty_half ?? '–'} ${i.unit}`),
          )),
        ),
        can('grower') && el('button', {
          class: 'btn btn-block', style: 'margin-bottom:.75rem',
          onclick: () => addItemSheet(id),
        }, t('dist.addItem')),
        el('div', { class: 'stack' },
          ...data.pickups.map((p) => {
            const done = p.status === 'collected';
            return el('div', { class: 'row-between' },
              el('div', {},
                el('div', { style: done ? 'text-decoration:line-through;opacity:.6' : '' }, p.household_name),
                p.absent && el('span', { class: 'badge badge-warn' },
                  p.substitute_household_id ? t('dist.substitute') : t('dist.absent')),
              ),
              can('depot') && el('button', {
                class: `btn ${done ? '' : 'btn-primary'}`,
                style: 'min-height:40px;padding:.3rem .8rem',
                onclick: async () => {
                  await post(`/api/distribution/days/${id}/pickup`, {
                    householdId: p.household_id,
                    status: done ? 'expected' : 'collected',
                  }, { queue: true });
                  close(); void openDay(id);
                },
              }, icon(done ? 'arrow-counter' : 'check', 18)),
            );
          }),
        ),
      );
    } catch {
      mount(body, el('div', { class: 'banner banner-error' }, t('common.error')));
    }
  }

  function newDay(): void {
    const date = el('input', {
      type: 'date', value: new Date().toISOString().slice(0, 10),
    }) as HTMLInputElement;
    const note = el('input', { type: 'text' }) as HTMLInputElement;
    const body = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        await post('/api/distribution/days', { date: date.value, note: note.value || undefined });
        close(); renderDistribution(root);
      },
    },
      el('div', { class: 'field' }, el('label', {}, t('dist.date')), date),
      el('div', { class: 'field' }, el('label', {}, `${t('dist.note')} — ${t('common.optional')}`), note),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('common.save')),
    );
    const close = sheet(t('dist.new'), body);
  }

  function addItemSheet(dayId: string): void {
    const label = el('input', { type: 'text', required: true }) as HTMLInputElement;
    const full = el('input', { type: 'number', step: '0.1' }) as HTMLInputElement;
    const half = el('input', { type: 'number', step: '0.1' }) as HTMLInputElement;
    const body = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        await post(`/api/distribution/days/${dayId}/items`, {
          label: label.value,
          qtyFull: full.value ? Number(full.value) : undefined,
          qtyHalf: half.value ? Number(half.value) : undefined,
        });
        close(); toast(t('obs.saved'));
      },
    },
      el('div', { class: 'field' }, el('label', {}, t('dist.item')), label),
      el('div', { class: 'grid2' },
        el('div', { class: 'field' }, el('label', {}, t('dist.full')), full),
        el('div', { class: 'field' }, el('label', {}, t('dist.half')), half),
      ),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('common.save')),
    );
    const close = sheet(t('dist.addItem'), body);
  }
}
