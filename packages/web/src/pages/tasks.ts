import { el, mount, sheet, toast, spinner, empty } from '../lib/ui.js';
import { t } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';

interface Task {
  id: string; title: string; activity: string | null; bed_id: string | null;
  urgency: 'soft' | 'firm' | 'hard'; est_minutes: number | null; needs_tool: string | null;
}
interface Sequenced { task: Task; order: number; rationale: string }

export function renderTasks(root: HTMLElement): void {
  const list = el('div', { class: 'stack' }, spinner());
  let sequenced = false;

  async function load(): Promise<void> {
    try {
      if (sequenced) {
        const { data } = await get<{ sequence: Sequenced[] }>('/api/tasks/sequence');
        if (data.sequence.length === 0) return showEmpty();
        mount(list,
          el('p', { class: 'hint' }, t('tasks.sequenceHint')),
          ...data.sequence.map((s) => card(s.task, s.order, s.rationale)),
        );
      } else {
        const { data } = await get<{ tasks: Task[] }>('/api/tasks');
        if (data.tasks.length === 0) return showEmpty();
        mount(list, ...data.tasks.map((task) => card(task)));
      }
    } catch {
      mount(list, el('div', { class: 'banner banner-error' }, t('common.error')));
    }
  }

  function showEmpty(): void {
    mount(list, empty('\u{2705}', t('tasks.none'),
      el('button', { class: 'btn btn-primary', onclick: addSheet }, t('tasks.add'))));
  }

  function card(task: Task, order?: number, rationale?: string): HTMLElement {
    const badge = task.urgency === 'hard' ? 'badge-danger' : task.urgency === 'firm' ? 'badge-warn' : '';
    return el('div', { class: 'card' },
      el('div', { class: 'row-between' },
        el('div', { style: 'flex:1' },
          el('h3', {}, order ? `${order}. ${task.title}` : task.title),
          el('div', { class: 'row', style: 'gap:.4rem;flex-wrap:wrap' },
            el('span', { class: `badge ${badge}` }, t(`tasks.urgency.${task.urgency}`)),
            task.est_minutes && el('span', { class: 'muted' }, `${task.est_minutes} min`),
            task.needs_tool && el('span', { class: 'muted' }, task.needs_tool),
          ),
          rationale && el('p', { class: 'hint' }, rationale),
        ),
        el('button', {
          class: 'btn btn-primary',
          onclick: async () => {
            await post(`/api/tasks/${task.id}/complete`, {}, { queue: true });
            toast(t('obs.saved'));
            void load();
          },
        }, t('tasks.done')),
      ),
    );
  }

  function addSheet(): void {
    const title = el('input', { type: 'text', required: true }) as HTMLInputElement;
    const activity = el('select', {},
      ...['weeding', 'watering', 'harvest', 'mulching', 'sowing', 'planting']
        .map((a) => el('option', { value: a }, t(`obs.${a}`))),
    ) as HTMLSelectElement;
    const urgency = el('select', {},
      ...(['soft', 'firm', 'hard'] as const).map((u) => el('option', { value: u }, t(`tasks.urgency.${u}`))),
    ) as HTMLSelectElement;

    const body = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        await post('/api/tasks', {
          title: title.value, activity: activity.value, urgency: urgency.value,
        }, { queue: true });
        close(); void load();
      },
    },
      el('div', { class: 'field' }, el('label', {}, t('tasks.add')), title),
      el('div', { class: 'field' }, el('label', {}, t('obs.record')), activity),
      el('div', { class: 'field' }, el('label', {}, t('tasks.urgency.soft')), urgency),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('common.save')),
    );
    const close = sheet(t('tasks.add'), body);
  }

  mount(root,
    el('div', { class: 'row', style: 'margin-bottom:.75rem' },
      el('button', {
        class: 'btn', style: 'flex:1',
        onclick: () => { sequenced = !sequenced; void load(); },
      }, t('tasks.sequence')),
      el('button', { class: 'btn btn-primary', onclick: addSheet }, '+'),
    ),
    list,
  );
  void load();
}
