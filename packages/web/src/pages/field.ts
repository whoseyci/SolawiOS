import { el, mount, sheet, toast, spinner, emptyIcon } from '../lib/ui.js';
import { icon, iconMarkup } from '../lib/icon.js';
import { t, fmt } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';

interface Bed { id: string; name: string; field_id: string; area_sqm: number | null }
interface Planting {
  id: string; bed_id: string; crop_name: string; family: string;
  phase: 'growing' | 'harvestable' | 'finished' | 'future';
  harvest_from: string | null; variety: string | null;
}

/**
 * THE FIELD VIEW with the time slider.
 *
 * The slider is the reason this screen exists: the plot on any day, backwards
 * and forwards. One request per day change, and beds re-colour in place.
 */
export function renderField(root: HTMLElement): void {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const today = new Date();
  let offset = 0; // days from today; range covers a season either way

  const dateLabel = el('strong', {}, t('field.today'));
  const grid = el('div', { class: 'bedgrid' }, spinner());
  const staleBanner = el('div', { class: 'banner banner-offline', style: 'display:none' }, t('common.stale'));

  const slider = el('input', {
    type: 'range', min: -180, max: 180, value: 0, class: 'slider',
    'aria-label': t('field.timeHint'),
  }) as HTMLInputElement;

  let debounce: number | undefined;
  slider.addEventListener('input', () => {
    offset = Number(slider.value);
    const d = new Date(today); d.setDate(d.getDate() + offset);
    dateLabel.textContent = offset === 0 ? t('field.today') : fmt.date(d);
    window.clearTimeout(debounce);
    debounce = window.setTimeout(() => void load(), 180);
  });

  let beds: Bed[] = [];

  async function load(): Promise<void> {
    const d = new Date(today); d.setDate(d.getDate() + offset);
    try {
      const [bedRes, plantRes] = await Promise.all([
        get<{ beds: Bed[] }>('/api/land/beds'),
        get<{ plantings: Planting[] }>(`/api/cultivation/plantings?date=${iso(d)}`),
      ]);
      beds = bedRes.data.beds;
      staleBanner.style.display = bedRes.stale || plantRes.stale ? 'block' : 'none';

      if (beds.length === 0) {
        mount(grid, emptyIcon(iconMarkup('plant', 40), t('field.noBeds'),
          el('button', { class: 'btn btn-primary', onclick: setupSheet }, t('field.addField'))));
        return;
      }

      const byBed = new Map<string, Planting>();
      for (const p of plantRes.data.plantings) if (p.phase !== 'finished') byBed.set(p.bed_id, p);

      mount(grid, ...beds.map((b) => {
        const p = byBed.get(b.id);
        const cls = p ? p.phase : 'free';
        return el('button', {
          class: `bed ${cls}`,
          onclick: () => bedSheet(b, p),
        },
          el('span', { class: 'name' }, b.name),
          el('span', { class: 'crop' }, p ? p.crop_name : t('field.free')),
        );
      }));
    } catch {
      mount(grid, el('div', { class: 'banner banner-error' }, t('common.error')));
    }
  }

  /** Tap a bed → record an observation in one tap. The core field interaction. */
  function bedSheet(bed: Bed, planting?: Planting): void {
    const activities: Array<[string, string]> = [
      ['weeding', t('obs.weeding')], ['watering', t('obs.watering')],
      ['harvest', t('obs.harvest')], ['mulching', t('obs.mulching')],
      ['sowing', t('obs.sowing')], ['planting', t('obs.planting')],
    ];
    const amount = el('input', { type: 'number', inputmode: 'decimal', step: '0.1', min: '0' }) as HTMLInputElement;
    const rhythmBox = el('p', { class: 'muted' }, '');

    const body = el('div', {},
      planting && el('p', { class: 'muted' },
        `${planting.crop_name}${planting.variety ? ` · ${planting.variety}` : ''} · ${t(`field.phase.${planting.phase}`)}`),
      rhythmBox,
      el('div', { class: 'grid2', style: 'margin:1rem 0' },
        ...activities.map(([key, label]) =>
          el('button', {
            class: 'btn btn-lg',
            onclick: () => void record(key, label),
          }, label)),
      ),
      el('div', { class: 'field' },
        el('label', {}, `${t('obs.amount')} (kg) — ${t('common.optional')}`), amount),
      el('p', { class: 'hint' }, t('obs.privacy')),
    );

    const close = sheet(bed.name, body);

    // Show the actual rhythm for this bed — most farms have never seen it.
    void get<{ meanIntervalDays: number | null }>(
      `/api/observations/rhythm?bedId=${bed.id}&activity=weeding`,
    ).then((r) => {
      rhythmBox.textContent = r.data.meanIntervalDays
        ? `${t('obs.weeding')}: ${t('obs.rhythm', { days: fmt.num(r.data.meanIntervalDays, 1) })}`
        : `${t('obs.weeding')}: ${t('obs.rhythmNone')}`;
    }).catch(() => {});

    async function record(activity: string, label: string): Promise<void> {
      const qty = amount.value ? Number(amount.value) : undefined;
      const res = await post<{ queued?: boolean }>('/api/observations', {
        // Client-generated id makes a replayed sync idempotent.
        id: crypto.randomUUID(),
        bedId: bed.id, activity,
        quantity: qty, unit: qty ? 'kg' : undefined,
        observedAt: new Date().toISOString(),
      }, { queue: true });
      close();
      toast(res?.queued ? t('obs.queued') : `${label} — ${t('obs.saved')}`, res?.queued ? 'warn' : 'ok');
    }
  }

  /** First-run: create a field and a grid of beds in one step. */
  function setupSheet(): void {
    const fname = el('input', { type: 'text', value: 'Hauptacker' }) as HTMLInputElement;
    const count = el('input', { type: 'number', value: '20', min: '1', max: '500' }) as HTMLInputElement;
    const len = el('input', { type: 'number', value: '30', min: '1' }) as HTMLInputElement;
    const wid = el('input', { type: 'number', value: '0.75', step: '0.05', min: '0.1' }) as HTMLInputElement;

    const body = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        try {
          const f = await post<{ field: { id: string } }>('/api/land/fields', { name: fname.value });
          await post('/api/land/beds/grid', {
            fieldId: f.field.id, count: Number(count.value),
            lengthM: Number(len.value), widthM: Number(wid.value),
          });
          close(); void load();
        } catch { toast(t('common.error'), 'error'); }
      },
    },
      el('div', { class: 'field' }, el('label', {}, t('field.addField')), fname),
      el('div', { class: 'field' }, el('label', {}, t('field.bedCount')), count),
      el('div', { class: 'grid2' },
        el('div', { class: 'field' }, el('label', {}, t('field.length')), len),
        el('div', { class: 'field' }, el('label', {}, t('field.width')), wid),
      ),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('common.save')),
    );
    const close = sheet(t('field.addBeds'), body);
  }

  mount(root,
    staleBanner,
    el('div', { class: 'card' },
      el('div', { class: 'row-between', style: 'margin-bottom:.25rem' },
        dateLabel,
        el('button', {
          class: 'btn btn-ghost', style: 'min-height:32px;padding:.2rem .6rem',
          onclick: () => { slider.value = '0'; slider.dispatchEvent(new Event('input')); },
        }, t('field.today')),
      ),
      slider,
      el('p', { class: 'hint' }, t('field.timeHint')),
    ),
    grid,
  );

  void load();
}
