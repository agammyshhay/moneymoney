# Code Signing Policy

## Signing Authority

This project's release binaries are signed using a certificate provided by [SignPath Foundation](https://signpath.org), a free code signing service for open source projects.

## Team Roles

| Role | Member |
|------|--------|
| Author | [@agammyshhay](https://github.com/agammyshhay) |
| Reviewer | [@agammyshhay](https://github.com/agammyshhay) |
| Approver | [@agammyshhay](https://github.com/agammyshhay) |

## Privacy Statement

This program will not transfer any information to other networked systems unless specifically requested by the user.

All network activity in MoneyMoney is user-initiated:

- **Bank scraping** — connects to bank websites only when the user triggers a sync (or enables automatic periodic sync in settings)
- **Base44 / MoneyMoney web app sync** — pushes transactions to the companion web app only when the user has configured their connection code and triggered a sync

No analytics, telemetry, or tracking data is collected or transmitted.

## Build & Release Process

Release builds are produced via GitHub Actions (`.github/workflows/release.yml`):

- Triggered by merging to `master` (via semantic-release) or manual dispatch
- Builds from source with pinned Node.js version and yarn lockfile
- Multi-platform matrix (Windows, macOS, Linux)
- All build artifacts are published as GitHub Releases

## License

MoneyMoney is licensed under the [MIT License](LICENSE).
