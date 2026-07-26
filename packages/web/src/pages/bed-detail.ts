import { el, mount, sheet, toast, spinner } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { t, fmt } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';
import { can } from '../lib/session.js';

interface Bed { id: string; name: string; field_id: string; area_sqm: number | null }
interface Planting { crop_name: string; variety: string | null; phase: string; harvest_from: string | null }
interface Task {
  id: string; title: string; activity: string | null;
  urgency: string; board_column: string; est_minutes: number | null;
}

/**
 * Bed detail — opened by tapping a bed on the map.
 *
 * Everything about one piece of ground in one place: what is growing, what
 * needs doing, its rhythm, and one-tap recording. This is where a gardener
 * standing in the field actually works.
 */
export function openBedDetail(bed: Bed, planting: Planting | null, onChange: () => void): void {
  const body = el('div', {}, spinner());
  const close = sheet(bed.name, body);
  void load();

  async function load(): Promise<void> {
    const [tasksRes, rhythmRes] = await Promise.all([
      get<{ tasks: Task[] }>(`/api/tasks/bed/${bed.id}`).catch(() => ({ data: { tasks: [] }, stale: false })),
      get<{ meanIntervalDays: number | null; daysSinceLast: number | null }>(
        `/api/observations/rhythm?bedId=${bed.id}&activity=weeding`,
      ).catch(() => ({ data: { meanIntervalDays: null, daysSinceLast: null }, stale: false })),
    ]);
    const tasks = tasksRes.data.tasks;
    const rhythm = rhythmRes.data;

    mount(body,
      // --- what is growing
      el('div', { class: 'detail-block' },
        planting
          ? el('div', {},
              el('div', { class: 'row-between' },
                el('div', {},
                  el('strong', { class: 'crop-name' }, planting.crop_name),
                  planting.variety && el('span', { class: 'muted' }, ` · ${planting.variety}`),
                ),
                el('span', { class: `chip chip-${planting.phase}` }, t(`field.phase.${planting.phase}`)),
              ),
              planting.harvest_from && el('div', { class: 'muted' },
                `${t('cultivation.harvestWindow')}: ${fmt.date(planting.harvest_from)}`),
            )
          : el('div', { class: 'muted row' }, el('span', { html: icon('seedling', 18) }), t('field.free')),
        bed.area_sqm && el('div', { class: 'muted' }, `${fmt.num(bed.area_sqm, 1)} m²`),
      ),

      // --- one-tap recording, the most frequent action in the field
      el('div', { class: 'detail-block' },
        el('h3', {}, t('obs.record')),
        el('div', { class: 'action-grid' },
          ...([
            ['weeding', 'scissors'], ['watering', 'drop'], ['harvest', 'basket'],
            ['mulching', 'stack'], ['sowing', 'seedling'], ['planting', 'plant'],
          ] as Array<[string, string]>).map(([act, ic]) =>
            el('button', {
              class: 'action-btn',
              onclick: () => void record(act),
            }, el('span', { html: icon(ic, 22) }), el('span', {}, t(`obs.${act}`))),
          ),
        ),
        el('p', { class: 'hint' }, t('obs.privacy')),
      ),

      // --- rhythm: most farms have never seen this number
      rhythm.meanIntervalDays !== null && el('div', { class: 'detail-block' },
        el('div', { class: 'row-between' },
          el('span', { class: 'muted' }, t('obs.rhythm.title')),
          el('strong', {}, t('obs.rhythm', { days: fmt.num(rhythm.meanIntervalDays, 1) })),
        ),
      ),

      // --- tasks on this bed
      el('div', { class: 'detail-block' },
        el('div', { class: 'row-between' },
          el('h3', {}, t('tasks.title')),
          can('grower') && el('button', {
            class: 'btn btn-sm', onclick: addTask,
          }, el('span', { html: icon('plus', 14) }), t('tasks.add')),
        ),
        tasks.length === 0
          ? el('p', { class: 'muted' }, t('tasks.none'))
          : el('div', { class: 'stack-sm' }, ...tasks.map(taskRow)),
      ),
    );

    function taskRow(task: Task): HTMLElement {
      return el('div', { class: 'task-row' },
        el('span', { class: `urgency urgency-${task.urgency}` }),
        el('div', { style: 'flex:1' },
          el('div', {}, task.title),
          el('div', { class: 'muted' },
            [t(`board.${task.board_column}`), task.est_minutes && `${task.est_minutes} min`]
              .filter(Boolean).join(' · ')),
        ),
        el('button', {
          class: 'icon-btn', title: t('tasks.done'),
          onclick: async () => {
            await post(`/api/tasks/${task.id}/move`, { column: 'done' }, { queue: true });
            toast(t('obs.saved')); await load(); onChange();
          },
        }, el('span', { html: icon('check', 18) })),
      );
    }
  }

  async function record(activity: string): Promise<void> {
    const res = await post<{ queued?: boolean }>('/api/observations', {
      id: crypto.randomUUID(), bedId: bed.id, activity,
      observedAt: new Date().toISOString(),
    }, { queue: true });
    toast(res?.queued ? t('obs.queued') : t('obs.saved'), res?.queued ? 'warn' : 'ok');
    await load();
  }

  function addTask(): void {
    const title = el('input', { type: 'text', required: true }) as HTMLInputElement;
    const activity = el('select', {},
      ...['weeding', 'watering', 'harvest', 'mulching', 'sowing', 'planting']
        .map((a) => el('option', { value: a }, t(`obs.${a}`))),
    ) as HTMLSelectElement;
    const urgency = el('select', {},
      ...['soft', 'firm', 'hard'].map((u) => el('option', { value: u }, t(`tasks.urgency.${u}`))),
    ) as HTMLSelectElement;

    const form = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        await post('/api/tasks', {
          title: title.value, activity: activity.value,
          urgency: urgency.value, bedId: bed.id,
        }, { queue: true });
        closeInner(); toast(t('obs.saved')); await load(); onChange();
      },
    },
      el('div', { class: 'field' }, el('label', {}, t('tasks.add')), title),
      el('div', { class: 'field' }, el('label', {}, t('obs.record')), activity),
      el('div', { class: 'field' }, el('label', {}, t('tasks.urgencyLabel')), urgency),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('common.save')),
    );
    const closeInner = sheet(`${t('tasks.add')} — ${bed.name}`, form);
  }

  void close;
}
