# Development

Use pnpm 12 and the checked-in lockfile.

## Local loop

```powershell
pnpm install --frozen-lockfile
pnpm run check-types
pnpm run test:unit
pnpm run compile
```

Press F5 to run the extension against `test-workspace/`.

## Verification matrix

| Command | Evidence |
| --- | --- |
| `pnpm run test:unit` | Eligibility, setting targets, suppression, request generations, progress, and idempotent preview controls |
| `pnpm run test:integration` | Desktop Extension Host; set `VSCODE_TEST_VERSION=1.134.0` for the minimum version |
| `pnpm run test:web` | Browser extension host with a virtual workspace |
| `pnpm run test:performance` | Bounded hot-path calculations and bundle sizes |
| `pnpm run check:media` | Imagegen source, native alpha, deterministic icon derivatives, and runtime preview |
| `pnpm run vsix` | Production package at `open-md-preview.vsix` |
| `pnpm run inspect:vsix` | Package allowlist, manifest contract, size limits, and forbidden runtime surfaces |
| `pnpm run test:vsix` | Clean-profile installation and desktop behavior from the package |

Run the broad matrix once after a coherent implementation batch. A visual claim requires the real installed extension in stable VS Code; unit or DOM checks are not visual proof.

## Architecture

The extension-host controller only decides when to call `markdown.showPreviewToSide`. VS Code owns parsing, rendering, preview locking, link handling, and security.

The preview CSS and client script are loaded through the official `markdown.previewStyles` and `markdown.previewScripts` contribution points. The client tears down an earlier instance before adding controls so preview reloads remain idempotent.
