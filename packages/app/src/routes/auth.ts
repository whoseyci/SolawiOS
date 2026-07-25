import type { App } from '../app.js';
import { requireAuth } from '../app.js';

export function authRoutes(app: App): void {
  /**
   * Registration creates a person, not a farm. One human, one login, many farms —
   * which is what makes the instance genuinely multi-tenant for people who are
   * members of more than one Solawi.
   */
  app.post('/api/auth/register', async (c) => {
    const body = await c.req.json<{ email: string; password: string; displayName: string; locale?: string }>();
    if (!body.email || !body.password || !body.displayName) {
      return c.json({ error: 'missing_fields' }, 400);
    }
    try {
      const person = await c.get('auth').register(body);
      const token = await c.get('auth').openSession(person.id, c.req.header('user-agent'));
      return c.json({ person, token }, 201);
    } catch (err) {
      const code = err instanceof Error && 'code' in err ? (err as { code: string }).code : 'error';
      return c.json({ error: code }, 400);
    }
  });

  app.post('/api/auth/login', async (c) => {
    const { email, password } = await c.req.json<{ email: string; password: string }>();
    const result = await c.get('auth').login(email ?? '', password ?? '', c.req.header('user-agent'));
    // Identical response for unknown account and wrong password.
    if (!result) return c.json({ error: 'invalid_credentials' }, 401);

    c.header('Set-Cookie',
      `solawi_session=${result.token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${30 * 86400}`);
    return c.json(result);
  });

  app.post('/api/auth/logout', async (c) => {
    const auth = c.req.header('authorization');
    if (auth?.startsWith('Bearer ')) await c.get('auth').logout(auth.slice(7));
    c.header('Set-Cookie', 'solawi_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
    return c.json({ ok: true });
  });

  /** Who am I, and which farms can I switch to? */
  app.get('/api/auth/me', async (c) => {
    const person = requireAuth(c);
    const orgs = await c.get('kernel').orgsFor(person.id);
    return c.json({
      person,
      orgs: orgs.map((o) => ({
        id: o.id, slug: o.slug, name: o.name, phase: o.phase,
        roles: (o.roles ?? '').split(',').filter(Boolean),
      })),
    });
  });
}
