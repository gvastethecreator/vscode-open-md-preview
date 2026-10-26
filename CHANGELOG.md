# Changelog

## [Unreleased]

- Fixed: edits, saves, and autosave no longer reopen a visible preview or move focus; all selections are kept.
- Pause and Resume show in the Command Palette only when they apply.
- Pause Auto Preview for This Session cancels pending openings without changing saved settings or closing existing previews. Resume uses the current source and keeps per-file suppression after manual closure. Generation and cancellation checks prevent stale openings from claiming ownership or emitting late warnings. Focus restoration requires the actual active preview tab; a newer user editor choice wins. Ownership uses the specific tab/input identity, never only a column and view type. Visual styles remain a separate evaluation.

## 0.1.0 — Unreleased

- Open the native Markdown preview beside eligible saved Markdown documents.
- Preserve source focus and reuse VS Code's unlocked dynamic preview.
- Respect manual closure, locked previews, virtual workspaces, and Restricted Mode.
- Add a resource-scoped automatic-preview toggle.
- Add open.md-inspired reading styles, progress, exact code copy, and back to top.
- Ship separate Node, web, and preview-client bundles.
