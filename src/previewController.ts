import * as vscode from "vscode";
import {
  AUTO_OPEN_SETTING,
  CONFIGURATION_SECTION,
  SHOW_PREVIEW_TO_SIDE,
  TOGGLE_AUTO_PREVIEW,
} from "./commands.ts";
import {
  isEligibleMarkdown,
  resolveSettingTarget,
  type ActiveTabKind,
  type SettingTarget,
} from "./core/policy.ts";
import { PreviewSessionState } from "./core/session.ts";

const OPEN_DELAY_MS = 80;
const PREVIEW_VIEW_TYPES = new Set(["markdown.preview", "vscode.markdown.preview.editor"]);

export class PreviewController implements vscode.Disposable {
  readonly #session = new PreviewSessionState();
  readonly #subscriptions: vscode.Disposable[] = [];
  #timer: ReturnType<typeof setTimeout> | undefined;
  #disposed = false;
  #paused = false;
  #openingCancellation: vscode.CancellationTokenSource | undefined;
  #openingSourceKey: string | undefined;
  #openingGeneration: number | undefined;
  #previewsBeforeOpening: ReadonlySet<vscode.Tab> | undefined;
  #ownedPreview: vscode.Tab | undefined;
  #ownedPreviewInput: vscode.Tab["input"] | undefined;
  #currentAutoUri: string | undefined;
  #lastMarkdownEditor: vscode.TextEditor | undefined;
  readonly #tabLayouts = new WeakMap<vscode.Tab, string>();

  constructor(_context: vscode.ExtensionContext) {
    this.#subscriptions.push(
      vscode.commands.registerCommand(TOGGLE_AUTO_PREVIEW, () => this.toggleAutoPreview()),
      vscode.commands.registerCommand("openMdPreview.pauseSession", () => this.setPaused(true)),
      vscode.commands.registerCommand("openMdPreview.resumeSession", () => this.setPaused(false)),
      vscode.window.onDidChangeActiveTextEditor((editor) => this.onActiveEditorChanged(editor)),
      vscode.window.tabGroups.onDidChangeTabs((event) => this.onTabsChanged(event)),
      vscode.workspace.onDidChangeConfiguration((event) => this.onConfigurationChanged(event)),
    );
    this.schedule(vscode.window.activeTextEditor);
  }

  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.cancelPending();
    for (const subscription of this.#subscriptions.splice(0)) subscription.dispose();
  }

  private onActiveEditorChanged(editor: vscode.TextEditor | undefined): void {
    if (this.#openingSourceKey) {
      const editorKey = editor ? uriKey(editor.document.uri) : undefined;
      const activeTab = vscode.window.tabGroups.activeTabGroup.activeTab;
      if (editorKey === this.#openingSourceKey || (!editor && (!activeTab || isMarkdownPreview(activeTab) || activeTab.input instanceof vscode.TabInputText && uriKey(activeTab.input.uri) === this.#openingSourceKey))) return;
    }
    this.schedule(editor);
  }

  private onTabsChanged(event: vscode.TabChangeEvent): void {
    // A tab can become visible before executeCommand resolves. Record a newly
    // opened tab while the request is current so a subsequent pause and manual
    // close still preserves per-file suppression.
    if (this.#openingSourceKey && this.#openingGeneration !== undefined &&
      !this.#paused && !this.#disposed && this.#session.isCurrent(this.#openingGeneration)) {
      const opened = event.opened.find((tab) => isMarkdownPreview(tab) && !this.#previewsBeforeOpening?.has(tab));
      if (opened) {
        this.#ownedPreview = opened;
        this.#ownedPreviewInput = opened.input;
        this.#currentAutoUri = this.#openingSourceKey;
      }
    }
    if (this.#ownedPreview && this.#currentAutoUri) {
      const closedOwnedPreview = event.closed.some(
        (tab) => tab === this.#ownedPreview
          || tab.input === this.#ownedPreviewInput,
      );
      if (closedOwnedPreview) {
        this.#session.suppress(this.#currentAutoUri);
        this.#ownedPreview = undefined;
        this.#ownedPreviewInput = undefined;
        this.#currentAutoUri = undefined;
      }
    }
    const previewChanged = [...event.opened, ...event.closed, ...event.changed].some(isMarkdownPreview);
    if (this.#openingSourceKey || previewChanged) return;
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const editorTabChanged = [...event.opened, ...event.changed].filter((tab) => (
      tab.input instanceof vscode.TabInputText
      && uriKey(tab.input.uri) === uriKey(editor.document.uri)
    )).map((tab) => this.layoutChanged(tab)).includes(true);
    if (editorTabChanged) this.schedule(editor);
  }

  // isDirty flips on every edit, save, and autosave. Only a layout change can need the preview again.
  private layoutChanged(tab: vscode.Tab): boolean {
    const layout = `${tab.group.viewColumn}:${tab.isActive}:${tab.isPinned}:${tab.isPreview}`;
    const changed = this.#tabLayouts.get(tab) !== layout;
    this.#tabLayouts.set(tab, layout);
    return changed;
  }

  private onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
    const editor = vscode.window.activeTextEditor ?? this.#lastMarkdownEditor;
    const scope = editor?.document;
    if (!event.affectsConfiguration(`${CONFIGURATION_SECTION}.${AUTO_OPEN_SETTING}`, scope)) return;
    if (scope && isAutoOpenEnabled(scope)) this.#session.clearSuppression(uriKey(scope.uri));
    this.schedule(vscode.window.activeTextEditor ?? this.#lastMarkdownEditor);
  }

  private schedule(editor: vscode.TextEditor | undefined): void {
    const generation = this.cancelPending();
    if (this.#disposed || this.#paused) return;
    if (this.#openingSourceKey) return;
    if (!editor || !this.isEligible(editor) || !isAutoOpenEnabled(editor.document)) return;
    this.#lastMarkdownEditor = editor;
    const key = uriKey(editor.document.uri);
    if (this.#session.isSuppressed(key)) return;
    this.#timer = setTimeout(() => {
      this.#timer = undefined;
      void this.openPreview(editor, key, generation);
    }, OPEN_DELAY_MS);
  }

  private cancelPending(): number {
    const generation = this.#session.nextGeneration();
    this.#openingCancellation?.cancel();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
    return generation;
  }

  private setPaused(paused: boolean): void {
    this.#paused = paused;
    this.cancelPending();
    void vscode.commands.executeCommand("setContext", "openMdPreview.sessionPaused", paused);
    if (!paused) this.schedule(vscode.window.activeTextEditor);
    void vscode.window.showInformationMessage(`open.md Preview: Auto preview ${paused ? "paused" : "resumed"} for this session.`);
  }

  private isEligible(editor: vscode.TextEditor): boolean {
    return isEligibleMarkdown({
      languageId: editor.document.languageId,
      isUntitled: editor.document.isUntitled,
      uriPath: editor.document.uri.path,
      tabKind: activeTabKind(editor),
    });
  }

  private async openPreview(editor: vscode.TextEditor, key: string, generation: number): Promise<void> {
    if (this.#disposed || this.#paused || !this.#session.isCurrent(generation)) return;
    if (vscode.window.activeTextEditor?.document !== editor.document) return;
    if (!this.isEligible(editor) || !isAutoOpenEnabled(editor.document) || this.#session.isSuppressed(key)) return;
    const owned = this.#ownedPreview;
    if (key === this.#currentAutoUri && owned?.isActive && markdownPreviewTabs().includes(owned)) return;

    const previewsBefore = new Set(markdownPreviewTabs());
    this.#previewsBeforeOpening = previewsBefore;
    this.#openingGeneration = generation;
    const cancellation = new vscode.CancellationTokenSource();
    this.#openingCancellation = cancellation;
    this.#openingSourceKey = key;
    try {
      await vscode.commands.executeCommand(SHOW_PREVIEW_TO_SIDE, editor.document.uri);
      if (cancellation.token.isCancellationRequested) return;
      const preview = await waitForMarkdownPreview(previewsBefore, cancellation.token);
      if (cancellation.token.isCancellationRequested || !this.#session.isCurrent(generation) || this.#disposed) return;
      if (!preview) {
        if (this.#session.isCurrent(generation)) await this.reportPreviewFailure();
        return;
      }
      if (!previewsBefore.has(preview) || preview === this.#ownedPreview || preview.input === this.#ownedPreviewInput) {
        this.#ownedPreview = preview;
        this.#ownedPreviewInput = preview.input;
        this.#currentAutoUri = key;
      }
      await this.restoreSourceFocus(editor, preview, generation);
    } catch {
      if (!cancellation.token.isCancellationRequested && !this.#disposed && this.#session.isCurrent(generation)) await this.reportPreviewFailure();
    } finally {
      if (this.#openingCancellation === cancellation) this.#openingCancellation = undefined;
      cancellation.dispose();
      if (this.#openingSourceKey === key) this.#openingSourceKey = undefined;
      this.#openingGeneration = undefined;
      this.#previewsBeforeOpening = undefined;
      if (!this.#disposed && !this.#paused && !this.#session.isCurrent(generation)) {
        this.schedule(vscode.window.activeTextEditor);
      }
    }
  }

  private async restoreSourceFocus(
    editor: vscode.TextEditor,
    preview: vscode.Tab,
    generation: number,
  ): Promise<void> {
    if (!this.#session.isCurrent(generation)) return;
    // activeTextEditor can still report the source while the preview tab has
    // focus. The active tab is the ownership check for restoring focus.
    if (vscode.window.tabGroups.activeTabGroup.activeTab !== preview) return;
    const selections = editor.selections;
    const source = await vscode.window.showTextDocument(editor.document, {
      preserveFocus: false,
      selection: editor.selection,
      viewColumn: editor.viewColumn,
    });
    source.selections = selections;
  }

  private async reportPreviewFailure(): Promise<void> {
    if (!this.#session.claimWarning()) return;
    const action = await vscode.window.showWarningMessage(
      "open.md Preview could not open VS Code's Markdown preview. Check that Markdown Language Features is enabled.",
      "Open Extensions",
    );
    if (action === "Open Extensions") {
      await vscode.commands.executeCommand("workbench.extensions.search", "@builtin markdown-language-features");
    }
  }

  private async toggleAutoPreview(): Promise<void> {
    const activeEditor = vscode.window.activeTextEditor;
    const scopeDocument = activeEditor?.document ?? this.#lastMarkdownEditor?.document;
    const configuration = vscode.workspace.getConfiguration(CONFIGURATION_SECTION, scopeDocument);
    const enabled = configuration.get<boolean>(AUTO_OPEN_SETTING, true);
    const folders = vscode.workspace.workspaceFolders ?? [];
    const writeTarget = resolveSettingTarget(configuration.inspect<boolean>(AUTO_OPEN_SETTING), {
      hasWorkspace: folders.length > 0 || vscode.workspace.workspaceFile !== undefined,
      hasWorkspaceFolder: scopeDocument
        ? vscode.workspace.getWorkspaceFolder(scopeDocument.uri) !== undefined
        : false,
      isMultiRoot: folders.length > 1,
    });
    await configuration.update(
      AUTO_OPEN_SETTING,
      !enabled,
      toConfigurationTarget(writeTarget.target),
      writeTarget.overrideInLanguage,
    );
    if (!enabled && scopeDocument) this.#session.clearSuppression(uriKey(scopeDocument.uri));
    const targetLabel = settingTargetLabel(writeTarget.target, writeTarget.overrideInLanguage);
    void vscode.window.showInformationMessage(
      `open.md Preview: Auto preview ${enabled ? "off" : "on"} for ${targetLabel}.`,
    );
    if (!enabled) this.schedule(vscode.window.activeTextEditor ?? this.#lastMarkdownEditor);
    else this.cancelPending();
  }
}

function isAutoOpenEnabled(document: vscode.TextDocument): boolean {
  return vscode.workspace
    .getConfiguration(CONFIGURATION_SECTION, document)
    .get<boolean>(AUTO_OPEN_SETTING, true);
}

function activeTabKind(editor: vscode.TextEditor): ActiveTabKind {
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  if (!tab) return "unknown";
  if (tab.input instanceof vscode.TabInputText) {
    return uriKey(tab.input.uri) === uriKey(editor.document.uri) ? "text" : "unknown";
  }
  if (tab.input instanceof vscode.TabInputTextDiff) return "diff";
  if (tab.input instanceof vscode.TabInputNotebook || tab.input instanceof vscode.TabInputNotebookDiff) return "notebook";
  if (tab.input instanceof vscode.TabInputCustom) return "custom";
  if (tab.input instanceof vscode.TabInputWebview) return "webview";
  return "unknown";
}

function markdownPreviewTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all.flatMap((group) => group.tabs.filter(isMarkdownPreview));
}

function isMarkdownPreview(tab: vscode.Tab): boolean {
  if (!(tab.input instanceof vscode.TabInputWebview || tab.input instanceof vscode.TabInputCustom)) return false;
  const viewType = tab.input.viewType;
  return PREVIEW_VIEW_TYPES.has(viewType) || viewType.endsWith("-markdown.preview");
}

async function waitForMarkdownPreview(
  previous: ReadonlySet<vscode.Tab>,
  token: vscode.CancellationToken,
): Promise<vscode.Tab | undefined> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (token.isCancellationRequested) return undefined;
    const previews = markdownPreviewTabs();
    const opened = previews.find((tab) => !previous.has(tab));
    const active = previews.find((tab) => tab.isActive);
    const preview = opened ?? active;
    if (preview && vscode.window.tabGroups.activeTabGroup.activeTab === preview) return preview;
    await new Promise<void>((resolve) => {
      const timer = setTimeout(finish, 50);
      const subscription = token.onCancellationRequested(finish);
      function finish(): void { clearTimeout(timer); subscription.dispose(); resolve(); }
    });
  }
  return undefined;
}

function toConfigurationTarget(target: SettingTarget): vscode.ConfigurationTarget {
  switch (target) {
    case "workspaceFolder": return vscode.ConfigurationTarget.WorkspaceFolder;
    case "workspace": return vscode.ConfigurationTarget.Workspace;
    case "global": return vscode.ConfigurationTarget.Global;
  }
}

function settingTargetLabel(target: SettingTarget, language: boolean): string {
  const label = target === "workspaceFolder"
    ? "this folder"
    : target === "workspace"
      ? "this workspace"
      : "all workspaces";
  return language ? `Markdown in ${label}` : label;
}

function uriKey(uri: vscode.Uri): string {
  return uri.toString();
}
