# Media provenance

## Extension icon

- Generator: OpenAI Imagegen built-in generation.
- Accepted source: `media/source/open-md-preview-imagegen.png`.
- Production derivative: `media/icon.png`, 256×256 PNG with native alpha.
- QA derivatives: `media/qa/icon-64.png` and `media/qa/icon-32.png`.
- Derivation: deterministic `sharp` contain resize through `pnpm run render:media`.
- Production SVG: none.

The accepted mark uses one split document: Markdown source on the left and rendered reading content on the right. Plum, coral, warm yellow, and neutral surfaces make it a companion to `open.md` without copying its mark.

## Marketplace preview

`media/preview.png` is captured from the packaged extension installed in a clean stable VS Code profile. It must show the source editor on the left, the styled native preview on the right, and at least one extension control.

`pnpm run check:media` validates the provider source, deterministic derivatives, native alpha, visible bounds, and preview dimensions.
