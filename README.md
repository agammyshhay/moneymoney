
# MoneyMoney - Automated expense tracking from Israeli banks and credit cards

![Build/Release](https://github.com/agammyshhay/moneymoney/workflows/Build/Release/badge.svg?branch=master&event=push)
[![Discord Shield](https://discordapp.com/api/guilds/924617301209260103/widget.png?style=shield)](https://discord.gg/XWWg7xvJyS)

MoneyMoney is a desktop app that automatically fetches transactions from Israeli banks and credit cards and exports them to a JSON file. It can also sync your transactions to the **MoneyMoney companion web app** for a full personal finance dashboard.

Built on top of [Caspion](https://github.com/brafdlog/caspion), the open-source budget tracking app. Internally it uses the [Israeli bank scrapers](https://github.com/eshaham/israeli-bank-scrapers) npm package.


## Features

- One-click sync to fetch transactions from multiple Israeli banks and credit cards
- Export transactions to a **JSON** file
- **MoneyMoney companion app** integration — automatically push transactions to the MoneyMoney web dashboard
- **Automatic periodic sync** — set it and forget it, MoneyMoney runs in the background
- **Sync history** — view past sync results and per-account details
- **Run individual accounts** — scrape a single bank/card without running all of them
- **System tray** support — minimize to tray and keep running in the background
- **Run at Windows startup** — start hidden in the tray so your finances stay up to date
- **Encrypted credentials** — bank login details are stored securely using the OS keychain (keytar)
- Hebrew RTL interface

## Download

Download the latest version from the [Releases](https://github.com/agammyshhay/moneymoney/releases) page.

## Getting Started

1. **Add your bank accounts** — click the add button, choose your bank or credit card, and enter your login credentials.
2. **Run a sync** — click the sync button. MoneyMoney will scrape your accounts and export transactions to a JSON file.
3. **(Optional) Connect to MoneyMoney web app** — go to Settings, enter your MoneyMoney connection code (UUID), and your transactions will automatically sync to the companion web dashboard after every scrape.

### MoneyMoney Companion App

MoneyMoney can push your transactions to the MoneyMoney web app (built on the Base44 platform) for a richer dashboard experience. To set it up:

1. Open **Settings** in the app
2. Enter your **MoneyMoney connection code** (UUID)
3. Click **Test Connection** to verify
4. From now on, every sync will automatically push transactions to the web app

You can also trigger a manual sync to the web app from the Settings page.

### Proxy Support

<details>
<summary>Proxy configuration</summary>

If you're behind a corporate proxy or need to use a proxy server, MoneyMoney supports standard proxy environment variables:

- **`HTTPS_PROXY`** or **`https_proxy`**: Proxy URL for HTTPS requests (e.g., `http://proxy.example.com:8080`)
- **`HTTP_PROXY`** or **`http_proxy`**: Proxy URL for HTTP requests
- **`ALL_PROXY`** or **`all_proxy`**: Fallback proxy URL for all requests
- **`NO_PROXY`** or **`no_proxy`**: Comma-separated list of hostnames/domains that should bypass the proxy

**Example:**

```bash
# On Linux/Mac
export HTTPS_PROXY=http://proxy.example.com:8080
export NO_PROXY=localhost,127.0.0.1
./moneymoney

# On Windows (Command Prompt)
set HTTPS_PROXY=http://proxy.example.com:8080
set NO_PROXY=localhost,127.0.0.1
moneymoney.exe

# On Windows (PowerShell)
$env:HTTPS_PROXY="http://proxy.example.com:8080"
$env:NO_PROXY="localhost,127.0.0.1"
.\moneymoney.exe
```

The proxy settings apply to Chromium browser downloads, bank scraping operations, and all network requests.

</details>

### Report a Problem

Use the **Report a Problem** button in the app. It will show you recent logs and the log file location.


## Development

### Prerequisites

- [Node.js](https://nodejs.org/en/download/) >= 22.12.0
- [`node-gyp`](https://github.com/nodejs/node-gyp#installation) — on Windows, check the box in the Node.js installer. If you have Visual Studio, add the "Desktop development with C++" workload.
- [Yarn](https://yarnpkg.com/getting-started/install)

<details>
<summary>Linux prerequisites</summary>

This project depends on `libsecret` for secure credential storage:

- Debian/Ubuntu: `sudo apt-get install libsecret-1-dev`
- Red Hat-based: `sudo yum install libsecret-devel`
- Arch Linux: `sudo pacman -S libsecret`

</details>

<details>
<summary>Mac prerequisites</summary>

If macOS says MoneyMoney is damaged and can't be opened:
```bash
sudo xattr -r -d com.apple.quarantine /Applications/MoneyMoney.app/
```

For Apple Silicon Macs, if Chromium fails to download, install it manually as described [here](https://linguinecode.com/post/how-to-fix-m1-mac-puppeteer-chromium-arm64-bug), then set the Chromium path in Settings.

</details>

### Running from Source

```bash
yarn          # Install dependencies
yarn watch    # Start the app in development mode with live reload
```

### Build Commands

```bash
yarn build      # Build all packages
yarn compile    # Production build (local directory output)
yarn dist       # Windows installer
```

### Testing & Quality

```bash
yarn test              # All tests
yarn lint              # ESLint check
yarn lint:fix          # ESLint auto-fix
yarn format            # Prettier format
yarn typecheck         # TypeScript check all packages
```

### Architecture

Electron monorepo with three packages:

| Package | Role | Entry Point |
|---------|------|-------------|
| `packages/main` | Electron main process — app lifecycle, IPC handlers, bank scraping, config management | `src/index.ts` |
| `packages/preload` | IPC bridge — exposes safe APIs via `contextBridge` | `src/index.ts` |
| `packages/renderer` | React 18 + MobX UI with Bootstrap 5 (RTL) | `src/index.tsx` |

Communication: **Renderer** <-> **Preload** (contextBridge) <-> **Main** (ipcMain)

## Release

On merge to `master`, the release workflow runs [semantic-release](https://github.com/semantic-release/semantic-release). Commit prefixes that trigger releases: `fix:` (patch), `feat:` (minor).

The `israeli-bank-scrapers-core` dependency is auto-updated daily via a GitHub Actions workflow.

## Disclaimer

Providing your financial account credentials to software is not risk free. We will do our best to protect your credentials, but we take no responsibility for any possible damages. If you want to use this we suggest you ask your financial institution for credentials for a user that has only read access to the relevant account and use those credentials to reduce the potential risk.
![](https://api.segment.io/v1/pixel/page?data=ewogICJ3cml0ZUtleSI6ICJtOVh2MHpHZTFvVWphaVU4cjJUZjJBdU44SThmQlJyYyIsCiAgIm5hbWUiOiAiUkVBRE1FIiwKICAiYW5vbnltb3VzSWQiOiAiYWFhYSIKfQ==)
