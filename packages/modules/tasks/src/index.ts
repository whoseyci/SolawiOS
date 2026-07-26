import type { SolawiModule, ModuleContext, Migration } from '@solawi/kernel';

/**
 * Module 5 — tasks.
 *
 * Two things distinguish this from a generic todo list:
 *  - urgency windows, not deadlines (weeds are soft, harvest is hard)
 *  - the SEQUENCING ASSISTANT (ADR-0008 §5c): tasks have a spatial order, and
 *    getting it wrong costs real work — mulching a bed while the one next to it
 *    is due for planting means you can no longer manoeuvre.
 *
 * Assignment lives here (forward-looking). The completion record goes to
 * `observations`, which has no person column, and the assignee is NOT carried
 * forward. That cut is intentional.
 */

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'tasks: work items with location, window, tool and skill needs',
    statements: [
      `CREATE TABLE IF NOT EXISTS task (
        id             TEXT PRIMARY KEY,
        org_id         TEXT NOT NULL,
        title          TEXT NOT NULL,
        activity       TEXT,
        bed_id         TEXT,
        window_from    TEXT,
        window_to      TEXT,
        urgency        TEXT NOT NULL DEFAULT 'soft',
        est_minutes    INTEGER,
        needs_tool     TEXT,
        needs_skill    TEXT,
        weather_dependent INTEGER NOT NULL DEFAULT 0,
        recurrence_days INTEGER,
        status         TEXT NOT NULL DEFAULT 'open',
        assigned_to    TEXT,
        completed_at   TEXT,
        created_at     TEXT NOT NULL
      )`,
      `CREATE INDEX IF NOT EXISTS idx_task_org_status ON task (org_id, status, window_to)`,
      `CREATE INDEX IF NOT EXISTS idx_task_bed ON task (org_id, bed_id)`,
    ],
  },
  {
    version: 2,
    description: 'tasks: kanban column and manual ordering',
    statements: [
      // `status` already exists; `column` is the board lane, which is not the
      // same thing: a task can be 'open' but parked in 'backlog'.
      `ALTER TABLE task ADD COLUMN board_column TEXT NOT NULL DEFAULT 'backlog'`,
      `ALTER TABLE task ADD COLUMN board_order REAL NOT NULL DEFAULT 0`,
      `CREATE INDEX IF NOT EXISTS idx_task_board ON task (org_id, board_column, board_order)`,
    ],
  },
];

/** Kanban lanes. Deliberately four: more columns invite bookkeeping. */
export const BOARD_COLUMNS = ['backlog', 'ready', 'doing', 'done'] as const;
export type BoardColumn = (typeof BOARD_COLUMNS)[number];

export type Urgency = 'soft' | 'firm' | 'hard';
export type TaskStatus = 'open' | 'in_progress' | 'done' | 'cancelled';

export interface Task {
  id: string; org_id: string; title: string; activity: string | null;
  bed_id: string | null; window_from: string | null; window_to: string | null;
  urgency: Urgency; est_minutes: number | null;
  needs_tool: string | null; needs_skill: string | null;
  weather_dependent: number; recurrence_days: number | null;
  status: TaskStatus; assigned_to: string | null;
  completed_at: string | null; created_at: string;
}

export const tasksModule: SolawiModule = {
  manifest: {
    id: 'tasks',
    number: 5,
    maturity: 'alpha',
    phases: ['operating'],
    suggests: ['land', 'cultivation', 'inventory'],
    migrations: MIGRATIONS,
  },
  register(reg) {
    // A new sowing implies follow-up work; suggest it rather than creating silently.
    reg.on('planting.sown', async () => { /* hook point for auto-derived tasks */ });
  },
};

export async function createTask(
  ctx: ModuleContext,
  input: {
    title: string; activity?: string; bedId?: string;
    windowFrom?: string; windowTo?: string; urgency?: Urgency;
    estMinutes?: number; needsTool?: string; needsSkill?: string;
    weatherDependent?: boolean; recurrenceDays?: number;
  },
): Promise<Task> {
  const id = ctx.platform.crypto.randomUUID();
  const now = ctx.platform.clock.now().toISOString();
  await ctx.store.run(
    `INSERT INTO task
       (id, org_id, title, activity, bed_id, window_from, window_to, urgency, est_minutes,
        needs_tool, needs_skill, weather_dependent, recurrence_days, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      id, ctx.orgId, input.title, input.activity ?? null, input.bedId ?? null,
      input.windowFrom ?? null, input.windowTo ?? null, input.urgency ?? 'soft',
      input.estMinutes ?? null, input.needsTool ?? null, input.needsSkill ?? null,
      input.weatherDependent ? 1 : 0, input.recurrenceDays ?? null, now,
    ],
  );
  return {
    id, org_id: ctx.orgId, title: input.title, activity: input.activity ?? null,
    bed_id: input.bedId ?? null, window_from: input.windowFrom ?? null,
    window_to: input.windowTo ?? null, urgency: input.urgency ?? 'soft',
    est_minutes: input.estMinutes ?? null, needs_tool: input.needsTool ?? null,
    needs_skill: input.needsSkill ?? null, weather_dependent: input.weatherDependent ? 1 : 0,
    recurrence_days: input.recurrenceDays ?? null, status: 'open',
    assigned_to: null, completed_at: null, created_at: now,
  };
}

export async function openTasks(ctx: ModuleContext, onDate?: string): Promise<Task[]> {
  const date = onDate ?? ctx.platform.clock.now().toISOString().slice(0, 10);
  return ctx.store.all<Task>(
    `SELECT * FROM task
      WHERE org_id = ? AND status IN ('open', 'in_progress')
        AND (window_from IS NULL OR window_from <= ?)
      ORDER BY CASE urgency WHEN 'hard' THEN 0 WHEN 'firm' THEN 1 ELSE 2 END,
               COALESCE(window_to, '9999-12-31')`,
    [ctx.orgId, date],
  );
}

/**
 * Complete a task. Writes an `observation` at the BED — deliberately without the
 * assignee, per ADR-0008. The person who did it is not carried into history.
 */
export async function completeTask(
  ctx: ModuleContext,
  input: { taskId: string; minutes?: number; quantity?: number; unit?: string; note?: string },
): Promise<void> {
  const task = await ctx.store.first<Task>(
    `SELECT * FROM task WHERE id = ? AND org_id = ?`, [input.taskId, ctx.orgId],
  );
  if (!task) throw new Error('Unknown task');

  const now = ctx.platform.clock.now().toISOString();
  await ctx.store.run(
    `UPDATE task SET status = 'done', completed_at = ? WHERE id = ? AND org_id = ?`,
    [now, input.taskId, ctx.orgId],
  );

  await ctx.emit('task.completed', {
    taskId: input.taskId,
    bedId: task.bed_id,
    activity: task.activity,
    minutes: input.minutes ?? null,
    quantity: input.quantity ?? null,
    unit: input.unit ?? null,
    note: input.note ?? null,
    // No assignee. See ADR-0008.
  });

  if (task.recurrence_days && task.bed_id) {
    const next = new Date(ctx.platform.clock.now().getTime() + task.recurrence_days * 86_400_000);
    await createTask(ctx, {
      title: task.title,
      activity: task.activity ?? undefined,
      bedId: task.bed_id,
      windowFrom: next.toISOString().slice(0, 10),
      urgency: task.urgency,
      estMinutes: task.est_minutes ?? undefined,
      needsTool: task.needs_tool ?? undefined,
      recurrenceDays: task.recurrence_days,
    });
  }
}

export interface SequencedTask {
  task: Task;
  order: number;
  /** Why it sits here — shown to the user, because unexplained advice is ignored. */
  rationale: string;
}

/** Activities that disturb ground; doing these after planting wastes the planting. */
const DISTURBING = new Set(['soil_work', 'mulching', 'fertilising', 'clearing', 'weeding']);
/** Activities that establish something which must not be walked over afterwards. */
const ESTABLISHING = new Set(['planting', 'sowing']);

/**
 * THE SEQUENCING ASSISTANT.
 *
 * Given the tasks due, propose an order that
 *   1. does disturbing work before establishing work on the same or adjacent bed,
 *   2. groups by required tool to avoid fetching the same thing repeatedly,
 *   3. respects hard urgency windows above all.
 *
 * It SUGGESTS. It never assigns, and never to a named person (AGENTS.md §3.7, §3.12).
 */
export async function suggestSequence(
  ctx: ModuleContext,
  opts: { onDate?: string; adjacency?: Record<string, string[]> } = {},
): Promise<SequencedTask[]> {
  const tasks = await openTasks(ctx, opts.onDate);
  const adjacency = opts.adjacency ?? {};

  const scored = tasks.map((task) => {
    let score = 0;
    const reasons: string[] = [];

    if (task.urgency === 'hard') { score -= 1000; reasons.push('hartes Zeitfenster'); }
    else if (task.urgency === 'firm') { score -= 500; reasons.push('festes Zeitfenster'); }

    const activity = task.activity ?? '';
    if (DISTURBING.has(activity)) {
      score -= 100;
      reasons.push('bodenstörende Arbeit — vor Pflanzungen erledigen');
    }
    if (ESTABLISHING.has(activity)) {
      score += 100;
      reasons.push('Pflanzung — zuletzt, damit vorher frei rangiert werden kann');
    }

    // If a neighbouring bed is due for planting, do disturbing work here first.
    if (task.bed_id && DISTURBING.has(activity)) {
      const neighbours = adjacency[task.bed_id] ?? [];
      const neighbourPlanting = tasks.some(
        (t) => t.bed_id && neighbours.includes(t.bed_id) && ESTABLISHING.has(t.activity ?? ''),
      );
      if (neighbourPlanting) {
        score -= 200;
        reasons.push('Nachbarbeet wird bepflanzt — hier vorher arbeiten');
      }
    }

    if (task.weather_dependent) { score -= 50; reasons.push('wetterabhängig'); }

    return { task, score, reasons };
  });

  // Stable sort by score, then group by tool so the same tool is not fetched twice.
  scored.sort((a, b) => (a.score - b.score) || compareTool(a.task, b.task));

  return scored.map((s, i) => ({
    task: s.task,
    order: i + 1,
    rationale: s.reasons.length ? s.reasons.join('; ') : 'keine Einschränkungen',
  }));
}

function compareTool(a: Task, b: Task): number {
  return (a.needs_tool ?? '').localeCompare(b.needs_tool ?? '');
}

export async function assign(ctx: ModuleContext, taskId: string, personId: string | null): Promise<void> {
  await ctx.store.run(
    `UPDATE task SET assigned_to = ? WHERE id = ? AND org_id = ?`, [personId, taskId, ctx.orgId],
  );
}


// ------------------------------------------------------------------ kanban

export interface BoardTask extends Task {
  board_column: BoardColumn;
  board_order: number;
}

/**
 * The board, grouped by lane.
 *
 * `done` is capped: a board that accumulates every completed task since March
 * becomes unreadable and slow, and the history lives in `observations` anyway.
 */
export async function board(
  ctx: ModuleContext, opts: { doneLimit?: number } = {},
): Promise<Record<BoardColumn, BoardTask[]>> {
  const rows = await ctx.store.all<BoardTask>(
    `SELECT * FROM task
      WHERE org_id = ? AND status != 'cancelled'
      ORDER BY board_order, created_at`,
    [ctx.orgId],
  );

  const out: Record<BoardColumn, BoardTask[]> = {
    backlog: [], ready: [], doing: [], done: [],
  };
  for (const t of rows) {
    const col = (BOARD_COLUMNS as readonly string[]).includes(t.board_column)
      ? t.board_column : 'backlog';
    out[col].push(t);
  }
  out.done = out.done.slice(-(opts.doneLimit ?? 20));
  return out;
}

/**
 * Move a card. `beforeId`/`afterId` give the neighbours it was dropped between,
 * so ordering is computed as a midpoint rather than renumbering every row.
 */
export async function moveTask(
  ctx: ModuleContext,
  input: { taskId: string; column: BoardColumn; beforeOrder?: number; afterOrder?: number },
): Promise<void> {
  const before = input.beforeOrder ?? null;
  const after = input.afterOrder ?? null;

  let order: number;
  if (before !== null && after !== null) order = (before + after) / 2;
  else if (before !== null) order = before + 1;
  else if (after !== null) order = after - 1;
  else order = Date.now() / 1000;

  // Dropping into `done` completes the task; dragging it back reopens it.
  const status = input.column === 'done' ? 'done' : 'open';
  const completedAt = input.column === 'done' ? ctx.platform.clock.now().toISOString() : null;

  await ctx.store.run(
    `UPDATE task SET board_column = ?, board_order = ?, status = ?, completed_at = ?
      WHERE id = ? AND org_id = ?`,
    [input.column, order, status, completedAt, input.taskId, ctx.orgId],
  );

  if (input.column === 'done') {
    const task = await ctx.store.first<Task>(
      `SELECT * FROM task WHERE id = ? AND org_id = ?`, [input.taskId, ctx.orgId]);
    if (task) {
      // No assignee in the payload: the completion record is bed-scoped
      // (ADR-0008), and dragging a card must not become person-tracking.
      await ctx.emit('task.completed', {
        taskId: task.id, bedId: task.bed_id, activity: task.activity,
      });
    }
  }
}

export async function tasksForBed(ctx: ModuleContext, bedId: string): Promise<BoardTask[]> {
  return ctx.store.all<BoardTask>(
    `SELECT * FROM task
      WHERE org_id = ? AND bed_id = ? AND status IN ('open', 'in_progress')
      ORDER BY board_order`,
    [ctx.orgId, bedId],
  );
}
