# open.md Preview

VS Code extension (`gvastethecreator.open-md-preview`). pnpm. TypeScript lives in `src/`. esbuild writes `dist/node/extension.cjs`, `dist/web/extension.cjs`, and `dist/preview/client.js`.

## Commands

- Install: `pnpm install --frozen-lockfile`
- Unit tests: `pnpm run test:unit`
- Types: `pnpm run check-types`
- Compile all bundles: `pnpm run compile`
- Desktop host: `pnpm run test:integration`
- Web host: `pnpm run test:web`
- Media: `pnpm run check:media`
- Quality: `pnpm run quality`
- Package: `pnpm run vsix && pnpm run inspect:vsix`
- Installed VSIX: `pnpm run test:vsix`

F5 (`Run Extension`) compiles, then opens `test-workspace/`.

## Rules

- Use pnpm. Do not switch to npm or yarn.
- Product UI strings stay English. Operator chat may be Spanish.
- Keep VS Code's native Markdown renderer. Do not add a custom parser or webview.
- Preserve VS Code preview security and the final precedence of `markdown.styles`.
- Do not add telemetry, network calls, workspace scans, file reads, output logs, or document-content logs.
- Keep policy and reading calculations in `src/core/` without a `vscode` import.
- Keep `docs/PDR.md` byte-identical to the portfolio PDR.
- Accepted provider PNGs are authoritative. Do not create a production SVG or procedural replacement.
- Do not commit, push, publish, create a remote, or rewrite history unless the user asks.

## Layout

- `src/extension.ts` — activation and command registration
- `src/previewController.ts` — native preview lifecycle
- `src/core/` — pure policy, session, and reading logic
- `src/preview/client.ts` — idempotent native-preview controls
- `media/preview.css` — VS Code-token reading layer
- `test/` — desktop, web, and installed-package checks
- `docs/PDR.md` — product contract
