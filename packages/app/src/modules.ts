import type { SolawiModule } from '@solawi/kernel';
import { foundingModule } from '@solawi/module-founding';
import { landModule } from '@solawi/module-land';
import { cultivationModule } from '@solawi/module-cultivation';
import { tasksModule } from '@solawi/module-tasks';
import { membersModule } from '@solawi/module-members';
import { biddingModule } from '@solawi/module-bidding';
import { observationsModule } from '@solawi/module-observations';
import { feedbackModule } from '@solawi/module-feedback';
import { distributionModule } from '@solawi/module-distribution';
import { inventoryModule } from '@solawi/module-inventory';
import { financeModule } from '@solawi/module-finance';

/**
 * Every module known to this build. Presence here does NOT mean a farm has it
 * enabled — that is per-org state in `module_state`. This is the catalogue the
 * farm chooses from (docs/40).
 */
export const ALL_MODULES: readonly SolawiModule[] = [
  foundingModule,
  landModule,
  cultivationModule,
  tasksModule,
  membersModule,
  biddingModule,
  observationsModule,
  feedbackModule,
  distributionModule,
  inventoryModule,
  financeModule,
];

/** Recommendation engine for the five setup questions (docs/40 §1). */
export interface SetupAnswers {
  phase: 'founding' | 'first_season' | 'operating';
  distribution: 'farm_pickup' | 'depots' | 'delivery' | 'self_harvest' | 'mixed';
  contributions: 'bidding' | 'fixed' | 'tiers';
  participation: 'required' | 'expected' | 'voluntary' | 'none';
  households: number;
}

export interface Recommendation {
  moduleId: string;
  reason: string;
}

/**
 * Suggest a module set. A starting point, never a cage — everything stays
 * individually switchable afterwards.
 */
export function recommendModules(a: SetupAnswers): Recommendation[] {
  const out: Recommendation[] = [];

  if (a.phase === 'founding') {
    out.push({ moduleId: 'founding', reason: 'Ihr seid in der Gründung — der Meilensteinpfad begleitet euch.' });
  }

  out.push({ moduleId: 'land', reason: 'Flächen und Beete sind die Grundlage für Anbauplanung und Aufgaben.' });
  out.push({ moduleId: 'cultivation', reason: 'Anbauplanung mit Zeitachse und Fruchtfolge-Wächter.' });
  out.push({ moduleId: 'tasks', reason: 'Aufgaben am Beet, inklusive Reihenfolge-Assistent.' });
  out.push({ moduleId: 'observations', reason: 'Rhythmen und Mengen erfassen — ohne Personentracking.' });
  out.push({ moduleId: 'feedback', reason: 'Fehler und Ideen direkt aus der App melden.' });

  if (a.phase !== 'founding') {
    out.push({ moduleId: 'members', reason: 'Haushalte, Anteile und Abwesenheiten verwalten.' });
  }

  if (a.distribution !== 'self_harvest') {
    out.push({ moduleId: 'distribution', reason: 'Verteilung, Depots und Abwesenheiten organisieren.' });
  }
  out.push({ moduleId: 'inventory', reason: 'Werkzeug: wo ist es, wer hat es, was ist fällig.' });
  out.push({ moduleId: 'finance', reason: 'Vollkostenrechnung und Einnahmequellen im Blick.' });

  if (a.contributions === 'bidding') {
    out.push({ moduleId: 'bidding', reason: 'Ihr nutzt eine Bieterrunde — inklusive Richtwert über Anteilsäquivalente.' });
  }

  return out;
}
