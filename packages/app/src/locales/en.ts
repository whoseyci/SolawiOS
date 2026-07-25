import type { Catalog } from '@solawi/i18n';

/**
 * English — translated FROM German (docs/30 §2).
 *
 * Domain terms stay German where translating would mislead: `Bieterrunde` is not
 * an auction (nobody competes for a scarce good — that is the entire point),
 * `Solawi` and `Richtwert` are the movement's own vocabulary. See the glossary
 * in docs/20-domaenenmodell.md.
 */
export const en: Catalog = {
  'app.name': 'Solawi OS',
  'app.tagline': 'The operating system for community supported agriculture',

  'nav.dashboard': 'Overview',
  'nav.field': 'Field',
  'nav.tasks': 'Tasks',
  'nav.members': 'Members',
  'nav.bidding': 'Bieterrunde',
  'nav.founding': 'Founding',
  'nav.settings': 'Settings',

  'auth.login': 'Sign in',
  'auth.logout': 'Sign out',
  'auth.register': 'Create account',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.displayName': 'Display name',
  'auth.error.invalid': 'Email or password is incorrect.',
  'auth.error.weakPassword': 'Password needs at least 10 characters.',
  'auth.error.emailTaken': 'An account with this email already exists.',

  'setup.title': 'Set up your farm',
  'setup.q.phase': 'What stage are you at?',
  'setup.q.distribution': 'How does the produce reach people?',
  'setup.q.contributions': 'How are contributions decided?',
  'setup.q.participation': 'Is member work expected?',
  'setup.q.households': 'Roughly how many households?',
  'setup.phase.founding': 'We are founding',
  'setup.phase.firstSeason': 'First season running',
  'setup.phase.operating': 'We have been going a while',
  'setup.skipFounding': 'Skip the founding phase',
  'setup.skipFounding.hint':
    'For established farms: the founding path is hidden. Your data is kept and you can switch it back on at any time.',

  'field.title': 'Field',
  'field.timeSlider': 'Timeline',
  'field.today': 'Today',
  'field.bed': 'Bed',
  'field.field': 'Field',
  'field.free': 'free',
  'field.perennial': 'Perennial planting',
  'cultivation.planting': 'Planting',
  'cultivation.crop': 'Crop',
  'cultivation.variety': 'Variety',
  'cultivation.sownOn': 'Sown on',
  'cultivation.harvestWindow': 'Harvest window',
  'cultivation.rotation.warning': 'Check crop rotation',
  'cultivation.rotation.acknowledge': 'Create anyway',
  'cultivation.rotation.explain':
    'This bed last grew {previousCrop} from the same plant family ({family}), {years} years ago. {required} years of rest are recommended.',

  'tasks.title': 'Tasks',
  'tasks.open': { one: '{count} open task', other: '{count} open tasks' },
  'tasks.urgency.soft': 'Soft window',
  'tasks.urgency.firm': 'Firm window',
  'tasks.urgency.hard': 'Hard window',
  'tasks.complete': 'Done',
  'tasks.sequence.title': 'Suggested order',
  'tasks.sequence.hint':
    'A suggestion, not an assignment. Ground-disturbing work first, planting last — so you can still manoeuvre beforehand.',

  'obs.record': 'Record',
  'obs.activity.weeding': 'Weeding',
  'obs.activity.watering': 'Watering',
  'obs.activity.harvest': 'Harvest',
  'obs.activity.mulching': 'Mulching',
  'obs.activity.sowing': 'Sowing',
  'obs.activity.planting': 'Planting',
  'obs.rhythm.title': 'Rhythm',
  'obs.rhythm.every': 'roughly every {days} days',
  'obs.rhythm.never': 'not recorded yet',
  'obs.privacy.note':
    'The bed is recorded, not the person. This data serves transparency and planning, never the assessment of people.',
  'obs.offline.pending': {
    one: '{count} entry waiting to sync',
    other: '{count} entries waiting to sync',
  },

  'members.household': 'Household',
  'members.share': 'Share',
  'members.shareType.large': 'Large share',
  'members.shareType.small': 'Small share',
  'members.absence': 'Absence',
  'members.absence.substitute': 'Substitute',
  'members.absence.donate': 'Give to the solidarity table',
  'members.neighbours.title': 'Neighbours',
  'members.neighbours.count': {
    one: '{count} household within {radius} km',
    other: '{count} households within {radius} km',
  },
  'members.neighbours.tooFew': 'Fewer than 3 households within {radius} km',
  'members.neighbours.connect': 'Connect?',
  'members.neighbours.privacy':
    'Only the count is shown. Locations are never sent to others — contact details are exchanged only after both sides agree.',
  'members.connect.purpose.carpool': 'Car sharing',
  'members.connect.purpose.pickup': 'Share a pickup',
  'members.connect.purpose.other': 'Something else',

  'bidding.title': 'Bieterrunde',
  'bidding.richtwert': 'Richtwert',
  'bidding.richtwert.explain':
    'The Richtwert is the annual budget divided by share equivalents. For your share that is {amount}.',
  'bidding.yourBid': 'Your bid',
  'bidding.submit': 'Submit bid',
  'bidding.revise': 'Revise bid',
  'bidding.paperEntry': 'Enter paper slip',
  'bidding.bar.collecting': 'Collecting bids …',
  'bidding.bar.above': 'above the Richtwert',
  'bidding.bar.below': 'below the Richtwert',
  'bidding.bar.explain':
    'The bar updates in batches and rounded. That is deliberate: a bar that jumps after every bid would reveal individual bids.',
  'bidding.mode.liveBar': 'Live bar during the round',
  'bidding.mode.finalOnly': 'Reveal only at the end',
  'bidding.mode.hint.small':
    'With fewer than 15 bids only the final result is shown — a live bar could otherwise be traced back to individuals.',
  'bidding.privacy.peers':
    'Other members never see your bid. The finance role does, because billing requires it — every access is logged.',

  'founding.title': 'Founding',
  'founding.progress': '{done} of {total} steps',
  'founding.actionable': 'Ready now',
  'founding.blocked': 'Waiting for: {blockers}',
  'founding.pitfall': 'Pitfall',
  'founding.status.open': 'Open',
  'founding.status.inProgress': 'In progress',
  'founding.status.done': 'Done',
  'founding.status.skipped': 'Skipped',
  'founding.status.notApplicable': 'Not applicable',

  'unit.kg': 'kg',
  'unit.g': 'g',
  'unit.piece': { one: 'piece', other: 'pieces' },
  'unit.bunch': { one: 'bunch', other: 'bunches' },
  'unit.crate': { one: 'crate', other: 'crates' },
  'unit.sqm': 'm²',
  'unit.minutes': { one: 'minute', other: 'minutes' },

  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.confirm': 'Confirm',
  'common.loading': 'Loading …',
  'common.offline': 'Offline — changes will sync later',
  'common.error': 'Something went wrong.',
};
