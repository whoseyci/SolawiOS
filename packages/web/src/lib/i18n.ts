/**
 * UI translations.
 *
 * German is the source locale (docs/30 §2). Keys are semantic and namespaced —
 * never the German text itself, so rewording does not invalidate translations.
 * No hardcoded strings in components. Ever. Not even placeholders.
 */

type Forms = { one: string; other: string };
type Entry = string | Forms;
type Catalog = Record<string, Entry>;

const de: Catalog = {
  'app.name': 'Solawi OS',
  'nav.field': 'Acker',
  'nav.tasks': 'Aufgaben',
  'nav.members': 'Mitglieder',
  'nav.bidding': 'Bieterrunde',
  'nav.founding': 'Gründung',
  'nav.settings': 'Mehr',

  'auth.signIn': 'Anmelden',
  'auth.signUp': 'Konto erstellen',
  'auth.email': 'E-Mail',
  'auth.password': 'Passwort',
  'auth.name': 'Dein Name',
  'auth.noAccount': 'Noch kein Konto?',
  'auth.haveAccount': 'Schon ein Konto?',
  'auth.signOut': 'Abmelden',
  'auth.invalid': 'E-Mail oder Passwort stimmt nicht.',
  'auth.weakPassword': 'Mindestens 10 Zeichen.',
  'auth.emailTaken': 'Für diese E-Mail gibt es schon ein Konto.',
  'auth.tagline': 'Das Betriebssystem für Solidarische Landwirtschaft',

  'org.choose': 'Hof auswählen',
  'org.create': 'Neuen Hof anlegen',
  'org.name': 'Name der Solawi',
  'org.slug': 'Kurzname (für die Adresse)',
  'org.established': 'Wir wirtschaften schon — Gründungsphase überspringen',
  'org.establishedHint': 'Der Gründungspfad wird ausgeblendet. Du kannst ihn später wieder einschalten.',
  'org.none': 'Du gehörst noch zu keinem Hof.',
  'org.slugTaken': 'Dieser Kurzname ist schon vergeben.',
  'org.slugInvalid': 'Kurzname: 2–50 Zeichen, nur a–z, 0–9 und Bindestriche.',

  'field.title': 'Acker',
  'field.today': 'Heute',
  'field.free': 'frei',
  'field.beds': { one: '{count} Beet', other: '{count} Beete' },
  'field.noBeds': 'Noch keine Beete angelegt.',
  'field.addField': 'Schlag anlegen',
  'field.addBeds': 'Beete anlegen',
  'field.bedCount': 'Anzahl Beete',
  'field.length': 'Länge (m)',
  'field.width': 'Breite (m)',
  'field.phase.growing': 'wächst',
  'field.phase.harvestable': 'erntereif',
  'field.phase.finished': 'abgeräumt',
  'field.timeHint': 'Zieh den Regler, um den Acker an einem anderen Tag zu sehen.',

  'tasks.title': 'Aufgaben',
  'tasks.none': 'Nichts offen. Schöner Tag.',
  'tasks.add': 'Aufgabe',
  'tasks.done': 'Erledigt',
  'tasks.sequence': 'Reihenfolge vorschlagen',
  'tasks.sequenceHint': 'Vorschlag, keine Zuteilung.',
  'tasks.urgency.soft': 'weich',
  'tasks.urgency.firm': 'fest',
  'tasks.urgency.hard': 'hart',

  'obs.record': 'Erfassen',
  'obs.weeding': 'Jäten',
  'obs.watering': 'Wässern',
  'obs.harvest': 'Ernten',
  'obs.mulching': 'Mulchen',
  'obs.sowing': 'Aussäen',
  'obs.planting': 'Pflanzen',
  'obs.amount': 'Menge',
  'obs.minutes': 'Minuten',
  'obs.saved': 'Gespeichert',
  'obs.queued': 'Offline gespeichert — wird später übertragen',
  'obs.privacy': 'Erfasst wird das Beet, nicht die Person.',
  'obs.rhythm': 'etwa alle {days} Tage',
  'obs.rhythmNone': 'noch nicht erfasst',

  'members.title': 'Mitglieder',
  'members.households': { one: '{count} Haushalt', other: '{count} Haushalte' },
  'members.equivalents': '{n} Anteilsäquivalente',
  'members.neighbours': 'Nachbarschaft',
  'members.neighboursCount': { one: '{count} Haushalt im Umkreis von {r} km', other: '{count} Haushalte im Umkreis von {r} km' },
  'members.neighboursFew': 'Weniger als 3 Haushalte im Umkreis von {r} km',
  'members.connect': 'Verbinden?',
  'members.privacy': 'Nur die Anzahl. Wohnorte verlassen den Server nie.',

  'bidding.title': 'Bieterrunde',
  'bidding.richtwert': 'Richtwert',
  'bidding.perShare': 'pro großem Anteil',
  'bidding.above': 'über dem Richtwert',
  'bidding.below': 'unter dem Richtwert',
  'bidding.collecting': 'Gebote werden gesammelt …',
  'bidding.barHint': 'Der Balken aktualisiert sich gebündelt und gerundet — sonst ließen sich einzelne Gebote zurückrechnen.',
  'bidding.yourBid': 'Dein Gebot',
  'bidding.submit': 'Gebot abgeben',
  'bidding.noRound': 'Zurzeit läuft keine Bieterrunde.',
  'bidding.projector': 'Beamer-Ansicht',

  'founding.title': 'Gründung',
  'founding.progress': '{done} von {total} Schritten',
  'founding.actionable': 'Jetzt dran',
  'founding.blocked': 'Wartet auf Vorarbeiten',
  'founding.done': 'Erledigt',
  'founding.skip': 'Gründungsphase überspringen',

  'feedback.title': 'Fehler melden',
  'feedback.what': 'Was ist passiert?',
  'feedback.detail': 'Beschreibung',
  'feedback.kind.bug': 'Fehler',
  'feedback.kind.idea': 'Idee',
  'feedback.kind.question': 'Frage',
  'feedback.preview': 'Vorschau ansehen',
  'feedback.willSend': 'Das wird übermittelt:',
  'feedback.send': 'Absenden',
  'feedback.sent': 'Danke! Gemeldet.',
  'feedback.storedLocally': 'Gespeichert — wird übertragen, sobald möglich.',

  'settings.modules': 'Module',
  'settings.modulesHint': 'Ausgeschaltete Module verschwinden aus der App. Deine Daten bleiben erhalten.',
  'settings.language': 'Sprache',

  'common.save': 'Speichern',
  'common.cancel': 'Abbrechen',
  'common.back': 'Zurück',
  'common.loading': 'Lädt …',
  'common.offline': 'Offline',
  'common.pending': { one: '{count} Eintrag wartet', other: '{count} Einträge warten' },
  'common.stale': 'Stand von vorhin — offline',
  'common.error': 'Etwas ist schiefgelaufen.',
  'common.retry': 'Nochmal',
  'common.close': 'Schließen',
  'common.optional': 'optional',
};

const en: Catalog = {
  'app.name': 'Solawi OS',
  'nav.field': 'Field', 'nav.tasks': 'Tasks', 'nav.members': 'Members',
  'nav.bidding': 'Bieterrunde', 'nav.founding': 'Founding', 'nav.settings': 'More',
  'auth.signIn': 'Sign in', 'auth.signUp': 'Create account', 'auth.email': 'Email',
  'auth.password': 'Password', 'auth.name': 'Your name', 'auth.noAccount': 'No account yet?',
  'auth.haveAccount': 'Already have an account?', 'auth.signOut': 'Sign out',
  'auth.invalid': 'Email or password is incorrect.', 'auth.weakPassword': 'At least 10 characters.',
  'auth.emailTaken': 'An account with this email already exists.',
  'auth.tagline': 'The operating system for community supported agriculture',
  'org.choose': 'Choose a farm', 'org.create': 'Create a farm', 'org.name': 'Farm name',
  'org.slug': 'Short name (for the address)',
  'org.established': 'We are already running — skip the founding phase',
  'org.establishedHint': 'The founding path is hidden. You can switch it back on later.',
  'org.none': 'You do not belong to a farm yet.',
  'org.slugTaken': 'That short name is already taken.',
  'org.slugInvalid': 'Short name: 2-50 characters, only a-z, 0-9 and hyphens.',
  'field.title': 'Field', 'field.today': 'Today', 'field.free': 'free',
  'field.beds': { one: '{count} bed', other: '{count} beds' },
  'field.noBeds': 'No beds yet.', 'field.addField': 'Add a field', 'field.addBeds': 'Add beds',
  'field.bedCount': 'Number of beds', 'field.length': 'Length (m)', 'field.width': 'Width (m)',
  'field.phase.growing': 'growing', 'field.phase.harvestable': 'ready', 'field.phase.finished': 'cleared',
  'field.timeHint': 'Drag the slider to see the field on another day.',
  'tasks.title': 'Tasks', 'tasks.none': 'Nothing open. Nice day.', 'tasks.add': 'Task',
  'tasks.done': 'Done', 'tasks.sequence': 'Suggest an order',
  'tasks.sequenceHint': 'A suggestion, not an assignment.',
  'tasks.urgency.soft': 'soft', 'tasks.urgency.firm': 'firm', 'tasks.urgency.hard': 'hard',
  'obs.record': 'Record', 'obs.weeding': 'Weeding', 'obs.watering': 'Watering',
  'obs.harvest': 'Harvest', 'obs.mulching': 'Mulching', 'obs.sowing': 'Sowing', 'obs.planting': 'Planting',
  'obs.amount': 'Amount', 'obs.minutes': 'Minutes', 'obs.saved': 'Saved',
  'obs.queued': 'Saved offline — will sync later',
  'obs.privacy': 'The bed is recorded, not the person.',
  'obs.rhythm': 'roughly every {days} days', 'obs.rhythmNone': 'not recorded yet',
  'members.title': 'Members',
  'members.households': { one: '{count} household', other: '{count} households' },
  'members.equivalents': '{n} share equivalents', 'members.neighbours': 'Neighbours',
  'members.neighboursCount': { one: '{count} household within {r} km', other: '{count} households within {r} km' },
  'members.neighboursFew': 'Fewer than 3 households within {r} km',
  'members.connect': 'Connect?', 'members.privacy': 'Only the count. Locations never leave the server.',
  'bidding.title': 'Bieterrunde', 'bidding.richtwert': 'Richtwert', 'bidding.perShare': 'per full share',
  'bidding.above': 'above the Richtwert', 'bidding.below': 'below the Richtwert',
  'bidding.collecting': 'Collecting bids …',
  'bidding.barHint': 'The bar updates in batches and rounded — otherwise individual bids could be derived.',
  'bidding.yourBid': 'Your bid', 'bidding.submit': 'Submit bid',
  'bidding.noRound': 'No Bieterrunde is running.', 'bidding.projector': 'Projector view',
  'founding.title': 'Founding', 'founding.progress': '{done} of {total} steps',
  'founding.actionable': 'Ready now', 'founding.blocked': 'Waiting on earlier steps',
  'founding.done': 'Done', 'founding.skip': 'Skip the founding phase',
  'feedback.title': 'Report a problem', 'feedback.what': 'What happened?',
  'feedback.detail': 'Description', 'feedback.kind.bug': 'Bug', 'feedback.kind.idea': 'Idea',
  'feedback.kind.question': 'Question', 'feedback.preview': 'Show preview',
  'feedback.willSend': 'This will be sent:', 'feedback.send': 'Send', 'feedback.sent': 'Thank you!',
  'feedback.storedLocally': 'Saved — will be sent when possible.',
  'settings.modules': 'Modules',
  'settings.modulesHint': 'Disabled modules disappear from the app. Your data is kept.',
  'settings.language': 'Language',
  'common.save': 'Save', 'common.cancel': 'Cancel', 'common.back': 'Back',
  'common.loading': 'Loading …', 'common.offline': 'Offline',
  'common.pending': { one: '{count} entry waiting', other: '{count} entries waiting' },
  'common.stale': 'Shown from cache — offline', 'common.error': 'Something went wrong.',
  'common.retry': 'Retry', 'common.close': 'Close', 'common.optional': 'optional',
};

const catalogs: Record<string, Catalog> = { de, en };
const LOCALE_KEY = 'solawi.locale';

export function locale(): string {
  return localStorage.getItem(LOCALE_KEY) ?? (navigator.language.startsWith('en') ? 'en' : 'de');
}

export function setLocale(l: string): void {
  localStorage.setItem(LOCALE_KEY, l);
  location.reload();
}

export function t(key: string, vars: Record<string, string | number> = {}): string {
  const cat = catalogs[locale()] ?? de;
  const entry = cat[key] ?? de[key];
  if (entry === undefined) return key;

  let template: string;
  if (typeof entry === 'string') template = entry;
  else {
    // Intl.PluralRules, so Polish and Arabic work without shipping tables.
    const n = Number(vars.count ?? 0);
    const cat2 = new Intl.PluralRules(locale()).select(n);
    template = cat2 === 'one' ? entry.one : entry.other;
  }
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : m);
}

export const fmt = {
  date: (v: string | Date) =>
    new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(new Date(v)),
  dayShort: (v: string | Date) =>
    new Intl.DateTimeFormat(locale(), { day: '2-digit', month: 'short' }).format(new Date(v)),
  money: (cents: number) =>
    new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR' }).format(cents / 100),
  num: (n: number, d = 0) =>
    new Intl.NumberFormat(locale(), { minimumFractionDigits: d, maximumFractionDigits: d }).format(n),
};
