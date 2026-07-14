import type { NavGroup } from '../types';
import { stateStore } from '../store/state';

export const NAV: NavGroup[] = [
  { group: 'Übersicht', items: [
    { id: 'dashboard', label: 'Dashboard', icon: 'house' },
  ]},
  { group: 'Mitglieder & Ernteanteile', items: [
    { id: 'members', label: 'Mitglieder', icon: 'users', badge: () => stateStore.state.members.length },
    { id: 'shares', label: 'Ernteanteile', icon: 'basket' },
    { id: 'distribution', label: 'Verteilung', icon: 'truck' },
  ]},
  { group: 'Anbau', items: [
    { id: 'crops', label: 'Kulturarten', icon: 'plant' },
    { id: 'fieldplan', label: 'Beetplanung', icon: 'map-trifold' },
    { id: 'calendar', label: 'Anbaukalender', icon: 'calendar-blank' },
    { id: 'harvest', label: 'Ernteerfassung', icon: 'plant' },
  ]},
  { group: 'Betrieb', items: [
    { id: 'tasks', label: 'Aufgaben', icon: 'check-square', badge: () => stateStore.state.tasks.filter(t => t.status !== 'done').length },
    { id: 'inventory', label: 'Lager & Saatgut', icon: 'package' },
    { id: 'orders', label: 'Bestellungen', icon: 'shopping-cart' },
  ]},
  { group: 'Finanzen & Kommunikation', items: [
    { id: 'finance', label: 'Finanzen', icon: 'currency-eur' },
    { id: 'messages', label: 'Mitteilungen', icon: 'envelope-simple' },
    { id: 'reports', label: 'Berichte', icon: 'chart-line-up' },
  ]},
  { group: 'Einstellungen', items: [
    { id: 'settings', label: 'Stammdaten', icon: 'gear' },
  ]},
];
