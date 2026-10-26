import * as vscode from "vscode";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension("gvastethecreator.open-md-preview");
  assert(extension, "open.md Preview was not discovered in the web host.");
  const folder = vscode.workspace.workspaceFolders?.[0];
  assert(folder, "The virtual test workspace did not open.");
  assert(folder.uri.scheme === "vscode-test-web", "The web test is not using a virtual filesystem.");

  const firstDocument = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, "guide.md"));
  await vscode.window.showTextDocument(firstDocument, { preview: false, viewColumn: vscode.ViewColumn.One });
  await waitFor(() => extension.isActive, "Markdown did not activate the browser bundle.");
  await waitFor(() => markdownPreviewTabs().length === 1, "The web host did not open the native preview.");
  await waitFor(() => vscode.window.activeTextEditor?.document.uri.toString() === firstDocument.uri.toString(), "The web source lost focus.");

  const secondDocument = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder.uri, "second.md"));
  await vscode.window.showTextDocument(secondDocument, { preview: false, viewColumn: vscode.ViewColumn.One });
  await delay(300);
  assert(markdownPreviewTabs().length === 1, "The web host duplicated the dynamic preview.");

  await vscode.commands.executeCommand("openMdPreview.toggleAutoPreview");
  assert(
    vscode.workspace.getConfiguration("openMdPreview", secondDocument).get("autoOpen") === false,
    "The web toggle did not disable automatic preview.",
  );
  assert(extension.packageJSON.browser === "./dist/web/extension.cjs", "The browser bundle contract changed.");
  assert(
    extension.packageJSON.contributes?.["markdown.previewStyles"]?.[0] === "./media/preview.css",
    "The web preview style contribution changed.",
  );
  assert(
    extension.packageJSON.contributes?.["markdown.previewScripts"]?.[0] === "./dist/preview/client.js",
    "The web preview controls contribution changed.",
  );
}

function markdownPreviewTabs(): vscode.Tab[] {
  return vscode.window.tabGroups.all.flatMap((group) => group.tabs.filter((tab) => {
    const input = tab.input;
    if (!(input instanceof vscode.TabInputWebview || input instanceof vscode.TabInputCustom)) return false;
    return ["markdown.preview", "vscode.markdown.preview.editor"].includes(input.viewType)
      || input.viewType.endsWith("-markdown.preview");
  }));
}

async function waitFor(predicate: () => boolean, message: string): Promise<void> {
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(50);
  }
  throw new Error(message);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
