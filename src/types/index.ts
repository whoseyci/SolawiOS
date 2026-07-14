// Core domain types for SolawiOS

export type ShareType = 'small' | 'medium' | 'large';
export type MemberStatus = 'aktiv' | 'pausiert' | 'warteliste' | 'ausgeschieden';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'medium' | 'high';
export type TaskCategory = 'Aussaat' | 'Pflanzung' | 'Pflege' | 'Ernte' | 'Verteilung' | 'Infrastruktur' | 'Verwaltung';
export type HarvestQuality = 'A' | 'B' | 'C';
export type HarvestDestination = 'Verteilung' | 'Hofladen' | 'Verarbeitung' | 'Lager' | 'Kompost';
export type PaymentKind = 'beitrag' | 'ausgabe' | 'sonstig';
export type PaymentMethod = 'bank' | 'lastschrift' | 'bar' | 'paypal';
export type Cycle = 'einjährig' | 'zweijährig' | 'mehrjährig';
export type PlantingMethod = 'Direktsaat' | 'Vorkultur' | 'Pflanzung';
export type LightNeed = 'sonnig' | 'halbschattig' | 'schattig';
export type WaterNeed = 'niedrig' | 'mittel' | 'hoch';
export type SoilType = 'lehmig' | 'sandig' | 'tonig' | 'humos' | 'misch';
export type Nutrition = 'Schwachzehrer' | 'Mittelzehrer' | 'Starkzehrer';
export type MessageAudience = 'all' | 'active' | 'warteliste' | 'depot';
export type MessageStatus = 'draft' | 'sent';

export interface SharePrice { small: number; medium: number; large: number; }

export interface Farm {
  name: string;
  since: number;
  hectares: number;
  members_target: number;
  founder: string;
}

export interface FarmMeta {
  farm: Farm;
  season: number;
  currency: 'EUR' | 'CHF' | 'USD';
  sharePrice: SharePrice;
  shareUnit: string;
}

export interface Member {
  id: string;
  name: string;
  status: MemberStatus;
  email: string;
  phone: string;
  address: string;
  city: string;
  since: string | null;
  depot: string | null;
  notes: string;
  allergies: string[];
  joinedAt: string;
}

export interface Share {
  id: string;
  member: string;
  type: ShareType;
  active: boolean;
  start: string;
  end: string | null;
  monthlyPrice: number;
}

export interface Crop {
  id: string;
  name: string;
  variety: string;
  family: string;
  days: number | null;
  cycle: Cycle;
  planting: PlantingMethod;
  light: LightNeed;
  water: WaterNeed;
  soil: string;
  nutrition: Nutrition;
  companions: string[];
  antagonists: string[];
}

export interface Bed {
  id: string;
  name: string;
  zone: string;
  area: number;
  length: number;
  width: number;
  soil: SoilType;
  x: number;
  notes: string;
}

export interface Planting {
  id: string;
  bed: string;
  crop: string;
  year: number;
  sowDate: string | null;
  expectedHarvest: string | null;
  expectedYield: number;
  notes: string;
}

export interface Harvest {
  id: string;
  date: string;
  crop: string;
  bed: string | null;
  amount: number;
  unit: string;
  quality: HarvestQuality;
  destination: HarvestDestination;
  note: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  due: string | null;
  assignee: string;
  hours: number;
  tags: string[];
  createdAt: string;
  doneAt: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  stock: number;
  min: number;
  unit: string;
  price: number;
  supplier: string;
  note: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  name: string;
  icon: string;
  price: number;
  unit: string;
  note: string;
}

export interface OrderItem {
  product: string;
  name: string;
  qty: number;
  price: number;
  total: number;
}

export interface Order {
  id: string;
  member: string;
  date: string;
  delivery: string | null;
  items: OrderItem[];
  total: number;
  status: 'offen' | 'geliefert';
  deliveredAt: string | null;
}

export interface Payment {
  id: string;
  date: string;
  kind: PaymentKind;
  name: string;
  category: string;
  amount: number;
  member: string | null;
  method: PaymentMethod;
  note: string;
}

export interface Depot {
  id: string;
  name: string;
  address: string;
  day: string;
  pickup: string;
  contact: string;
  capacity: number;
  lat: number | null;
  lng: number | null;
  notes: string;
}

export interface Pickup {
  id: string;
  date: string;
  share: string;
  note: string;
  pickedAt: string;
}

export interface Message {
  id: string;
  title: string;
  audience: MessageAudience;
  depot: string | null;
  body: string;
  status: MessageStatus;
  recipients: number;
  createdAt: string;
  date: string | null;
}

export interface State {
  meta: FarmMeta;
  members: Member[];
  shares: Share[];
  crops: Crop[];
  beds: Bed[];
  depots: Depot[];
  plantings: Planting[];
  harvest: Harvest[];
  tasks: Task[];
  inventory: InventoryItem[];
  products: Product[];
  orders: Order[];
  payments: Payment[];
  events: unknown[];
  messages: Message[];
  notes: unknown[];
  pickups: Pickup[];
  budget: Record<string, number>;
}

export type PageId =
  | 'dashboard' | 'members' | 'shares' | 'distribution'
  | 'crops' | 'fieldplan' | 'calendar' | 'harvest'
  | 'tasks' | 'inventory' | 'orders'
  | 'finance' | 'messages' | 'reports' | 'settings';

export interface NavItem {
  id: PageId;
  label: string;
  icon: string; // phosphor icon name
  badge?: () => number;
}

export interface NavGroup {
  group: string;
  items: NavItem[];
}

export interface CommandAction {
  id: string;
  label: string;
  icon: string;
  hint?: string;
  action: () => void;
}

export interface ToastOptions {
  kind?: '' | 'success' | 'error' | 'warn';
  duration?: number;
}
