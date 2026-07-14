# SolawiOS

Open-source farm management system for **Community Supported Agriculture (CSA / Solawi)** operations.

Built as a single-page static site — no backend, no server, no database. All data lives in the browser's `localStorage` and can be exported/imported as JSON at any time.

## Features

- **15 modules**: Dashboard, Members, Shares, Distribution, Crops, Field Plan, Calendar, Harvest, Tasks, Inventory, Orders, Finance, Messages, Reports, Settings
- **Bilingual-ready** UI (currently German)
- **Dark mode** with system-follow option
- **Command palette** (⌘K / Ctrl+K) — 27 quick actions
- **Global search** — jump to any member, share, crop, bed, task
- **Offline-ready** — works without an internet connection once loaded
- **Responsive** — phone, tablet, desktop layouts
- **Keyboard-friendly** — full keyboard navigation
- **Phosphor duotone icons** — easily swappable icon family (see below)
- **Single static bundle** — deployable to any static host

## Tech stack

- **TypeScript** (strict mode)
- **Vite** for the dev server and production build
- **Phosphor Icons** (duotone style, swappable to regular/fill/bold/light/thin)
- **Playwright** for the 79-test end-to-end suite
- **No runtime dependencies** other than the Phosphor icon font

## Quick start

```bash
npm install
npm run dev      # http://localhost:5173
```

Open the page, click around, and the app will seed itself with sample data on first load. Use **Einstellungen → Daten → Alle Daten löschen** to reset.

## Build

```bash
npm run build    # outputs to dist/
npm run preview  # serve dist/ on http://localhost:4173
```

The production bundle is a small set of static files in `dist/` that you can drop on any static host.

## Switching icon style

Open `src/lib/icons.ts` and change the single `ICON_STYLE` constant:

```ts
export const ICON_STYLE: IconStyle = 'duotone';
//                              ^^^^^^^ one of: regular | duotone | fill | bold | light | thin
```

The available styles are:

| Style     | Class prefix   | Visual                                            |
| --------- | -------------- | ------------------------------------------------- |
| `regular` | `ph`           | Outlined, single weight                           |
| `duotone` | `ph-duotone`   | Two-tone filled (default)                         |
| `fill`    | `ph-fill`      | Solid filled                                      |
| `bold`    | `ph-bold`      | Heavier outlines                                  |
| `light`   | `ph-light`     | Thinner outlines                                  |
| `thin`    | `ph-thin`      | Hairline outlines                                 |

Vite resolves the icon CSS at build/dev time, so no network requests are made at runtime.

## Deploying to Cloudflare Pages

SolawiOS is a single static bundle, so deploying to Cloudflare Pages is straightforward.

### Option A — Git integration (recommended)

1. Push the repo to GitHub.
2. In the Cloudflare dashboard, go to **Workers & Pages → Create application → Pages → Connect to Git**.
3. Select the repository and branch (`main`).
4. Set:
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Node version:** `22` (set via the `NODE_VERSION` environment variable, or the `package.json` engines field)
5. Click **Save and Deploy**. Cloudflare will build and publish on every push.

### Option B — Direct upload via the CLI

```bash
npm install -g wrangler
npm run build
wrangler pages deploy dist --project-name=solawios
```

The first time you run this, `wrangler` will prompt you to log in to Cloudflare and create the project. Subsequent deploys use the saved credentials.

### What ships with the deploy

The `public/` directory is copied into `dist/` verbatim, so the following Cloudflare-specific files are bundled with every release:

- `public/_headers` — security & cache headers
- `public/_redirects` — placeholder for future route rules

You can customise the headers (e.g. add `Strict-Transport-Security`) by editing `public/_headers` and rebuilding.

### Custom domain

After the first deploy, attach a custom domain in the Cloudflare Pages dashboard under **Custom domains**. Because the app uses hash-based navigation (`#dashboard`, `#members`, …), no SPA rewrite rule is required.

## Deploying to other static hosts

Drop the contents of `dist/` on any static host:

- Netlify — drag-and-drop `dist/`
- Vercel — `vercel --prod` (build command `npm run build`, output `dist`)
- GitHub Pages — push `dist/` to a `gh-pages` branch
- AWS S3 + CloudFront — `aws s3 sync dist/ s3://your-bucket/`

No server, no Node, no environment variables required at runtime.

## Tests

```bash
npm run dev &   # start the dev server in the background
npm test        # run the Playwright suite
```

The suite contains 79 end-to-end tests covering all 15 modules, the dashboard, the command palette, global search, persistence, responsive layouts, dark mode, and keyboard navigation.

## Project structure

```
src/
├── main.ts                  # App class, init
├── styles/index.css         # All CSS
├── types/index.ts           # All TypeScript interfaces
├── lib/                     # Generic helpers (icons, dom, date, format, store, …)
├── store/                   # stateStore singleton + sample data
├── data/                    # NAV config + CROP_PALETTE
├── components/
│   ├── ui/                  # modal, toast, badge, page-h, empty-state, filter-bar, tabs
│   ├── forms/               # formRow.{input, select, textarea, section, grid}
│   ├── nav/                 # sidebar, topbar
│   ├── charts/              # bar, grouped-bar, donut, time-series
│   ├── command-palette.ts   # ⌘K palette
│   └── global-search.ts     # Topbar search
└── pages/                   # 15 page modules + renderPage() dispatcher
```

## Data export & import

Use **Einstellungen → Daten → Backup (JSON)** to download the full state, and **Wiederherstellen** to upload a previously saved file. Backups include all members, shares, crops, beds, plantings, harvest records, tasks, inventory, orders, payments, messages, and depots.

## License

Built for small farms, big communities. Use freely.
