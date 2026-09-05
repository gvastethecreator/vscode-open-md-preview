# Security review

## Boundaries

- VS Code parses and renders Markdown.
- VS Code controls preview security, link handling, local resources, Mermaid, and KaTeX.
- The extension contributes local CSS and a local client script through official Markdown extension points.
- The extension only observes active editors, tabs, and its own configuration.

## Prohibited surfaces

- no network client;
- no telemetry;
- no workspace enumeration or search;
- no direct file reads;
- no content logging or output channel;
- no custom webview or content-security-policy override;
- no raw HTML rewriting;
- no bundled font or executable dependency.

Package inspection rejects source, tests, maps, build scripts, dependencies, source media, and obvious network or evaluation primitives in runtime bundles.
