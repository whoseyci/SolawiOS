import type { Catalog } from '@solawi/i18n';

/**
 * German — the SOURCE locale (docs/30 §2).
 *
 * Keys are semantic and namespaced, never the German text itself, so changing a
 * wording does not invalidate every translation. Every key carries a comment
 * where the context is not obvious: "Satz" without context is untranslatable.
 */
export const de: Catalog = {
  'app.name': 'Solawi OS',
  'app.tagline': 'Das Betriebssystem für Solidarische Landwirtschaft',

  // --- navigation
  'nav.dashboard': 'Übersicht',
  'nav.field': 'Acker',
  'nav.tasks': 'Aufgaben',
  'nav.members': 'Mitglieder',
  'nav.bidding': 'Bieterrunde',
  'nav.founding': 'Gründung',
  'nav.settings': 'Einstellungen',

  // --- auth
  'auth.login': 'Anmelden',
  'auth.logout': 'Abmelden',
  'auth.register': 'Konto erstellen',
  'auth.email': 'E-Mail',
  'auth.password': 'Passwort',
  'auth.displayName': 'Anzeigename',
  'auth.error.invalid': 'E-Mail oder Passwort stimmt nicht.',
  'auth.error.weakPassword': 'Das Passwort braucht mindestens 10 Zeichen.',
  'auth.error.emailTaken': 'Für diese E-Mail gibt es bereits ein Konto.',

  // --- org setup
  'setup.title': 'Solawi einrichten',
  'setup.q.phase': 'In welcher Phase seid ihr?',
  'setup.q.distribution': 'Wie kommt das Gemüse zu den Menschen?',
  'setup.q.contributions': 'Wie werden die Beiträge bestimmt?',
  'setup.q.participation': 'Wird Mitarbeit erwartet?',
  'setup.q.households': 'Wie viele Haushalte, ungefähr?',
  'setup.phase.founding': 'Wir gründen gerade',
  'setup.phase.firstSeason': 'Erste Saison läuft',
  'setup.phase.operating': 'Wir wirtschaften schon länger',
  'setup.skipFounding': 'Gründungsphase überspringen',
  'setup.skipFounding.hint':
    'Für bestehende Solawis: Der Gründungspfad wird ausgeblendet. Eure Daten bleiben erhalten und ihr könnt ihn jederzeit wieder einschalten.',

  // --- field / cultivation
  'field.title': 'Acker',
  'field.timeSlider': 'Zeitachse',
  'field.today': 'Heute',
  'field.bed': 'Beet',
  'field.field': 'Schlag',
  'field.free': 'frei',
  'field.perennial': 'Mehrjährige Pflanzung',
  'cultivation.planting': 'Satz', // one sowing/planting unit of a crop, NOT a sentence
  'cultivation.crop': 'Kultur',
  'cultivation.variety': 'Sorte',
  'cultivation.sownOn': 'Ausgesät am',
  'cultivation.harvestWindow': 'Erntefenster',
  'cultivation.rotation.warning': 'Fruchtfolge beachten',
  'cultivation.rotation.acknowledge': 'Trotzdem anlegen',
  'cultivation.rotation.explain':
    'Auf diesem Beet stand zuletzt {previousCrop} aus derselben Pflanzenfamilie ({family}), vor {years} Jahren. Empfohlen sind {required} Jahre Pause.',

  // --- tasks
  'tasks.title': 'Aufgaben',
  'tasks.open': {
    one: '{count} offene Aufgabe',
    other: '{count} offene Aufgaben',
  },
  'tasks.urgency.soft': 'Zeitfenster weich',
  'tasks.urgency.firm': 'Zeitfenster fest',
  'tasks.urgency.hard': 'Zeitfenster hart',
  'tasks.complete': 'Erledigt',
  'tasks.sequence.title': 'Vorgeschlagene Reihenfolge',
  'tasks.sequence.hint':
    'Vorschlag, keine Zuteilung. Bodenstörende Arbeiten zuerst, Pflanzungen zuletzt — dann lässt sich vorher noch frei rangieren.',

  // --- observations
  'obs.record': 'Erfassen',
  'obs.activity.weeding': 'Jäten',
  'obs.activity.watering': 'Wässern',
  'obs.activity.harvest': 'Ernten',
  'obs.activity.mulching': 'Mulchen',
  'obs.activity.sowing': 'Aussäen',
  'obs.activity.planting': 'Pflanzen',
  'obs.rhythm.title': 'Rhythmus',
  'obs.rhythm.every': 'etwa alle {days} Tage',
  'obs.rhythm.never': 'noch nicht erfasst',
  'obs.privacy.note':
    'Erfasst wird das Beet, nicht die Person. Diese Daten dienen der Transparenz und Planung, nicht der Bewertung von Menschen.',
  'obs.offline.pending': {
    one: '{count} Eintrag wartet auf Übertragung',
    other: '{count} Einträge warten auf Übertragung',
  },

  // --- members
  'members.household': 'Haushalt',
  'members.share': 'Anteil',
  'members.shareType.large': 'Großer Anteil',
  'members.shareType.small': 'Kleiner Anteil',
  'members.absence': 'Abwesenheit',
  'members.absence.substitute': 'Vertretung',
  'members.absence.donate': 'An die Solidartafel geben',
  'members.neighbours.title': 'Nachbarschaft',
  'members.neighbours.count': {
    one: '{count} Haushalt im Umkreis von {radius} km',
    other: '{count} Haushalte im Umkreis von {radius} km',
  },
  'members.neighbours.tooFew': 'Weniger als 3 Haushalte im Umkreis von {radius} km',
  'members.neighbours.connect': 'Verbinden?',
  'members.neighbours.privacy':
    'Es wird nur die Anzahl angezeigt. Wohnorte werden nie an andere übertragen — Kontaktdaten werden erst nach beidseitiger Zustimmung ausgetauscht.',
  'members.connect.purpose.carpool': 'Fahrgemeinschaft',
  'members.connect.purpose.pickup': 'Abholung teilen',
  'members.connect.purpose.other': 'Anderes',

  // --- bidding
  'bidding.title': 'Bieterrunde',
  'bidding.richtwert': 'Richtwert',
  'bidding.richtwert.explain':
    'Der Richtwert ist der Jahresbedarf geteilt durch die Anteilsäquivalente. Für euren Anteil sind das {amount}.',
  'bidding.yourBid': 'Euer Gebot',
  'bidding.submit': 'Gebot abgeben',
  'bidding.revise': 'Gebot ändern',
  'bidding.paperEntry': 'Zettel erfassen',
  'bidding.bar.collecting': 'Gebote werden gesammelt …',
  'bidding.bar.above': 'über dem Richtwert',
  'bidding.bar.below': 'unter dem Richtwert',
  'bidding.bar.explain':
    'Der Balken aktualisiert sich gebündelt und gerundet. Das ist Absicht: Ein Balken, der nach jedem Gebot springt, würde einzelne Gebote verraten.',
  'bidding.mode.liveBar': 'Balken während der Runde',
  'bidding.mode.finalOnly': 'Erst am Ende auflösen',
  'bidding.mode.hint.small':
    'Bei weniger als 15 Geboten wird nur das Endergebnis gezeigt — ein Live-Balken ließe sich sonst auf einzelne Personen zurückrechnen.',
  'bidding.privacy.peers':
    'Andere Mitglieder sehen euer Gebot nie. Die Finanzrolle sieht es, weil die Abrechnung es braucht — jeder Zugriff wird protokolliert.',

  // --- founding
  'founding.title': 'Gründung',
  'founding.progress': '{done} von {total} Schritten',
  'founding.actionable': 'Jetzt dran',
  'founding.blocked': 'Wartet auf: {blockers}',
  'founding.pitfall': 'Stolperfalle',
  'founding.status.open': 'Offen',
  'founding.status.inProgress': 'In Arbeit',
  'founding.status.done': 'Erledigt',
  'founding.status.skipped': 'Übersprungen',
  'founding.status.notApplicable': 'Nicht zutreffend',

  // --- units (domain values, not Intl units — "3 Bund" is the reality)
  'unit.kg': 'kg',
  'unit.g': 'g',
  'unit.piece': { one: 'Stück', other: 'Stück' },
  'unit.bunch': { one: 'Bund', other: 'Bund' },
  'unit.crate': { one: 'Kiste', other: 'Kisten' },
  'unit.sqm': 'm²',
  'unit.minutes': { one: 'Minute', other: 'Minuten' },

  // --- generic
  'common.save': 'Speichern',
  'common.cancel': 'Abbrechen',
  'common.delete': 'Löschen',
  'common.confirm': 'Bestätigen',
  'common.loading': 'Lädt …',
  'common.offline': 'Offline — Änderungen werden später übertragen',
  'common.error': 'Etwas ist schiefgelaufen.',
};
