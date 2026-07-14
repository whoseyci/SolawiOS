// Pages registry — each page is loaded dynamically.
// Each page module exports a `render(root)` function.
import type { PageId } from '../types';

type PageRender = (root: HTMLElement) => void;

// Loaders return the module namespace; pages export `render` from it.
const loaders = {
  dashboard:    () => import('./dashboard'),
  members:      () => import('./members'),
  shares:       () => import('./shares'),
  distribution: () => import('./distribution'),
  crops:        () => import('./crops'),
  fieldplan:    () => import('./fieldplan'),
  calendar:     () => import('./calendar'),
  harvest:      () => import('./harvest'),
  tasks:        () => import('./tasks'),
  inventory:    () => import('./inventory'),
  orders:       () => import('./orders'),
  finance:      () => import('./finance'),
  messages:     () => import('./messages'),
  reports:      () => import('./reports'),
  settings:     () => import('./settings'),
} as const;

export async function renderPage(id: PageId, root: HTMLElement): Promise<void> {
  const loader = loaders[id as keyof typeof loaders];
  if (!loader) return;
  const mod = await loader() as unknown as { render: PageRender };
  mod.render(root);
}
