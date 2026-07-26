import { el, mount, sheet, toast, spinner } from '../lib/ui.js';
import { icon } from '../lib/icon.js';
import { t } from '../lib/i18n.js';
import { get, post } from '../lib/api.js';
import { can } from '../lib/session.js';

interface Task {
  id: string; title: string; activity: string | null; bed_id: string | null;
  urgency: 'soft' | 'firm' | 'hard'; est_minutes: number | null;
  needs_tool: string | null; board_column: Column; board_order: number;
}
type Column = 'backlog' | 'ready' | 'doing' | 'done';
const COLUMNS: Column[] = ['backlog', 'ready', 'doing', 'done'];

/**
 * Kanban board.
 *
 * Drag-and-drop uses Pointer Events rather than HTML5 drag-and-drop, because
 * the latter does not work on touch devices — and this is used on a phone in a
 * field more often than on a desktop.
 */
export function renderBoard(root: HTMLElement): void {
  const wrap = el('div', { class: 'board-wrap' }, spinner());
  mount(root, wrap);

  let bedNames = new Map<string, string>();

  void load();

  async function load(): Promise<void> {
    const [boardRes, bedsRes] = await Promise.all([
      get<{ board: Record<Column, Task[]> }>('/api/tasks/board'),
      get<{ beds: Array<{ id: string; name: string }> }>('/api/land/beds')
        .catch(() => ({ data: { beds: [] }, stale: false })),
    ]);
    bedNames = new Map(bedsRes.data.beds.map((b) => [b.id, b.name]));
    render(boardRes.data.board);
  }

  function render(board: Record<Column, Task[]>): void {
    mount(wrap,
      el('div', { class: 'board' },
        ...COLUMNS.map((col) => {
          const list = el('div', { class: 'board-list', 'data-col': col },
            ...(board[col] ?? []).map((task) => card(task)));

          return el('div', { class: `board-col board-col-${col}` },
            el('div', { class: 'board-head' },
              el('span', { class: 'board-title' }, t(`board.${col}`)),
              el('span', { class: 'board-count' }, String((board[col] ?? []).length)),
              col === 'backlog' && can('grower') && el('button', {
                class: 'icon-btn', title: t('tasks.add'), onclick: addTask,
              }, icon('plus', 16)),
            ),
            list,
          );
        }),
      ),
    );
  }

  function card(task: Task): HTMLElement {
    const node = el('article', {
      class: `card-task urgency-left-${task.urgency}`,
      'data-id': task.id, 'data-order': String(task.board_order),
    },
      el('div', { class: 'card-task-title' }, task.title),
      el('div', { class: 'card-task-meta' },
        task.bed_id && bedNames.has(task.bed_id)
          && chip('map', bedNames.get(task.bed_id)!),
        task.est_minutes && chip('clock', `${task.est_minutes} min`),
        task.needs_tool && chip('wrench', task.needs_tool),
        task.urgency === 'hard' && chip('warning', t('tasks.urgency.hard'), 'chip-danger'),
      ),
    );
    makeDraggable(node, task);
    return node;
  }

  const chip = (ic: string, label: string, cls = '') =>
    el('span', { class: `chip ${cls}` }, icon(ic, 12), el('span', {}, label));

  /**
   * Pointer-based dragging: works with a finger, a mouse and a stylus alike.
   * A short press-and-hold threshold avoids hijacking normal scrolling.
   */
  function makeDraggable(node: HTMLElement, task: Task): void {
    let dragging = false;
    let ghost: HTMLElement | null = null;
    let startX = 0, startY = 0;
    let holdTimer: number | undefined;

    node.addEventListener('pointerdown', (e: PointerEvent) => {
      if (e.button !== 0) return;
      startX = e.clientX; startY = e.clientY;

      // Touch needs a hold; a mouse can start immediately on movement.
      const delay = e.pointerType === 'touch' ? 220 : 0;
      holdTimer = window.setTimeout(() => beginDrag(e), delay);

      const cancel = () => {
        window.clearTimeout(holdTimer);
        node.removeEventListener('pointerup', cancel);
      };
      node.addEventListener('pointerup', cancel, { once: true });
    });

    function beginDrag(e: PointerEvent): void {
      dragging = true;
      node.setPointerCapture(e.pointerId);
      node.classList.add('dragging');

      ghost = node.cloneNode(true) as HTMLElement;
      ghost.classList.add('drag-ghost');
      ghost.style.width = `${node.offsetWidth}px`;
      document.body.appendChild(ghost);
      moveGhost(e.clientX, e.clientY);

      node.addEventListener('pointermove', onMove);
      node.addEventListener('pointerup', onUp, { once: true });
      node.addEventListener('pointercancel', onUp, { once: true });
    }

    function onMove(e: PointerEvent): void {
      if (!dragging) return;
      e.preventDefault();
      moveGhost(e.clientX, e.clientY);

      // Highlight the lane under the pointer.
      const target = laneUnder(e.clientX, e.clientY);
      document.querySelectorAll('.board-list').forEach((l) => l.classList.remove('drop-target'));
      target?.classList.add('drop-target');
    }

    async function onUp(e: PointerEvent): Promise<void> {
      if (!dragging) return;
      dragging = false;
      node.classList.remove('dragging');
      ghost?.remove(); ghost = null;
      node.removeEventListener('pointermove', onMove);
      document.querySelectorAll('.board-list').forEach((l) => l.classList.remove('drop-target'));

      const lane = laneUnder(e.clientX, e.clientY);
      const col = lane?.getAttribute('data-col') as Column | undefined;
      const moved = Math.hypot(e.clientX - startX, e.clientY - startY) > 8;
      if (!col || !moved || col === task.board_column) return;

      // Neighbour orders let the server place the card by midpoint instead of
      // renumbering the whole lane.
      const siblings = [...lane!.querySelectorAll('.card-task')] as HTMLElement[];
      const above = siblings.filter((s) => s !== node && s.getBoundingClientRect().top < e.clientY).pop();
      const below = siblings.find((s) => s !== node && s.getBoundingClientRect().top >= e.clientY);

      try {
        await post(`/api/tasks/${task.id}/move`, {
          column: col,
          beforeOrder: above ? Number(above.getAttribute('data-order')) : undefined,
          afterOrder: below ? Number(below.getAttribute('data-order')) : undefined,
        }, { queue: true });
        await load();
      } catch {
        toast(t('common.error'), 'error');
        await load();
      }
    }

    function moveGhost(x: number, y: number): void {
      if (!ghost) return;
      ghost.style.left = `${x - 40}px`;
      ghost.style.top = `${y - 20}px`;
    }
  }

  function laneUnder(x: number, y: number): HTMLElement | null {
    for (const lane of [...document.querySelectorAll('.board-list')] as HTMLElement[]) {
      const r = lane.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return lane;
    }
    return null;
  }

  function addTask(): void {
    const title = el('input', { type: 'text', required: true }) as HTMLInputElement;
    const urgency = el('select', {},
      ...['soft', 'firm', 'hard'].map((u) => el('option', { value: u }, t(`tasks.urgency.${u}`))),
    ) as HTMLSelectElement;
    const minutes = el('input', { type: 'number', min: '5', step: '5' }) as HTMLInputElement;

    const form = el('form', {
      onsubmit: async (e: Event) => {
        e.preventDefault();
        await post('/api/tasks', {
          title: title.value, urgency: urgency.value,
          estMinutes: minutes.value ? Number(minutes.value) : undefined,
        }, { queue: true });
        close(); await load();
      },
    },
      el('div', { class: 'field' }, el('label', {}, t('tasks.add')), title),
      el('div', { class: 'field' }, el('label', {}, t('tasks.urgencyLabel')), urgency),
      el('div', { class: 'field' },
        el('label', {}, `${t('obs.minutes')} — ${t('common.optional')}`), minutes),
      el('button', { class: 'btn btn-primary btn-block', type: 'submit' }, t('common.save')),
    );
    const close = sheet(t('tasks.add'), form);
  }
}
