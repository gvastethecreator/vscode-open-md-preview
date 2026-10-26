# Implementation evidence

This file records the local 0.1.0 candidate. It does not claim remote CI, publication, or registry availability.

## Contract evidence

- Node target: `dist/node/extension.cjs`
- Web target: `dist/web/extension.cjs`
- Preview client: `dist/preview/client.js`
- Native preview style: `media/preview.css`
- Setting: `openMdPreview.autoOpen`
- Command: `openMdPreview.toggleAutoPreview`
- Minimum VS Code: 1.134.0
- Current stable baseline: 1.136.1

## Verification record

Validated locally on 2026-09-04:

| Gate | Result |
| --- | --- |
| `pnpm run quality` | Pass; 12 unit/DOM tests, typecheck, three bundles, performance, and media |
| Desktop Extension Host 1.134.0 | Pass; focus, reuse, suppression, locked preview, toggle, and exclusions |
| Desktop Extension Host 1.136.1 | Pass; same behavior on current stable |
| Web Extension Host stable | Pass with `vscode-test-web` virtual workspace |
| Light, dark, and high contrast | Pass from the installed VSIX; copy control and focus indicator visible |
| Strict preview security fixture | Pass; local image, link, Mermaid, and KaTeX rendered by VS Code |
| `pnpm run inspect:vsix` | Pass; 14 allowlisted files and no source, tests, maps, dependencies, source media, or network clients |
| `pnpm run test:vsix` | Pass from the frozen package in a clean stable profile |

Package: `open-md-preview.vsix`

SHA-256: `B6EBBD90B4F51E75951C79DCA11D7FBDA54FA29E789093D13D2EA65E7669A844`

The web harness printed expected provider-startup messages while mounting its virtual filesystem; the process completed with exit code 0. No remote CI or publication was run.
