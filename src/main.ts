// SolawiOS — main entry point.
// Boots the app: injects styles, builds the shell, wires up navigation and the store.

import './styles/index.css';
import { injectIconStyles } from './lib/icons';
import { h, clear } from './lib/dom';
import { stateStore } from './store/state';
import { renderSidebar, setNavHandler, setActivePage, refreshBadges } from './components/nav/sidebar';
import { renderTopbar, setTopbarTitle } from './components/nav/topbar';
import { renderPage } from './pages';
import { setCommandNav, initCommandPalette } from './components/command-palette';
import { setSearchNav, initGlobalSearch } from './components/global-search';
import { TODAY } from './lib/date';
import { Store } from './lib/store';
import type { PageId } from './types';

injectIconStyles();

class App {
  private currentPage: PageId = 'dashboard';
  private pageContainer: HTMLElement;

  constructor(root: HTMLElement) {
    clear(root);
    const app = h('<div class="app"></div>') as HTMLElement;
    const sidebar = renderSidebar();
    const main = h('<main class="main"></main>') as HTMLElement;
    main.appendChild(renderTopbar());
    this.pageContainer = h('<div class="content"><div class="page" id="page-container"></div></div>') as HTMLElement;
    main.appendChild(this.pageContainer);
    app.append(sidebar, main);
    root.appendChild(app);
    setNavHandler(id => this.navigate(id));
    setCommandNav(id => this.navigate(id));
    setSearchNav(id => this.navigate(id));
    initCommandPalette();
    initGlobalSearch();
    document.addEventListener('solawios:refresh', () => this.renderCurrent());
    stateStore.on('change', () => {
      refreshBadges();
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && document.querySelectorAll('.modal-backdrop').length > 0) {
        const last = document.querySelector('.modal-backdrop:last-child') as HTMLElement | null;
        last?.remove();
      }
    });
  }

  async navigate(id: PageId): Promise<void> {
    if (id === this.currentPage) return;
    this.currentPage = id;
    setActivePage(id);
    setTopbarTitle(id);
    await this.renderCurrent();
    history.replaceState(null, '', `#${id}`);
  }

  async renderCurrent(): Promise<void> {
    const container = document.getElementById('page-container')!;
    if (!container) return;
    clear(container);
    try {
      await renderPage(this.currentPage, container);
    } catch (e) {
      console.error('Render error:', e);
      const icon = '<i class="ph-duotone ph-warning" aria-hidden="true"></i>';
      const node = h(`<div class="empty-state">${icon}<h3>Fehler beim Laden</h3><p></p></div>`) as HTMLElement;
      (node.querySelector('p') as HTMLElement).textContent = (e as Error).message;
      container.appendChild(node);
    }
  }

  start(): void {
    const hash = window.location.hash.slice(1) as PageId;
    if (hash) this.currentPage = hash;
    setActivePage(this.currentPage);
    setTopbarTitle(this.currentPage);
    this.renderCurrent();
  }
}

const root = document.getElementById('app')!;
const app = new App(root);
app.start();

// Expose for testing (Playwright, manual debugging)
(window as any).app = app;
(window as any).navigate = (id: string) => app.navigate(id as PageId);
// Use a getter so test code always reads the live state, not a stale snapshot
// captured before the first stateStore.update() call.
Object.defineProperty(window, 'state', {
  get: () => stateStore.state,
  configurable: true,
});
(window as any).Store = {
  save: () => Store.save(stateStore.state),
  load: () => Store.load(),
  reset: () => stateStore.reset(),
};

console.info(`SolawiOS ready. Today: ${TODAY.toDateString()}`);
