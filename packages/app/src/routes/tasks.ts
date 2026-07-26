import type { App } from '../app.js';
import { requireOrg, requireRoleIn } from '../app.js';
import {
  createTask, openTasks, completeTask, suggestSequence, assign,
  board, moveTask, tasksForBed, BOARD_COLUMNS, type BoardColumn,
} from '@solawi/module-tasks';
import { listBeds } from '@solawi/module-land';

export function taskRoutes(app: App): void {
  app.get('/api/tasks', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'tasks', c.get('locale'));
    return c.json({ tasks: await openTasks(ctx, c.req.query('date')) });
  });

  app.post('/api/tasks', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const body = await c.req.json<{
      title: string; activity?: string; bedId?: string;
      windowFrom?: string; windowTo?: string; urgency?: 'soft' | 'firm' | 'hard';
      estMinutes?: number; needsTool?: string; needsSkill?: string;
      weatherDependent?: boolean; recurrenceDays?: number;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'tasks', c.get('locale'));
    return c.json({ task: await createTask(ctx, body) }, 201);
  });

  /**
   * THE SEQUENCING ASSISTANT.
   *
   * Suggests an order: disturbing work before planting, grouped by tool, hard
   * windows first. Adjacency comes from `land` when enabled, so the assistant
   * knows "the bed next door is being planted — do this one first".
   *
   * It suggests. It never assigns to a person (AGENTS.md §3.12).
   */
  app.get('/api/tasks/sequence', async (c) => {
    const { orgId } = requireOrg(c);
    const kernel = c.get('kernel');
    const ctx = kernel.contextFor(orgId, 'tasks', c.get('locale'));

    // Adjacency by field: beds in the same field are treated as neighbours.
    let adjacency: Record<string, string[]> = {};
    const enabled = await kernel.enabledModules(orgId);
    if (enabled.has('land')) {
      const landCtx = kernel.contextFor(orgId, 'land', c.get('locale'));
      const beds = await listBeds(landCtx);
      const byField = new Map<string, string[]>();
      for (const b of beds) {
        byField.set(b.field_id, [...(byField.get(b.field_id) ?? []), b.id]);
      }
      adjacency = Object.fromEntries(
        beds.map((b) => [b.id, (byField.get(b.field_id) ?? []).filter((id) => id !== b.id)]),
      );
    }

    const sequence = await suggestSequence(ctx, { onDate: c.req.query('date'), adjacency });
    return c.json({ sequence });
  });

  /**
   * Complete a task. Emits `task.completed` WITHOUT an assignee — the completion
   * record that feeds analysis is an `observation` at the bed (ADR-0008).
   */
  app.post('/api/tasks/:id/complete', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'member');
    const body = await c.req.json<{ minutes?: number; quantity?: number; unit?: string; note?: string }>();
    const ctx = c.get('kernel').contextFor(orgId, 'tasks', c.get('locale'));
    await completeTask(ctx, { taskId: c.req.param('id'), ...body });
    return c.json({ ok: true });
  });

  app.post('/api/tasks/:id/assign', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'grower');
    const { personId } = await c.req.json<{ personId: string | null }>();
    const ctx = c.get('kernel').contextFor(orgId, 'tasks', c.get('locale'));
    await assign(ctx, c.req.param('id'), personId);
    return c.json({ ok: true });
  });

  // ------------------------------------------------------------------ kanban

  app.get('/api/tasks/board', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'tasks', c.get('locale'));
    return c.json({ board: await board(ctx), columns: BOARD_COLUMNS });
  });

  app.post('/api/tasks/:id/move', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'member');
    const body = await c.req.json<{
      column: BoardColumn; beforeOrder?: number; afterOrder?: number;
    }>();
    const ctx = c.get('kernel').contextFor(orgId, 'tasks', c.get('locale'));
    await moveTask(ctx, { taskId: c.req.param('id'), ...body });
    return c.json({ ok: true });
  });

  /** Tasks attached to one bed — used by the map detail panel. */
  app.get('/api/tasks/bed/:bedId', async (c) => {
    const { orgId } = requireOrg(c);
    const ctx = c.get('kernel').contextFor(orgId, 'tasks', c.get('locale'));
    return c.json({ tasks: await tasksForBed(ctx, c.req.param('bedId')) });
  });
}
