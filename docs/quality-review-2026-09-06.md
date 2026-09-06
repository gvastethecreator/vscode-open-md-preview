# open.md Preview — additional quality and competitive review

Review date: 2026-09-06. Baseline: `679da865b14625a06b76c72829dc6a8a92a502e7` (`main`).

## Status and verification boundaries

This is a proposed acceptance contract and source review, not an implementation of new controls. Live work state belongs in the accompanying PR. The shipped PDR is unchanged and must remain byte-identical to its portfolio counterpart when later behavior changes.

The current ref, AGENTS, preview wait lifecycle, manifest configuration/contributions and publication steps were re-read. The baseline still has one persistent `autoOpen` setting, static preview CSS/scripts and a bounded wait loop without an internal cancellation argument. No build, DOM suite, desktop/web host, VSIX or performance test was executed: local checkout failed on DNS resolution and pnpm was unavailable.

Pinned evidence: [preview controller](https://github.com/gvastethecreator/vscode-open-md-preview/blob/679da865b14625a06b76c72829dc6a8a92a502e7/src/previewController.ts), [manifest](https://github.com/gvastethecreator/vscode-open-md-preview/blob/679da865b14625a06b76c72829dc6a8a92a502e7/package.json), [preview enhancements](https://github.com/gvastethecreator/vscode-open-md-preview/blob/679da865b14625a06b76c72829dc6a8a92a502e7/src/preview/client.ts), [release](https://github.com/gvastethecreator/vscode-open-md-preview/blob/679da865b14625a06b76c72829dc6a8a92a502e7/.github/workflows/release.yml).

## Product boundary: improve the native preview without taking control away

Keep VS Code's renderer, preview security, user `markdown.styles` precedence and existing auto-open eligibility rules. Reading progress, code-copy controls, table wrapping and per-file session suppression already exist in the reviewed implementation; do not list them as missing features.

[VS Code Markdown documentation](https://code.visualstudio.com/docs/languages/markdown) describes native previews, synchronization and locking. Those are the baseline rather than features to reimplement. The value of this extension is a convenient reading/auto-open layer that does not steal focus, revive deliberately closed previews or break native controls. It need not become a general Markdown publishing suite.

## Pause auto-opening for this window session

Add explicit Pause Auto Preview for This Session and Resume Auto Preview commands. The session pause is distinct from the persistent `autoOpen` preference and from the current per-file suppression after a manual close. Store it only in the controller/session state: no user/workspace settings writes and no cross-window synchronization.

Pausing cancels pending work and stops new automatic openings without closing existing or user-owned previews. Resuming does not forcibly reopen every suppressed file: preserve deliberate close suppression and consider only the currently eligible source. A session reset or dedicated reopen action can have separately documented behavior. Keep commands discoverable through native menus/context state; no permanent status-bar indicator is necessary.

Touchpoints: `src/core/session.ts`, controller scheduling/cancellation, command IDs/manifest and current pure/host tests. No new dependency, filesystem read or background scan is needed.

## Cancellable wait and conservative preview ownership

The reviewed wait performs up to 100 delays of 50 ms; it is bounded, not permanent polling. However, the wait itself does not receive generation/disposal cancellation. Test switching documents, disabling auto-open, pausing or disposing while this wait is pending. A stale completion must not restore focus, adopt a different preview or produce a late warning.

Prefer an event-driven wait with a bounded timeout and explicit cancellation, or a small cancellation-aware version of the existing wait. Every listener/timer must be disposed on success, timeout, cancellation and teardown. Check generation/liveness before each state mutation and warning, not only before entering the operation.

Preview ownership must be conservative. A matching column or Markdown view type alone is insufficient proof that a tab belongs to this automatic opening, especially with multiple or locked previews. Do not close, unlock or steal focus from a manually opened preview. If public APIs cannot unambiguously associate a reused preview with the source, preserve user control and document the limitation rather than guessing.

## Visual enhancement opt-out is conditional

The manifest contributes CSS and scripts statically, while `autoOpen` controls automation only. Therefore, turning off auto-open does not itself remove visual contributions. Document that distinction accurately.

An automation-only mode could be useful, but first verify a supported mechanism that disables the enhancement layer while retaining the native renderer, preview security and user styles. Do not add an ineffective checkbox or a private webview bridge. Any solution must preserve native Mermaid/math behavior and avoid bundling replacement renderers. If no safe small mechanism is available, keep the limitation explicit instead of expanding architecture.

## Additional release findings

The inspected GitHub Release job invokes `gh release` without checkout or explicit repository context, omits a verified-SHA tag target and checks release existence rather than tag identity. Lookup failures are not distinguished from absence. The shown consumers do not explicitly verify downloaded checksum sidecars.

Require explicit repository identity, immutable source SHA from preparation, a tag/ref policy that never moves existing tags, fail-closed API errors and checksum verification before every publisher. Preserve protected environments and artifact-only defaults. Test these contracts without publishing. References: [CLI environment](https://cli.github.com/manual/gh_help_environment), [release creation](https://cli.github.com/manual/gh_release_create).

## Regression acceptance

| Scenario | Required outcome |
| --- | --- |
| Pause while a preview opening is pending | Pending work cancels; no settings mutation or late auto-open. |
| Resume on a deliberately suppressed source | Suppression policy remains explicit and respected. |
| Two editor windows | Session pause is local to its owning window. |
| Rapid source changes, disabled built-in preview, timeout | No stale focus restoration or repeated warning storm. |
| Manual/locked previews in multiple columns | They are not adopted or modified by column/type guesswork. |
| Dispose during wait | All timers/listeners released; no post-disposal state changes. |
| User CSS, High Contrast and reduced motion | User/native precedence and accessibility preserved. |
| Repeated DOM enhancement/refresh/dispose | No duplicate controls; observer/resources released. |
| Auto-open disabled but visual contributions installed | Documentation matches actual behavior. |
| Wrong checksum or tag SHA | Publication aborts before registry changes. |

Run existing session/policy/reading/DOM suites plus desktop, web and installed-VSIX integration. Use rapid-tab and multiple-preview fixtures and record exact editor versions; native preview internals can change independently of pure logic. Measure cold activation, first preview, DOM refresh and teardown separately. Existing CSS/JavaScript contribution size is part of package review, but module-load timing alone is not rendering latency. No measured runtime or compatibility claim is made here.

## Exclusions

No custom Markdown parser or renderer, replacement webview, Chromium/Pandoc exporter, code-block execution, network calls, output logs, document-content logs, workspace scanner or bundled Mermaid/KaTeX replacement. Keep the extension native, session-aware and respectful of explicit user actions.
