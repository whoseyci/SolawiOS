import type { SolawiModule, ModuleContext, Migration } from '@solawi/kernel';

/**
 * Module 23 — feedback (Fehler melden & Ideen).
 *
 * In-app bug reporting that reaches GitHub Issues, with two hard rules:
 *
 *  1. NOTHING IS SENT WITHOUT A PREVIEW. The reporter sees the exact payload —
 *     in plain language — before it leaves the farm. Same principle as the
 *     anonymised commons in ADR-0007: consent requires knowing what you consent to.
 *
 *  2. NO PERSONAL DATA, NO FARM DATA. We attach the module list, versions and a
 *     redacted route — never member names, bid amounts, coordinates or notes.
 *     A bug report is not a backdoor around ADR-0005/0007/0008.
 *
 * Reports are stored locally first, so they survive a missing/invalid token and
 * can be retried. GitHub is a delivery channel, not the record.
 */

const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    description: 'feedback: locally stored reports with GitHub delivery state',
    statements: [
      `CREATE TABLE IF NOT EXISTS feedback_report (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        kind          TEXT NOT NULL,
        title         TEXT NOT NULL,
        body          TEXT NOT NULL,
        severity      TEXT NOT NULL DEFAULT 'normal',
        context       TEXT NOT NULL DEFAULT '{}',
        reporter_hint TEXT,
        status        TEXT NOT NULL DEFAULT 'pending',
        issue_number  INTEGER,
        issue_url     TEXT,
        error         TEXT,
        attempts      INTEGER NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL,
        delivered_at  TEXT
      )`,
      `CREATE INDEX IF NOT EXISTS idx_feedback_status ON feedback_report (status, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_feedback_org ON feedback_report (org_id, created_at DESC)`,
    ],
  },
];

export type ReportKind = 'bug' | 'idea' | 'question' | 'data_issue';
export type Severity = 'blocker' | 'serious' | 'normal' | 'minor';

export interface DiagnosticContext {
  /** Route where it happened, with ids stripped: /api/land/beds/:id */
  route?: string;
  /** Module the user was in. */
  module?: string;
  appVersion?: string;
  platformFlavour?: string;
  /** Enabled module ids — genuinely useful for reproducing. */
  enabledModules?: string[];
  /** Browser UA string; coarse and not personally identifying. */
  userAgent?: string;
  locale?: string;
  /** Error message and stack, already scrubbed by `redact()`. */
  errorMessage?: string;
  errorStack?: string;
}

export interface ReportInput {
  kind: ReportKind;
  title: string;
  body: string;
  severity?: Severity;
  context?: DiagnosticContext;
  /** Optional and free-text: "Anna vom Anbauteam". Never auto-filled from account data. */
  reporterHint?: string;
}

export const feedbackModule: SolawiModule = {
  manifest: {
    id: 'feedback',
    number: 23,
    maturity: 'alpha',
    phases: ['founding', 'operating', 'developing'],
    migrations: MIGRATIONS,
  },
};

/**
 * Patterns that must never leave the farm. Applied to every free-text field and
 * to stack traces before storage — belt and braces, since a stack trace can
 * easily contain a query with a member's email in it.
 */
const REDACTIONS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.]+/g, '[email]'],
  [/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '[ip]'],
  [/\b[A-Z]{2}\d{2}[A-Z0-9]{10,30}\b/g, '[iban]'],
  [/\b\d{1,2}\.\d{4,}\s*,\s*\d{1,2}\.\d{4,}\b/g, '[coords]'],
  [/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '[id]'],
  [/(Bearer|token|password|secret|apikey|api_key)["'\s:=]+[\w.\-]+/gi, '$1 [redacted]'],
  [/\b\+?\d[\d\s/()-]{8,}\d\b/g, '[phone]'],
];

export function redact(text: string): string {
  let out = text;
  for (const [re, replacement] of REDACTIONS) out = out.replace(re, replacement);
  return out;
}

/** Strip ids from a path so routes group sensibly in GitHub. */
export function redactRoute(route: string): string {
  return route
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '/:id')
    .replace(/\/\d+/g, '/:n');
}

export interface Preview {
  title: string;
  body: string;
  labels: string[];
  /** Exactly what will be transmitted, for the confirmation dialog. */
  willSend: Record<string, unknown>;
  /** Plain-language list, so the preview is readable by non-technical members. */
  explanation: string[];
}

/**
 * Build the report WITHOUT sending it. The UI shows this and asks for
 * confirmation; nothing leaves the farm until `submit()` is called.
 */
export function buildPreview(input: ReportInput, ctx: DiagnosticContext = {}): Preview {
  const title = redact(input.title).slice(0, 120);
  const severity = input.severity ?? 'normal';

  const lines: string[] = [
    redact(input.body),
    '',
    '---',
    '',
    '### Kontext',
    '',
    `| | |`,
    `|---|---|`,
    `| Art | ${input.kind} |`,
    `| Schwere | ${severity} |`,
  ];
  if (ctx.module) lines.push(`| Modul | \`${ctx.module}\` |`);
  if (ctx.route) lines.push(`| Route | \`${redactRoute(ctx.route)}\` |`);
  if (ctx.appVersion) lines.push(`| Version | ${ctx.appVersion} |`);
  if (ctx.platformFlavour) lines.push(`| Plattform | ${ctx.platformFlavour} |`);
  if (ctx.locale) lines.push(`| Sprache | ${ctx.locale} |`);
  if (ctx.enabledModules?.length) lines.push(`| Aktive Module | ${ctx.enabledModules.join(', ')} |`);
  if (ctx.userAgent) lines.push(`| Browser | ${redact(ctx.userAgent).slice(0, 160)} |`);
  if (input.reporterHint) lines.push(`| Gemeldet von | ${redact(input.reporterHint).slice(0, 60)} |`);

  if (ctx.errorMessage) {
    lines.push('', '### Fehlermeldung', '', '```', redact(ctx.errorMessage).slice(0, 1000), '```');
  }
  if (ctx.errorStack) {
    lines.push('', '<details><summary>Stack</summary>', '', '```',
      redact(ctx.errorStack).slice(0, 3000), '```', '', '</details>');
  }

  lines.push('', '---', '',
    '_Automatisch aus Solawi OS gemeldet. Keine Mitglieds-, Gebots- oder Standortdaten enthalten._');

  const labels = ['from-app', input.kind === 'bug' ? 'bug' : input.kind];
  if (severity === 'blocker' || severity === 'serious') labels.push('priority');

  return {
    title,
    body: lines.join('\n'),
    labels,
    willSend: {
      title, labels,
      kind: input.kind, severity,
      module: ctx.module ?? null,
      route: ctx.route ? redactRoute(ctx.route) : null,
      enabledModules: ctx.enabledModules ?? [],
      appVersion: ctx.appVersion ?? null,
      hasErrorDetails: Boolean(ctx.errorMessage || ctx.errorStack),
    },
    explanation: [
      'Deine Beschreibung (E-Mail-Adressen, Telefonnummern, IBANs und Koordinaten werden automatisch entfernt)',
      'Welche Module bei euch aktiv sind',
      'Version, Plattform und Sprache',
      ctx.errorMessage ? 'Die technische Fehlermeldung (ebenfalls bereinigt)' : null,
      input.reporterHint ? 'Deinen freiwillig angegebenen Namen' : null,
    ].filter((x): x is string => x !== null),
  };
}

/** Store locally. Delivery to GitHub is a separate, retryable step. */
export async function store(ctx: ModuleContext, input: ReportInput, diag: DiagnosticContext = {}): Promise<string> {
  const preview = buildPreview(input, diag);
  const id = ctx.platform.crypto.randomUUID();
  await ctx.store.run(
    `INSERT INTO feedback_report
       (id, org_id, kind, title, body, severity, context, reporter_hint, status, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
    [
      id, ctx.orgId, input.kind, preview.title, preview.body,
      input.severity ?? 'normal', JSON.stringify(preview.willSend),
      input.reporterHint ? redact(input.reporterHint).slice(0, 60) : null,
      ctx.platform.clock.now().toISOString(),
    ],
  );
  await ctx.emit('feedback.reported', { reportId: id, kind: input.kind, severity: input.severity ?? 'normal' });
  return id;
}

export interface GitHubConfig {
  /** Fine-grained PAT with Issues: write on exactly one repository. */
  token: string;
  owner: string;
  repo: string;
}

export interface DeliveryResult {
  ok: boolean;
  issueNumber?: number;
  issueUrl?: string;
  error?: string;
}

/**
 * Deliver a stored report to GitHub Issues.
 *
 * Failure is not fatal: the report stays `pending` with an error and can be
 * retried. A farm without a token still collects reports locally, which the
 * admin can copy out by hand.
 */
export async function deliver(
  ctx: ModuleContext, reportId: string, cfg: GitHubConfig,
): Promise<DeliveryResult> {
  const row = await ctx.store.first<{ title: string; body: string; kind: string; severity: string; attempts: number }>(
    `SELECT title, body, kind, severity, attempts FROM feedback_report WHERE id = ? AND org_id = ?`,
    [reportId, ctx.orgId],
  );
  if (!row) return { ok: false, error: 'not_found' };

  const labels = ['from-app', row.kind === 'bug' ? 'bug' : row.kind];
  if (row.severity === 'blocker' || row.severity === 'serious') labels.push('priority');

  try {
    const res = await fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/issues`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${cfg.token}`,
        accept: 'application/vnd.github+json',
        'content-type': 'application/json',
        'user-agent': 'solawi-os',
        'x-github-api-version': '2022-11-28',
      },
      body: JSON.stringify({ title: row.title, body: row.body, labels }),
    });

    if (!res.ok) {
      const detail = `${res.status} ${(await res.text()).slice(0, 300)}`;
      await ctx.store.run(
        `UPDATE feedback_report SET status = 'failed', error = ?, attempts = attempts + 1 WHERE id = ?`,
        [detail, reportId],
      );
      return { ok: false, error: detail };
    }

    const issue = (await res.json()) as { number: number; html_url: string };
    await ctx.store.run(
      `UPDATE feedback_report
          SET status = 'delivered', issue_number = ?, issue_url = ?, delivered_at = ?, attempts = attempts + 1, error = NULL
        WHERE id = ?`,
      [issue.number, issue.html_url, ctx.platform.clock.now().toISOString(), reportId],
    );
    return { ok: true, issueNumber: issue.number, issueUrl: issue.html_url };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    await ctx.store.run(
      `UPDATE feedback_report SET status = 'failed', error = ?, attempts = attempts + 1 WHERE id = ?`,
      [detail, reportId],
    );
    return { ok: false, error: detail };
  }
}

/** Retry undelivered reports; called from the scheduled worker. */
export async function retryPending(ctx: ModuleContext, cfg: GitHubConfig, limit = 10): Promise<number> {
  const rows = await ctx.store.all<{ id: string }>(
    `SELECT id FROM feedback_report
      WHERE org_id = ? AND status IN ('pending', 'failed') AND attempts < 5
      ORDER BY created_at LIMIT ?`,
    [ctx.orgId, limit],
  );
  let delivered = 0;
  for (const r of rows) {
    const res = await deliver(ctx, r.id, cfg);
    if (res.ok) delivered++;
  }
  return delivered;
}

export async function listReports(ctx: ModuleContext, limit = 50) {
  return ctx.store.all(
    `SELECT id, kind, title, severity, status, issue_number, issue_url, error, created_at, delivered_at
       FROM feedback_report WHERE org_id = ? ORDER BY created_at DESC LIMIT ?`,
    [ctx.orgId, limit],
  );
}
