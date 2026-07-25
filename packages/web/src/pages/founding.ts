import { el, mount, toast, spinner } from '../lib/ui.js';
import { t } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';

interface Milestone {
  id: string; area: string; status: string;
  actionable: boolean; blockedBy: string[]; typicalWeeks: number; pitfalls: string[];
}
interface Progress { total: number; done: number; percent: number }

/**
 * The founding path: a dependency graph, not a linear wizard, because foundings
 * are never linear. Shows what is actionable now and what is waiting on what.
 */
export function renderFounding(root: HTMLElement): void {
  const box = el('div', {}, spinner());
  mount(root, box);

  void (async () => {
    try {
      const { data } = await get<{ milestones: Milestone[]; progress: Progress }>('/api/founding/milestones');
      const actionable = data.milestones.filter((m) => m.actionable);
      const done = data.milestones.filter((m) => m.status === 'done');
      const blocked = data.milestones.filter((m) => !m.actionable && m.status === 'open');

      mount(box,
        el('div', { class: 'card' },
          el('h2', {}, t('founding.progress', { done: data.progress.done, total: data.progress.total })),
          el('div', { style: 'height:10px;background:var(--line);border-radius:999px;overflow:hidden' },
            el('div', {
              style: `height:100%;width:${data.progress.percent}%;background:var(--green-600)`,
            })),
        ),

        actionable.length > 0 && el('div', { class: 'card' },
          el('h2', {}, t('founding.actionable')),
          el('div', { class: 'stack' }, ...actionable.map((m) => row(m, true))),
        ),

        blocked.length > 0 && el('div', { class: 'card' },
          el('h2', {}, t('founding.blocked')),
          el('div', { class: 'stack' }, ...blocked.slice(0, 8).map((m) => row(m, false))),
        ),

        done.length > 0 && el('div', { class: 'card' },
          el('h2', {}, t('founding.done')),
          el('p', { class: 'muted' }, done.map((m) => m.id).join(', ')),
        ),

        el('button', {
          class: 'btn btn-block', style: 'margin-top:1rem',
          onclick: async () => {
            await post('/api/founding/skip', { reason: 'established' });
            toast(t('obs.saved'));
            window.dispatchEvent(new CustomEvent('solawi:modules'));
          },
        }, t('founding.skip')),
      );
    } catch {
      mount(box, el('div', { class: 'banner banner-error' }, t('common.error')));
    }
  })();

  function row(m: Milestone, canAct: boolean): HTMLElement {
    return el('div', { class: 'row-between' },
      el('div', { style: 'flex:1' },
        el('div', { style: 'font-weight:600' }, m.id),
        el('div', { class: 'muted' },
          canAct ? `~${m.typicalWeeks} Wochen` : `${t('founding.blocked')}: ${m.blockedBy.join(', ')}`),
        m.pitfalls.length > 0 && el('span', { class: 'badge badge-warn' }, m.pitfalls.join(' ')),
      ),
      canAct && el('button', {
        class: 'btn',
        onclick: async () => {
          await post(`/api/founding/milestones/${m.id}`, { status: 'done' });
          renderFounding(root);
        },
      }, t('tasks.done')),
    );
  }
}
