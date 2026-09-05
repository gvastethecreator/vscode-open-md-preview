# PDR — open.md Preview

- Repo: `https://github.com/gvastethecreator/vscode-open-md-preview`
- Remote: not created

## Status

Version 0.1.0 contract · Priority P1 · Local release candidate

## Product summary

open.md Preview opens VS Code's native Markdown preview beside the active source. It keeps the source focused and adds a focused reading layer.

The extension does not replace the Markdown renderer. VS Code remains responsible for Markdown parsing, links, images, Mermaid, KaTeX, and preview security.

## Release boundary

Version 0.1.0 includes:

- automatic preview for saved Markdown text documents;
- one dynamic preview that follows the active Markdown source;
- session suppression after a user closes an automatic preview;
- one setting and one Command Palette command;
- reading styles, progress, code copy, and back-to-top controls;
- Node and browser extension-host bundles;
- local, remote, virtual, and restricted workspace support.

## Public contract

| Surface | Contract |
| --- | --- |
| `openMdPreview.autoOpen` | Resource-scoped Boolean setting. Default is `true`. It controls future automatic openings only. |
| `openMdPreview.toggleAutoPreview` | Toggle the most specific setting target for the active resource. |
| `markdown.previewStyles` | Load `media/preview.css` in native Markdown previews. |
| `markdown.previewScripts` | Load `dist/preview/client.js` in native Markdown previews. |

The command has no default keybinding or menu contribution outside the Command Palette.

## Eligibility

The active document must use the `markdown` language and have a saved URI. Local, remote, and virtual URI schemes are eligible.

The extension excludes:

- untitled documents;
- diff and notebook inputs;
- MDX documents;
- files for prompts, instructions, chat agents, and skills.

## Preview lifecycle

The controller calls `markdown.showPreviewToSide` after a short internal delay. VS Code owns the dynamic preview and reuses it for later Markdown sources.

The source editor keeps focus. A request generation prevents a late request from restoring focus after the user changes editors.

The extension does not close, move, or unlock a preview. A locked preview remains fixed. VS Code can open one additional dynamic preview.

If the user closes an automatic preview, the source URI enters a window-session suppression set. Re-enabling automatic preview clears suppression for the active URI.

Disabling automatic preview stops future openings. It does not close an existing preview or disable the reading layer.

The first command failure in a window shows one content-free warning. Later failures remain silent and do not retry in a loop.

## Reading layer

The preview uses VS Code fonts and color variables. The content column has a maximum width near 840 pixels and responsive side padding.

The script adds:

- a thin reading-progress bar with ARIA values;
- one copy control for eligible fenced code blocks;
- one back-to-top control for long documents.

The script is idempotent across preview reloads. It removes old listeners before it installs new listeners.

Copy preserves the code block's exact `textContent`. Mermaid and mathematical blocks do not receive a copy control.

Smooth scrolling is disabled when the user prefers reduced motion. Keyboard focus remains visible in every theme.

## Privacy and security

The extension makes no network calls. It has no telemetry, workspace scan, file reader, output channel, or document-content log.

VS Code's Markdown preview security setting remains authoritative. The extension does not rewrite resource URLs or raw HTML behavior.

## Compatibility

| Environment | Contract |
| --- | --- |
| VS Code desktop 1.134+ | Full automatic preview and reading layer. |
| Current desktop stable | Full support and Marketplace media source. |
| VS Code web | Browser bundle and virtual workspace support. |
| Virtual workspace | Full support through editor and tab APIs. |
| Restricted Mode | Full support without workspace execution. |
| Remote extension host | Full support through VS Code APIs. |

`extensionKind: ["ui", "workspace"]` prefers the local UI host and permits a workspace host.

## Verification contract

- pure tests cover eligibility, suppression, setting targets, request generations, warning state, and progress calculations;
- desktop Extension Host tests cover focus, reuse, closure, locked previews, exclusions, toggle behavior, and failure handling;
- web tests cover the browser bundle in a virtual workspace;
- DOM tests cover idempotence, exact copy, progress, keyboard access, ARIA, and reduced motion;
- package inspection enforces the VSIX allowlist;
- a clean-profile test installs and runs the final VSIX;
- the Marketplace preview comes from that installed VSIX in stable VS Code.

## Assets and provenance

The icon is an Imagegen-backed native-alpha raster. It shows a source document beside a rendered document in the portfolio's quiet utility style.

The reading geometry and interaction patterns adapt selected ideas from `open.md`, licensed under MIT. The source revision is `253311e2cd4dc2a612e5ebac8c35358f877214dc`.

## Non-goals

- a custom Markdown parser or webview;
- MDX or automatic diff previews;
- automatic previews for agent files;
- a table of contents, minimap, zoom control, custom theme, or bundled font;
- telemetry, document logging, workspace scans, or network access;
- compatibility layers for obsolete behavior;
- remote repository creation, publication, or release automation during local delivery.

## Definition of done

The source, media, and package pass unit, type, dual-bundle, desktop, web, media, VSIX, and clean-profile checks. The hub and product PDR copies remain byte-identical.
