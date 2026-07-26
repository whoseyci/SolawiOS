import { el, mount, sheet, toast, spinner, emptyIcon } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { t, fmt } from '../lib/i18n.js';
import { get, post, ApiError } from '../lib/api.js';

interface Crop {
  id: string; display_name: string; family: string; botanical_name: string;
  days_to_harvest: number | null; rotation_years: number;
}
interface Bed { id: string; name: string }

/**
 * Crops and plantings.
 *
 * Without this the time slider has nothing to show — it was API-only before.
 * The rotation guard surfaces here as a warning the gardener can override,
 * never a block (AGENTS.md §3.7).
 */
export function renderCrops(root: HTMLElement): void {
  const box = el('div', {}, spinner());
  mount(root, box);

  async function load(): Promise<void> {
    try {
      const [{ data: c }, { data: b }] = await Promise.all([
        get<{ crops: Crop[] }>('/api/cultivation/crops'),
        get<{ beds: Bed[] }>('/api/land/beds'),
      ]);

      mount(box,
        el('div', { class: 'row', style: 'gap:.5rem;margin-bottom:.75rem' },
          el('button', { class: 'btn btn-primary', style: 'flex:1', onclick: () => cropSheet(c) },
            t('crops.add')),
          el('button', {
            class: 'btn', style: 'flex:1',
            onclick: () => plantingSheet(c.crops, b.beds),
            disabled: c.crops.length === 0 || b.beds.length === 0,
          }, t('crops.plant')),
        ),
        c.crops.length === 0
          ? emptyIcon(icon('carrot', 40), t('crops.none'))
          : el('div', { class: 'stack' }, ...c.crops.map((crop) => el('div', { class: 'card' },
              el('div', { class: 'row-between' },
                el('div', {},
                  el('h3', {}, crop.display_name),
                  el('div', { class: 'muted' }, crop.botanical_name),
                ),
                el('div', { style: 'text-align:right' },
                  el('span', { class: 'badge' }, crop.family),
                  crop.days_to_harvest && el('div', { class: 'muted' },
                    t('crops.days', { n: crop.days_to_harvest })),
                ),
              ),
            ))),
      );
    } catch {
      mount(box, el('div', { class: 'banner banner-error' }, t('common.error')));
    }
  }

  function cropSheet(_existing: { crops: Crop[] }): void {
    const name = el('input', { type: 'text', required: true }) as HTMLInputElement;
    const botanical = el('input', { type: 'text', required: true }) as HTMLInputElement;
    const family = el('input', { type: 'text', required: true, list: 'families' }) as HTMLInputElement;
    const days = el('input', { type: 'number', min: '1' }) as HTMLInputElement;
    const rotation = el('input', { type: 'number', value: '3', min: '0' }) as HTMLInputElement;

    const body = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        await post('/api/cultivation/crops', {
          displayName: name.value, botanicalName: botanical.value, family: family.value,
          daysToHarvest: days.value ? Number(days.value) : undefined,
          rotationYears: Number(rotation.value),
        });
        close(); void load();
      },
    },
      el('div', { class: 'field' }, el('label', {}, t('crops.name')), name),
      el('div', { class: 'field' }, el('label', {}, t('crops.botanical')), botanical),
      el('div', { class: 'field' }, el('label', {}, t('crops.family')), family,
        el('datalist', { id: 'families' },
          ...['Brassicaceae', 'Apiaceae', 'Solanaceae', 'Fabaceae', 'Asteraceae',
              'Cucurbitaceae', 'Amaranthaceae', 'Alliaceae', 'Poaceae']
            .map((f) => el('option', { value: f }))),
        el('p', { class: 'hint' }, t('crops.familyHint')),
      ),
      el('div', { class: 'grid2' },
        el('div', { class: 'field' }, el('label', {}, t('crops.daysLabel')), days),
        el('div', { class: 'field' }, el('label', {}, t('crops.rotation')), rotation),
      ),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('common.save')),
    );
    const close = sheet(t('crops.add'), body);
  }

  function plantingSheet(crops: Crop[], beds: Bed[]): void {
    const crop = el('select', {}, ...crops.map((c) =>
      el('option', { value: c.id }, c.display_name))) as HTMLSelectElement;
    const bed = el('select', {}, ...beds.map((b) =>
      el('option', { value: b.id }, b.name))) as HTMLSelectElement;
    const date = el('input', {
      type: 'date', value: new Date().toISOString().slice(0, 10),
    }) as HTMLInputElement;
    const variety = el('input', { type: 'text' }) as HTMLInputElement;
    const warnBox = el('div', {});

    async function submit(acknowledge: boolean): Promise<void> {
      try {
        await post('/api/cultivation/plantings', {
          cropId: crop.value, bedId: bed.value, plantedOn: date.value,
          variety: variety.value || undefined,
          acknowledgeRotation: acknowledge,
        });
        close(); toast(t('obs.saved')); void load();
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          const w = (err.payload as { warning?: { reason: string } })?.warning;
          mount(warnBox,
            el('div', { class: 'banner banner-offline' }, w?.reason ?? t('crops.rotationWarn')),
            el('button', {
              class: 'btn btn-block',
              onclick: () => void submit(true),
            }, t('crops.plantAnyway')),
          );
        } else toast(t('common.error'), 'error');
      }
    }

    const body = el('form', {
      onsubmit: (e: Event) => { e.preventDefault(); void submit(false); },
    },
      el('div', { class: 'field' }, el('label', {}, t('crops.crop')), crop),
      el('div', { class: 'field' }, el('label', {}, t('field.bed')), bed),
      el('div', { class: 'field' }, el('label', {}, t('crops.plantedOn')), date),
      el('div', { class: 'field' }, el('label', {}, `${t('crops.variety')} — ${t('common.optional')}`), variety),
      warnBox,
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('crops.plant')),
    );
    const close = sheet(t('crops.plant'), body);
  }

  void load();
}
