import type { App } from '../app.js';
import { requireAuth, requireOrg, requireRoleIn } from '../app.js';
import { recommendModules, type SetupAnswers } from '../modules.js';
import { skipFounding } from '@solawi/module-founding';

export function orgRoutes(app: App): void {
  /**
   * Create a farm. The creator becomes owner.
   *
   * `established: true` is the skip path for existing Solawis: the org starts in
   * `operating`, founding milestones are marked not_applicable, and the founding
   * module is never enabled.
   */
  app.post('/api/orgs', async (c) => {
    const person = requireAuth(c);
    const body = await c.req.json<{
      slug: string; name: string; established?: boolean;
      locale?: string; jurisdiction?: string; timezone?: string;
    }>();

    // 2–50 chars, lowercase alphanumeric plus internal hyphens.
    // The middle group is {0,48} so two-character slugs ("cs") are valid.
    if (!/^[a-z0-9][a-z0-9-]{0,48}[a-z0-9]$/.test(body.slug ?? '')) {
      return c.json({ error: 'invalid_slug' }, 400);
    }
    const kernel = c.get('kernel');
    if (await kernel.getOrgBySlug(body.slug)) return c.json({ error: 'slug_taken' }, 409);

    const org = await kernel.createOrg({
      slug: body.slug,
      name: body.name,
      phase: body.established ? 'operating' : 'founding',
      locale: body.locale,
      jurisdiction: body.jurisdiction,
      timezone: body.timezone,
    });
    await c.get('auth').addToOrg(org.id, person.id, ['owner']);

    if (body.established) {
      // Mark milestones not_applicable rather than done: they were never worked
      // through here, and faking them would poison the duration statistics that
      // feed the anonymised commons.
      const ctx = kernel.contextFor(org.id, 'founding', org.locale);
      await skipFounding(ctx, 'established_farm');
    }
    return c.json({ org }, 201);
  });

  app.get('/api/org', async (c) => {
    const { orgId, roles } = requireOrg(c);
    const kernel = c.get('kernel');
    const org = await kernel.getOrg(orgId);
    const enabled = await kernel.enabledModules(orgId);
    return c.json({
      org,
      roles,
      modules: kernel.registry.list().map((m) => ({
        id: m.manifest.id,
        number: m.manifest.number,
        maturity: m.manifest.maturity,
        phases: m.manifest.phases,
        suggests: m.manifest.suggests ?? [],
        enabled: enabled.has(m.manifest.id),
      })),
    });
  });

  /** The five setup questions → a suggested module set, with reasons. */
  app.post('/api/org/setup/recommend', async (c) => {
    requireOrg(c);
    const answers = await c.req.json<SetupAnswers>();
    return c.json({ recommendations: recommendModules(answers) });
  });

  /** Apply a module selection. Disabling never deletes data (docs/40 §3.3). */
  app.post('/api/org/modules', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const { enable = [], disable = [] } = await c.req.json<{ enable?: string[]; disable?: string[] }>();
    const kernel = c.get('kernel');

    for (const id of enable) await kernel.setModuleEnabled(orgId, id, true);
    for (const id of disable) await kernel.setModuleEnabled(orgId, id, false);

    const enabled = await kernel.enabledModules(orgId);
    return c.json({ enabled: [...enabled] });
  });

  app.post('/api/org/phase', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const { phase } = await c.req.json<{ phase: 'founding' | 'operating' | 'developing' }>();
    await c.get('kernel').setPhase(orgId, phase);
    return c.json({ ok: true, phase });
  });

  /** Invite an existing account into this farm. */
  app.post('/api/org/members', async (c) => {
    const { orgId, roles } = requireOrg(c);
    requireRoleIn(roles, 'admin');
    const { email, roles: newRoles } = await c.req.json<{ email: string; roles: string[] }>();

    const kernel = c.get('kernel');
    const person = await kernel.findPersonByEmail(email);
    if (!person) return c.json({ error: 'no_such_person' }, 404);

    await c.get('auth').addToOrg(orgId, person.id, newRoles as never);
    await kernel.audit({
      orgId, personId: c.get('person')?.id, action: 'org.member_added',
      subject: person.id, detail: { roles: newRoles },
    });
    return c.json({ ok: true });
  });
}
