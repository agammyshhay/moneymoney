# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MoneyMoney (Caspion) is an Electron desktop app that automatically scrapes transactions from Israeli banks/credit cards, exports them to JSON, and syncs to the MoneyMoney companion app (Base44 platform). Built on the `israeli-bank-scrapers-core` package.

## Commands

```bash
# Install dependencies (must use yarn, not npm)
yarn

# Development - starts all packages in watch mode with live reload
yarn watch

# Build all packages
yarn build

# Production build (local directory output)
yarn compile

# Windows installer
yarn dist

# Tests
yarn test                  # All tests (main + preload + renderer + e2e)
yarn test:main             # vitest run -r packages/main --passWithNoTests
yarn test:preload          # vitest run -r packages/preload --passWithNoTests
yarn test:renderer         # vitest run -r packages/renderer --passWithNoTests
yarn test:e2e              # Builds first, then runs Playwright e2e

# Linting & formatting
yarn lint                  # ESLint check
yarn lint:fix              # ESLint auto-fix
yarn format                # Prettier format all files
yarn format:check          # Prettier check only
yarn typecheck             # TypeScript check all packages
yarn typecheck:main        # TypeScript check main only
yarn typecheck:preload
yarn typecheck:renderer
```

## Architecture

Electron monorepo with three packages under `packages/`:

- **main** — Electron main process (Node.js). App lifecycle, IPC handlers, bank scraping, config management, transaction export. Entry: `packages/main/src/index.ts`. Build output: `packages/main/dist_temp/`.
- **preload** — IPC bridge between main and renderer. Exposes safe APIs via `contextBridge`. Entry: `packages/preload/src/index.ts`. Build output: `packages/preload/dist/`.
- **renderer** — React 18 + MobX UI. Bootstrap components. Entry: `packages/renderer/src/index.tsx`. Build output: `packages/renderer/dist/`.

Communication flow: **Renderer** ↔ **Preload** (contextBridge) ↔ **Main** (ipcMain handlers)

### Main Process Key Modules

- `backend/configManager/` — Config persistence with encrypted credentials (keytar)
- `backend/import/` — Bank scraping via `israeli-bank-scrapers-core` + `puppeteer-core`
- `backend/export/outputVendors/` — Plugin-style exporters — only JSON is active (CSV, Google Sheets, YNAB code exists but is disabled in `index.ts`). Each implements the `OutputVendor` interface from `commonTypes.ts`
- `backend/eventEmitters/` — `BudgetTrackingEventEmitter` for real-time scraping progress events
- `handlers/` — IPC handler registration (bridges preload calls to backend)
- `config/base44.ts` — Default Base44/MoneyMoney API configuration (hardcoded shared app-level URL + API key)

### Renderer Key Modules

- `store/ConfigStore.tsx` — MobX observable store, main app state
- `components/` — React-Bootstrap UI components

### Event Handling — New Transaction Counting

The `EXPORTER_END` event (from `BudgetTrackingEventEmitter`) carries an `ExporterEndEvent` payload with a `newTransactions` field — the count of genuinely new transactions exported (not all downloaded). The renderer listens for this event to accumulate the new-transaction total shown in the summary modal and recorded in sync history.

### System Tray & Window Lifecycle

- `mainWindow.ts` — Window creation, `isQuitting` flag, close-to-tray handler
- `tray.ts` — System tray icon, context menu, balloon notification on minimize
- `minimizeToTray` config field (default: `true`) — controls whether closing the window hides to tray instead of quitting
- `--hidden` CLI flag — starts the app without showing the window (tray-only mode). Used automatically when `runAtStartup` is enabled (`setLoginItemSettings` passes `['--hidden']`). Checked in `mainWindow.ts` (ready-to-show) and `index.ts` (restoreOrCreateWindow).

### Base44 / MoneyMoney Integration

Companion web app integration that pushes scraped transactions to MoneyMoney (built on the Base44 platform). Not a standard output vendor — it syncs the JSON export output separately.

- `packages/main/src/config/base44.ts` — Default API URL and shared API key (hardcoded; app-level secret, not per-user)
- `packages/main/src/backend/export/outputVendors/json/json.ts` — `syncExistingJsonToBase44()` reads JSON export, posts transactions to Base44 API
- `packages/main/src/handlers/index.ts` — IPC handlers: `testBase44Connection`, `syncJsonToBase44`
- `packages/renderer/src/components/Base44Settings.tsx` — UI for entering `base44UserUuid` and triggering sync/test
- Config fields (in JSON vendor options): `base44Url`, `base44ApiKey`, `base44UserUuid`
- Marker: `[CUSTOM-BASE44-START]` / `[CUSTOM-BASE44-END]`
- **User flow:** User only needs to enter their `base44UserUuid` (MoneyMoney connection code). The `base44Url` and `base44ApiKey` have hardcoded shared defaults in `base44.ts` — they're only overridable for development/testing. When the JSON vendor is active and `base44UserUuid` is set, every scraping run automatically pushes transactions to Base44 after writing the JSON file.

## Build System

Vite 5 with per-package configs (`vite.config.js` in each package). Main builds in SSR/Node mode, preload and renderer target Chrome/browser. Uses `unplugin-auto-expose` for preload API auto-exposure.

## Key Conventions

- **ESM throughout** — `"type": "module"` in root package.json
- **Node >= 22.12.0** required (for israeli-bank-scrapers-core compatibility)
- **Semicolons required**, single quotes, trailing commas in multiline
- **Inline type imports** — `import { type Foo }` enforced by ESLint
- **Unused vars** prefixed with `_` are allowed
- **Pre-commit hooks** (simple-git-hooks + nano-staged): ESLint fix + Prettier + TypeScript check on staged files
- **Prettier** line width: 120 characters
- **CSS Modules** preferred for component styling — import as `import styles from './Component.module.css'`. Avoid `<style>` tags inside JSX (causes global CSS pollution).
- **RTL Hebrew app** — The entire UI is in Hebrew with right-to-left layout. Bootstrap 5 RTL variant loaded. Use `margin-inline-start/end` instead of `margin-right/left`. Form inputs expecting LTR content (URLs, API keys) use `direction: ltr` override. All user-facing strings must be in Hebrew.
- **`[CUSTOM-*]` markers** — Custom modifications are wrapped in `[CUSTOM-NAME-START]` / `[CUSTOM-NAME-END]` comments. Marker types: `CUSTOM-STARTUP`, `CUSTOM-THEME`, `CUSTOM-FIX`, `CUSTOM-NEXT-SYNC`, `CUSTOM-SUMMARY`, `CUSTOM-HISTORY`, `CUSTOM-SINGLE-RUN`, `CUSTOM-AUTO-RUN`, `CUSTOM-BASE44`, `CUSTOM-LAYOUT`. Markers span multiple files when a feature touches main + preload + renderer.

## Core Types

`packages/main/src/backend/commonTypes.ts` defines the central types: `Config`, `OutputVendorName` (enum: ynab, googleSheets, json, csv), `OutputVendor` interface, `EnrichedTransaction`, `AccountToScrapeConfig`. Note: `OutputVendorName` still has all four values for config compatibility, but only `json` is active at runtime.

**Duplicate types warning:** The `Config` interface is defined in **three** places that must be kept in sync:
- `packages/main/src/backend/commonTypes.ts` (source of truth)
- `packages/preload/src/commonTypes.ts`
- `packages/renderer/src/types.tsx`

## Environment Variables

Set via Vite env for build-time injection:
- `VITE_GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_SECRET` — Google Sheets OAuth (no longer needed; Google Sheets exporter is disabled)
- `VITE_SENTRY_DSN` — Error tracking
- `VITE_SEGMENT_WRITE_KEY` — Analytics

Runtime proxy support: `HTTPS_PROXY`, `HTTP_PROXY`, `ALL_PROXY`, `NO_PROXY`.

## CI/CD & Automation

### Scraper Auto-Update Workflow

`.github/workflows/update-israeli-bank-scrapers.yml` runs daily at 6 AM UTC. It checks npm for a newer `israeli-bank-scrapers-core` version, runs `yarn typecheck`, and creates a PR (assigned to `agammyshhay`) only if the version changed and types pass. The PR uses a `fix:` commit prefix so merging triggers a patch release via semantic-release. Renovate is configured (`.github/renovate.json`) to ignore `israeli-bank-scrapers-core` to avoid conflicting PRs.

### Release Workflow

On merge to master, `release.yml` runs semantic-release. Commit prefixes that trigger releases: `fix:` (patch), `feat:` (minor). The old `Deps:` prefix does **not** trigger a release — all scraper update PRs now use `fix:`.

## Verification

After major changes, verify core functionality against the use cases in [`USE_CASES.md`](USE_CASES.md).
