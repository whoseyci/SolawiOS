// Sample data generator. Pure functions, easy to test.
import { addDays } from '../lib/date';
import { uid } from '../lib/uid';
import { CROP_PALETTE } from '../data/seed';
import type {
  State, Member, Share, InventoryItem, Product, Message, Task
} from '../types';

const FIRST = ['Lena','Felix','Maja','Theo','Clara','Noah','Mia','Jonas','Emma','Paul','Sophie','Anton','Marie','Lukas','Nora','Ben','Frieda','Karl','Ida','Henri','Anna','Mara','Finn','Lina','David','Tilda','Erik','Hanna','Oskar','Lotte'];
const LAST = ['Müller','Schmidt','Weber','Wagner','Becker','Hoffmann','Schäfer','Koch','Klein','Wolf','Schröder','Neumann','Schwarz','Zimmermann','Braun','Krüger','Hofmann','Hartmann','Lange','Werner','Schmitt','Krause','Meier','Lehmann','Schmid','Schulze','Maier','Köhler','Herrmann','König'];
const CITIES = ['10115 Berlin','80331 München','50667 Köln','20095 Hamburg','04109 Leipzig','70173 Stuttgart','90402 Nürnberg','01067 Dresden','28195 Bremen','44135 Dortmund','55116 Mainz','79098 Freiburg','37073 Göttingen','14467 Potsdam','07743 Jena'];
const NOTES = ['Liebt Tomaten', 'Vegetarisch', 'Frühe Abholung', 'Urlaub im August', 'Spendet gern Überschuss', 'Allergie: Sellerie', 'Großfamilie', 'Single-Haushalt', 'Neue Mitgliederin', 'Engagiert sich bei Ernteeinsätzen', 'Mag keine Paprika', 'Hundebesitzer'];
const PEOPLE = ['Anna','Markus','Lena','Tobias','Svenja','Hof-Team','Helfer'];
const DEPOT_NAMES = ['Hofladen Mitte','Depot Nord','Depot Süd','Depot West','Depot Ost'];

const PRODUCT_LIST: Product[] = [
  { id: 'p1', name: 'Brot vom Hofbäcker', icon: 'ph-bread', price: 5.5, unit: 'Laib', note: 'Dinkel-Vollkorn' },
  { id: 'p2', name: 'Eier Freilandhaltung', icon: 'ph-egg', price: 4.2, unit: '10er-Pack', note: 'aus eigener Hühnerhaltung' },
  { id: 'p3', name: 'Honig Regional', icon: 'ph-honeycomb', price: 8.0, unit: '500g Glas', note: 'vom Imker nebenan' },
  { id: 'p4', name: 'Apfelsaft naturtrüb', icon: 'ph-coffee', price: 3.5, unit: '1l Flasche', note: 'Streuobstwiese' },
  { id: 'p5', name: 'Hof-Käse Ziegenfrischkäse', icon: 'ph-cheese', price: 6.8, unit: '200g', note: 'Bio-Ziegenhof Lindner' },
  { id: 'p6', name: 'Kräutertee-Mischung', icon: 'ph-plant', price: 4.0, unit: '100g', note: 'eigene Ernte' },
];

const EXPENSE_CATS: { name: string; cat: string; amount: number; m: number }[] = [
  { name: 'Biosaatgut', cat: 'Saatgut', amount: 420, m: 1 },
  { name: 'Pflanzgut Jungpflanzen', cat: 'Pflanzgut', amount: 680, m: 2 },
  { name: 'Hornspäne & Dünger', cat: 'Dünger', amount: 320, m: 2 },
  { name: 'Folientunnel-Material', cat: 'Werkzeug', amount: 850, m: 3 },
  { name: 'Werkzeug Heckenschere', cat: 'Werkzeug', amount: 280, m: 3 },
  { name: 'Pacht Q1', cat: 'Pacht', amount: 600, m: 0 },
  { name: 'Pacht Q2', cat: 'Pacht', amount: 600, m: 3 },
  { name: 'Pacht Q3', cat: 'Pacht', amount: 600, m: 6 },
  { name: 'Versicherung Landwirtschaft', cat: 'Versicherung', amount: 1100, m: 0 },
  { name: 'Personal Aushilfe April', cat: 'Personal', amount: 800, m: 3 },
  { name: 'Personal Aushilfe Mai', cat: 'Personal', amount: 1200, m: 4 },
  { name: 'Personal Aushilfe Juni', cat: 'Personal', amount: 1400, m: 5 },
  { name: 'Sprinter Miete', cat: 'Verteilung', amount: 350, m: 4 },
  { name: 'Benzin & Diesel', cat: 'Verteilung', amount: 180, m: 5 },
  { name: 'Verpackung Tüten', cat: 'Sonstiges', amount: 95, m: 5 },
];

export function seedSampleData(year: number, today: Date): State {
  const state: State = {
    meta: {
      farm: { name: 'Hof Wurzelreich', since: 2017, hectares: 4.2, members_target: 85, founder: 'Familie Berger' },
      season: year,
      currency: 'EUR',
      sharePrice: { small: 78, medium: 112, large: 156 },
      shareUnit: '€/Monat',
    },
    members: [],
    shares: [],
    crops: [],
    beds: [],
    depots: [],
    plantings: [],
    harvest: [],
    tasks: [],
    inventory: [],
    products: [...PRODUCT_LIST],
    orders: [],
    payments: [],
    events: [],
    messages: [],
    notes: [],
    pickups: [],
    budget: {},
  };

  // Depots (must come before members)
  const depotAddrs = ['Hauptstr.','Ringstr.','Parkweg','Schulstr.','Lindenallee'];
  const depotDays = ['Fr','Fr','Mi','Mi','Sa'];
  const depotPickups = ['16:00 - 19:00','17:00 - 20:00','15:00 - 18:00','16:00 - 19:00','10:00 - 13:00'];
  const depotContacts = ['Familie Müller','Markus Weber','Lena Schmidt','Tobias Klein','Svenja Wolf'];
  DEPOT_NAMES.forEach((name, i) => {
    state.depots.push({
      id: uid('d'),
      name, address: `${depotAddrs[i]} ${i*5+3}, ${CITIES[i % CITIES.length]}`,
      day: depotDays[i], pickup: depotPickups[i], contact: depotContacts[i],
      capacity: 25 + i*5,
      lat: 50.1 + i*0.01, lng: 8.6 + i*0.01,
      notes: '',
    });
  });

  // Members
  for (let i = 0; i < 24; i++) {
    const fn = FIRST[i % FIRST.length];
    const ln = LAST[(i*3) % LAST.length];
    const status = i < 18 ? 'aktiv' : i < 22 ? 'warteliste' : i < 23 ? 'pausiert' : 'ausgeschieden';
    const since = new Date(2018 + (i%6), (i*2) % 12, 1 + (i%28)).toISOString();
    const m: Member = {
      id: uid('m'),
      name: `${fn} ${ln}`,
      status,
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@${['gmail.com','posteo.de','web.de','gmx.de'][i%4]}`,
      phone: `+49 ${(30 + (i%240)).toString().padStart(4,'0')} ${(1_000_000 + i*1357).toString().slice(0,7)}`,
      address: `${['Hauptstr.','Gartenweg','Lindenallee','Brunnenstr.','Schulweg','Bergstr.','Wiesengrund','Talstr.'][i%8]} ${i+1}`,
      city: CITIES[i % CITIES.length],
      since: since.slice(0,10),
      depot: state.depots[0].id,
      notes: NOTES[i % NOTES.length],
      allergies: i % 7 === 0 ? ['Sellerie'] : i % 9 === 0 ? ['Nüsse'] : [],
      joinedAt: since,
    };
    state.members.push(m);
  }

  // Shares
  state.members.forEach((m, i) => {
    if (m.status === 'aktiv') {
      const type = (['small','medium','medium','medium','large'] as const)[i % 5];
      const sh: Share = {
        id: uid('s'), member: m.id, type, active: true,
        start: m.since || new Date().toISOString(), end: null,
        monthlyPrice: state.meta.sharePrice[type],
      };
      state.shares.push(sh);
    }
  });

  // Crops
  Object.entries(CROP_PALETTE).forEach(([name]) => {
    state.crops.push({
      id: uid('c'),
      name,
      variety: name === 'Tomate' ? 'San Marzano, Harzfeuer' : name === 'Salat' ? 'Lollo Rosso, Eichblatt' : name === 'Karotte' ? 'Nantaise 2, Purple Haze' : 'Hof-eigene Sorte',
      family: name === 'Tomate' || name === 'Paprika' ? 'Nachtschattengewächse' : name === 'Kohl' ? 'Kreuzblütler' : name === 'Karotte' || name === 'Pastinake' ? 'Doldenblütler' : name === 'Salat' || name === 'Mangold' ? 'Korbblütler' : 'Sonstige',
      days: name === 'Radieschen' ? 28 : name === 'Salat' ? 45 : name === 'Spinat' ? 50 : name === 'Karotte' ? 75 : name === 'Tomate' ? 80 : name === 'Kürbis' ? 110 : 90,
      cycle: 'einjährig',
      planting: name === 'Salat' || name === 'Tomate' ? 'Vorkultur' : 'Direktsaat',
      light: 'sonnig', water: 'mittel', soil: 'humos, locker',
      nutrition: name === 'Kohl' || name === 'Kürbis' || name === 'Tomate' ? 'Starkzehrer' : name === 'Erbsen' || name === 'Bohnen' ? 'Schwachzehrer' : 'Mittelzehrer',
      companions: name === 'Tomate' ? ['Basilikum','Karotte','Sellerie'] : name === 'Karotte' ? ['Zwiebel','Lauch','Salat'] : ['Kräuter','Zwiebel'],
      antagonists: name === 'Tomate' ? ['Kartoffel','Kohl'] : name === 'Kartoffel' ? ['Tomate','Kürbis'] : [],
    });
  });

  // Beds
  const zones = ['A-Nord','A-Süd','B-Ost','B-West','C-Gewächshaus','D-Beeren'];
  for (let i = 0; i < 14; i++) {
    state.beds.push({
      id: uid('b'),
      name: `Beet ${String.fromCharCode(65 + Math.floor(i/3))}-${(i%3)+1}`,
      zone: zones[Math.floor(i/3)],
      area: 30 + (i*7) % 50,
      length: 12 + (i%3)*4,
      width: 1.2,
      soil: (['lehmig','humos','sandig'] as const)[i%3],
      x: i*30,
      notes: '',
    });
  }

  // Plantings
  state.beds.forEach((b, i) => {
    const c = state.crops[i % state.crops.length];
    const sow = new Date(year, (i%4)+1, 5 + (i%20));
    const harv = addDays(sow, c.days || 90);
    state.plantings.push({
      id: uid('p'),
      bed: b.id, crop: c.id, year,
      sowDate: sow.toISOString().slice(0,10),
      expectedHarvest: harv.toISOString().slice(0,10),
      expectedYield: 30 + (i%5)*15,
      notes: '',
    });
  });

  // Harvest (only up to today)
  for (let i = 0; i < 60; i++) {
    const d = new Date(year, 3 + Math.floor(i/8), 1 + (i*3)%28);
    if (d > today) break;
    const c = state.crops[i % state.crops.length];
    state.harvest.push({
      id: uid('h'),
      date: d.toISOString().slice(0,10),
      crop: c.id,
      bed: state.beds[i % state.beds.length].id,
      amount: 5 + (i*7) % 50,
      unit: 'kg',
      quality: (i % 6 === 0 ? 'C' : i % 3 === 0 ? 'B' : 'A'),
      destination: (i % 4 === 0 ? 'Hofladen' : i % 4 === 1 ? 'Verarbeitung' : 'Verteilung'),
      note: '',
    });
  }

  // Tasks
  const taskTitles: { t: string; c: Task['category'] }[] = [
    { t: 'Tomaten ausgeizen', c: 'Pflege' }, { t: 'Salat pflanzen', c: 'Pflanzung' },
    { t: 'Beikraut jäten Reihe 3', c: 'Pflege' }, { t: 'Karotten vereinzeln', c: 'Pflege' },
    { t: 'Kompost umsetzen', c: 'Infrastruktur' }, { t: 'Verteilung Freitag', c: 'Verteilung' },
    { t: 'Folientunnel lüften', c: 'Pflege' }, { t: 'Saatgut bestellen', c: 'Verwaltung' },
    { t: 'Ernteeinsatz Mitglieder', c: 'Ernte' }, { t: 'Bewässerung prüfen', c: 'Infrastruktur' },
    { t: 'Hofschild erneuern', c: 'Infrastruktur' }, { t: 'Rechnung Biosaatgut', c: 'Verwaltung' },
    { t: 'Treibhaus schattieren', c: 'Pflege' }, { t: 'Kräuter ernten und trocknen', c: 'Ernte' },
    { t: 'Beet 7 vorbereiten', c: 'Pflanzung' }, { t: 'Schnecken absammeln', c: 'Pflege' },
    { t: 'Ernteliste zusammenstellen', c: 'Verteilung' }, { t: 'Newsletter Juli', c: 'Verwaltung' },
  ];
  taskTitles.forEach((tt, i) => {
    const due = new Date(year, 3 + Math.floor(i/5), 1 + (i*4) % 28);
    const status: Task['status'] = due < today ? (i % 4 === 0 ? 'todo' : 'done') : (i % 6 === 0 ? 'backlog' : 'todo');
    state.tasks.push({
      id: uid('t'),
      title: tt.t, description: '',
      category: tt.c,
      priority: i % 5 === 0 ? 'high' : i % 4 === 0 ? 'low' : 'medium',
      status,
      due: due.toISOString().slice(0,10),
      assignee: PEOPLE[i % PEOPLE.length],
      hours: 1 + (i % 4),
      tags: [],
      createdAt: new Date(year, 0, 1).toISOString(),
      doneAt: status === 'done' ? due.toISOString() : null,
    });
  });

  // Inventory
  const invItems: Array<Omit<InventoryItem, 'id' | 'updatedAt'>> = [
    { name: 'Tomatensaatgut San Marzano', category: 'Saatgut', stock: 8, min: 5, unit: 'Pkg', price: 0, supplier: 'Biosaatgut Müller', note: '' },
    { name: 'Salat-Saatgut Lollo Rosso', category: 'Saatgut', stock: 12, min: 8, unit: 'Pkg', price: 0, supplier: 'Biosaatgut Müller', note: '' },
    { name: 'Karottensaatgut Nantaise', category: 'Saatgut', stock: 2, min: 5, unit: 'Pkg', price: 0, supplier: 'Biosaatgut Müller', note: '' },
    { name: 'Hornspäne Bio', category: 'Dünger', stock: 25, min: 10, unit: 'kg', price: 0, supplier: 'Bio-Grosshandel', note: '' },
    { name: 'Brennnesseljauche', category: 'Dünger', stock: 50, min: 20, unit: 'l', price: 0, supplier: '', note: 'eigene Herstellung' },
    { name: 'Gartenschere Felco', category: 'Werkzeug', stock: 4, min: 3, unit: 'Stück', price: 0, supplier: 'Gartenbedarf Schmidt', note: '' },
    { name: 'Spaten', category: 'Werkzeug', stock: 5, min: 4, unit: 'Stück', price: 0, supplier: 'Gartenbedarf Schmidt', note: '' },
    { name: 'Hacken', category: 'Werkzeug', stock: 1, min: 3, unit: 'Stück', price: 0, supplier: 'Gartenbedarf Schmidt', note: '' },
    { name: 'Bewässerungsschlauch 50m', category: 'Verbrauchsmaterial', stock: 2, min: 1, unit: 'Stück', price: 0, supplier: 'Gartenbedarf Schmidt', note: '' },
    { name: 'Folientunnel-Plane', category: 'Verbrauchsmaterial', stock: 1, min: 1, unit: 'Stück', price: 0, supplier: 'Gartenbedarf Schmidt', note: '' },
    { name: 'Pflanztöpfe 10cm', category: 'Verbrauchsmaterial', stock: 200, min: 100, unit: 'Stück', price: 0, supplier: 'Gartenbedarf Schmidt', note: '' },
    { name: 'Anzuchterde', category: 'Verbrauchsmaterial', stock: 30, min: 20, unit: 'l', price: 0, supplier: 'Bio-Grosshandel', note: '' },
    { name: 'Etiketten', category: 'Verbrauchsmaterial', stock: 500, min: 200, unit: 'Stück', price: 0, supplier: 'Gartenbedarf Schmidt', note: '' },
    { name: 'Erdbeerpflanzen', category: 'Pflanzen', stock: 0, min: 30, unit: 'Stück', price: 0, supplier: '', note: '' },
    { name: 'Kräutertöpfe Bio', category: 'Pflanzen', stock: 40, min: 20, unit: 'Stück', price: 0, supplier: 'Gärtnerei Sonnenhof', note: '' },
  ];
  invItems.forEach(i => state.inventory.push({ id: uid('i'), updatedAt: new Date().toISOString(), ...i }));

  // Orders
  for (let i = 0; i < 8; i++) {
    const member = state.members[i % state.members.length];
    const product = state.products[i % state.products.length];
    const date = new Date(year, 5 + i%3, 5 + i*2);
    state.orders.push({
      id: uid('o'),
      member: member.id,
      date: date.toISOString(),
      delivery: addDays(date, 5).toISOString().slice(0,10),
      items: [{ product: product.id, name: product.name, qty: 1 + i%3, price: product.price, total: product.price * (1 + i%3) }],
      total: product.price * (1 + i%3),
      status: i < 5 ? 'geliefert' : 'offen',
      deliveredAt: i < 5 ? new Date(date.getTime() + 5*86_400_000).toISOString() : null,
    });
  }

  // Membership fees
  for (let m = 0; m < 12; m++) {
    const month = new Date(year, m, 5);
    if (month > today) break;
    state.shares.filter(s => s.active).forEach((sh, i) => {
      if (i % 3 === 0 && month.getMonth() % 3 === 0) return;
      state.payments.push({
        id: uid('p'),
        date: month.toISOString().slice(0,10),
        kind: 'beitrag',
        name: `Mitgliederbeitrag`,
        category: 'Mitgliederbeitrag',
        amount: sh.monthlyPrice,
        member: sh.member,
        method: i % 3 === 0 ? 'lastschrift' : 'bank',
        note: '',
      });
    });
  }

  // Expenses
  EXPENSE_CATS.forEach(e => {
    const d = new Date(year, e.m, 15);
    if (d > today) return;
    state.payments.push({
      id: uid('p'),
      date: d.toISOString().slice(0,10),
      kind: 'ausgabe',
      name: e.name, category: e.cat, amount: e.amount,
      member: null,
      method: 'bank', note: '',
    });
  });

  // Messages
  const msgs: Omit<Message, 'id'>[] = [
    {
      title: 'Erste Ernteanteile sind bereit!',
      audience: 'all', depot: null,
      body: 'Liebe Mitglieder,\n\nendlich ist es soweit: die ersten Ernteanteile der Saison 2026 sind geerntet und gepackt! Diese Woche gibt es Salat, Radieschen, Kräuter und die ersten Tomaten.\n\nBitte denkt an eure Stoffbeutel.\n\nEuer Hof-Team',
      status: 'sent', recipients: state.members.length,
      createdAt: new Date(year, 5, 1).toISOString(), date: new Date(year, 5, 1).toISOString(),
    },
    {
      title: 'Ernteeinsatz am Samstag',
      audience: 'active', depot: null,
      body: 'Hallo zusammen,\n\nam Samstag, den 18. Juli, ist unser großer Ernteeinsatz von 9-13 Uhr. Wir freuen uns auf eure Unterstützung! Für Getränke und ein kleines Mittagessen ist gesorgt.\n\nBitte meldet euch kurz an, damit wir planen können.\n\nHerzliche Grüße,\nAnna',
      status: 'sent', recipients: state.members.filter(m => m.status === 'aktiv').length,
      createdAt: new Date(year, 5, 15).toISOString(), date: new Date(year, 5, 15).toISOString(),
    },
    {
      title: 'Saisonabschluss-Fest planen',
      audience: 'warteliste', depot: null,
      body: 'Liebe Mitglieder,\n\nam 12. Oktober möchten wir mit euch das Ende der Saison feiern...',
      status: 'draft', recipients: 0,
      createdAt: new Date(year, 6, 10).toISOString(), date: null,
    },
  ];
  msgs.forEach(m => state.messages.push({ id: uid('msg'), ...m }));

  return state;
}
