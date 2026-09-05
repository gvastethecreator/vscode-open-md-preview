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
  #openingSourceKey: string | undefined;
  #ownedPreview: vscode.Tab | undefined;
  #ownedPreviewInput: vscode.Tab["input"] | undefined;
  #ownedPreviewColumn: vscode.ViewColumn | undefined;
  #ownedPreviewViewType: string | undefined;
  #currentAutoUri: string | undefined;
  #lastMarkdownEditor: vscode.TextEditor | undefined;

  constructor(_context: vscode.ExtensionContext) {
    this.#subscriptions.push(
      vscode.commands.registerCommand(TOGGLE_AUTO_PREVIEW, () => this.toggleAutoPreview()),
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
      if (editorKey === this.#openingSourceKey || (!editor && activeTab && isMarkdownPreview(activeTab))) return;
    }
    this.schedule(editor);
  }

  private onTabsChanged(event: vscode.TabChangeEvent): void {
    if (this.#ownedPreview && this.#currentAutoUri) {
      const closedOwnedPreview = event.closed.some(
        (tab) => tab === this.#ownedPreview
          || tab.input === this.#ownedPreviewInput
          || this.matchesOwnedPreviewSlot(tab),
      );
      if (closedOwnedPreview) {
        this.#session.suppress(this.#currentAutoUri);
        this.#ownedPreview = undefined;
        this.#ownedPreviewInput = undefined;
        this.#ownedPreviewColumn = undefined;
        this.#ownedPreviewViewType = undefined;
        this.#currentAutoUri = undefined;
      }
    }
    const previewChanged = [...event.opened, ...event.closed, ...event.changed].some(isMarkdownPreview);
    if (this.#openingSourceKey || previewChanged) return;
    const editor = vscode.window.activeTextEditor;
    if (!editor) return;
    const editorTabChanged = [...event.opened, ...event.changed].some((tab) => (
      tab.input instanceof vscode.TabInputText
      && uriKey(tab.input.uri) === uriKey(editor.document.uri)
    ));
    if (editorTabChanged) this.schedule(editor);
  }

  private onConfigurationChanged(event: vscode.ConfigurationChangeEvent): void {
    const editor = vscode.window.activeTextEditor ?? this.#lastMarkdownEditor;
    const scope = editor?.document;
    if (!event.affectsConfiguration(`${CONFIGURATION_SECTION}.${AUTO_OPEN_SETTING}`, scope)) return;
    if (scope && isAutoOpenEnabled(scope)) this.#session.clearSuppression(uriKey(scope.uri));
    this.schedule(vscode.window.activeTextEditor ?? this.#lastMarkdownEditor);
  }

  private schedule(editor: vscode.TextEditor | undefined): void {
    const generation = this.#session.nextGeneration();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
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

  private cancelPending(): void {
    this.#session.nextGeneration();
    if (this.#timer) clearTimeout(this.#timer);
    this.#timer = undefined;
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
    if (this.#disposed || !this.#session.isCurrent(generation)) return;
    if (vscode.window.activeTextEditor?.document !== editor.document) return;
    if (!this.isEligible(editor) || !isAutoOpenEnabled(editor.document) || this.#session.isSuppressed(key)) return;

    const previewsBefore = new Set(markdownPreviewTabs());
    this.#openingSourceKey = key;
    try {
      await vscode.commands.executeCommand(SHOW_PREVIEW_TO_SIDE);
      const preview = await waitForMarkdownPreview(previewsBefore);
      if (!preview) {
        if (this.#session.isCurrent(generation)) await this.reportPreviewFailure();
        return;
      }
      this.#ownedPreview = preview;
      this.#ownedPreviewInput = preview.input;
      this.#ownedPreviewColumn = preview.group.viewColumn;
      this.#ownedPreviewViewType = markdownPreviewViewType(preview);
      this.#currentAutoUri = key;
      if (!this.#session.isCurrent(generation)) return;
      await this.restoreSourceFocus(editor, preview, generation);
    } catch {
      await this.reportPreviewFailure();
    } finally {
      if (this.#openingSourceKey === key) this.#openingSourceKey = undefined;
      if (!this.#disposed && !this.#session.isCurrent(generation)) {
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
    if (vscode.window.activeTextEditor?.document === editor.document) return;
    if (vscode.window.tabGroups.activeTabGroup.activeTab !== preview) return;
    await vscode.window.showTextDocument(editor.document, {
      preserveFocus: false,
      selection: editor.selection,
      viewColumn: editor.viewColumn,
    });
  }

  private matchesOwnedPreviewSlot(tab: vscode.Tab): boolean {
    return isMarkdownPreview(tab)
      && tab.group.viewColumn === this.#ownedPreviewColumn
      && markdownPreviewViewType(tab) === this.#ownedPreviewViewType;
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

function markdownPreviewViewType(tab: vscode.Tab): string | undefined {
  return tab.input instanceof vscode.TabInputWebview || tab.input instanceof vscode.TabInputCustom
    ? tab.input.viewType
    : undefined;
}

async function waitForMarkdownPreview(
  previous: ReadonlySet<vscode.Tab>,
): Promise<vscode.Tab | undefined> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const previews = markdownPreviewTabs();
    const opened = previews.find((tab) => !previous.has(tab));
    const active = previews.find((tab) => tab.isActive);
    if (opened || active) return opened ?? active;
    if (previous.size === 0 && previews.length > 0) return previews.at(-1);
    await delay(50);
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

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
