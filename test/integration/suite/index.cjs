const assert = require("node:assert/strict");
const vscode = require("vscode");

const EXTENSION_ID = "gvastethecreator.open-md-preview";
const TOGGLE = "openMdPreview.toggleAutoPreview";

async function run() {
  const extension = vscode.extensions.getExtension(EXTENSION_ID);
  assert.ok(extension, "open.md Preview was not discovered.");
  assert.deepEqual(extension.packageJSON.extensionKind, ["ui", "workspace"]);
  assert.equal(extension.packageJSON.capabilities.untrustedWorkspaces.supported, true);
  assert.equal(extension.packageJSON.capabilities.virtualWorkspaces.supported, true);
  assert.deepEqual(extension.packageJSON.activationEvents, ["onLanguage:markdown"]);

  const guide = await showWorkspaceFile("guide.md");
  await waitFor(() => extension.isActive, "Opening Markdown did not activate open.md Preview.");
  await waitFor(() => markdownPreviewTabs().length === 1, "The first automatic preview did not open.");
  await waitFor(
    () => vscode.window.activeTextEditor?.document.uri.toString() === guide.document.uri.toString(),
    "The source editor did not keep focus.",
  );
  const firstPreview = markdownPreviewTabs()[0];
  const firstPreviewGroup = groupForTab(firstPreview);
  assert.ok(firstPreviewGroup.viewColumn > guide.viewColumn, "The preview did not open to the right of the source.");

  const second = await showWorkspaceFile("second.md");
  await waitFor(
    () => vscode.window.activeTextEditor?.document.uri.toString() === second.document.uri.toString(),
    "The second source did not keep focus.",
  );
  await delay(300);
  assert.equal(markdownPreviewTabs().length, 1, "The dynamic preview was duplicated.");

  const dynamicPreview = markdownPreviewTabs()[0];
  await vscode.window.tabGroups.close(dynamicPreview, true);
  await waitFor(() => markdownPreviewTabs().length === 0, "The automatic preview did not close.");
  await showWorkspaceFile("plain.txt");
  await showWorkspaceFile("second.md");
  await delay(400);
  assert.equal(markdownPreviewTabs().length, 0, "The manually closed preview reopened in the same session.");

  await vscode.commands.executeCommand(TOGGLE);
  assert.equal(autoOpen(second.document), false, "The toggle did not disable automatic preview.");
  await vscode.commands.executeCommand(TOGGLE);
  assert.equal(autoOpen(second.document), true, "The toggle did not enable automatic preview.");
  await waitFor(() => markdownPreviewTabs().length === 1, "Re-enabling did not clear suppression for the active source.");

  await closeAllEditors();
  const lockedSource = await showWorkspaceFile("guide.md");
  await waitFor(() => markdownPreviewTabs().length === 1, "The second source preview did not open.");
  await vscode.window.tabGroups.close(markdownPreviewTabs(), true);
  await showWorkspaceFile("plain.txt");
  await vscode.window.showTextDocument(lockedSource.document, { preview: false, viewColumn: vscode.ViewColumn.One });
  await vscode.commands.executeCommand("markdown.showLockedPreviewToSide");
  await waitFor(() => markdownPreviewTabs().length === 1, "The native locked preview did not open.");
  const lockedPreview = markdownPreviewTabs()[0];
  await showWorkspaceFile("third.md");
  await waitFor(() => markdownPreviewTabs().length === 2, "A dynamic preview did not open beside the locked preview.");
  assert.ok(markdownPreviewTabs().includes(lockedPreview), "The locked preview was replaced or closed.");

  await closeAllEditors();
  await showWorkspaceFile("AGENTS.md");
  await assertNoPreview("An agent instruction file opened an automatic preview.");

  await closeAllEditors();
  const untitled = await vscode.workspace.openTextDocument({ content: "# Untitled", language: "markdown" });
  await vscode.window.showTextDocument(untitled, { preview: false });
  await assertNoPreview("An untitled Markdown document opened an automatic preview.");

  await closeAllEditors();
  await showWorkspaceFile("plain.txt");
  await assertNoPreview("A non-Markdown file opened an automatic preview.");

  await closeAllEditors();
  const folder = vscode.workspace.workspaceFolders[0].uri;
  const left = vscode.Uri.joinPath(folder, "guide.md");
  const right = vscode.Uri.joinPath(folder, "second.md");
  await vscode.commands.executeCommand("vscode.diff", left, right, "Markdown diff");
  await assertNoPreview("A Markdown diff opened an automatic preview.");

  await closeAllEditors();
  const sessionUri = vscode.Uri.joinPath(folder, "session.md");
  await vscode.workspace.fs.writeFile(sessionUri, new TextEncoder().encode("# Session fixture\n"));
  const configurationBefore = JSON.stringify(vscode.workspace.getConfiguration("openMdPreview", sessionUri).inspect("autoOpen"));
  await vscode.commands.executeCommand("openMdPreview.pauseSession");
  await showWorkspaceFile("session.md");
  await assertNoPreview("Paused session opened an automatic preview.");
  await vscode.commands.executeCommand("openMdPreview.resumeSession");
  await waitFor(() => markdownPreviewTabs().length === 1, "Resuming did not open the current eligible source.");
  const sessionPreview = markdownPreviewTabs()[0];
  await vscode.commands.executeCommand("openMdPreview.pauseSession");
  assert.ok(markdownPreviewTabs().includes(sessionPreview), "Pause closed an existing preview.");
  await vscode.window.tabGroups.close(sessionPreview, true);
  await showWorkspaceFile("session.md");
  await vscode.commands.executeCommand("openMdPreview.resumeSession");
  await assertNoPreview("Resume lost manual per-file suppression.");
  assert.equal(JSON.stringify(vscode.workspace.getConfiguration("openMdPreview", sessionUri).inspect("autoOpen")), configurationBefore, "Session pause changed saved settings.");

  await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(folder, "cancelled.md"), new TextEncoder().encode("# Cancelled opening\n"));
  await showWorkspaceFile("cancelled.md");
  await vscode.commands.executeCommand("openMdPreview.pauseSession");
  await assertNoPreview("Pause did not cancel a scheduled opening.");
  const newerEditor = await showWorkspaceFile("plain.txt");
  await vscode.commands.executeCommand("openMdPreview.resumeSession");
  await assertNoPreview("Resume ignored the current non-Markdown editor.");
  assert.equal(vscode.window.activeTextEditor.document, newerEditor.document);

  console.log("open.md Preview desktop integration passed: focus, reuse, suppression, lock, toggle, session pause/cancellation, and exclusions.");
}

function autoOpen(document) {
  return vscode.workspace.getConfiguration("openMdPreview", document).get("autoOpen", true);
}

function markdownPreviewTabs() {
  return vscode.window.tabGroups.all.flatMap((group) => group.tabs.filter((tab) => {
    const input = tab.input;
    if (!(input instanceof vscode.TabInputWebview || input instanceof vscode.TabInputCustom)) return false;
    return ["markdown.preview", "vscode.markdown.preview.editor"].includes(input.viewType)
      || input.viewType.endsWith("-markdown.preview");
  }));
}

function groupForTab(tab) {
  const group = vscode.window.tabGroups.all.find((candidate) => candidate.tabs.includes(tab));
  assert.ok(group, "The preview tab has no editor group.");
  return group;
}

async function showWorkspaceFile(relative) {
  const folder = vscode.workspace.workspaceFolders[0].uri;
  const document = await vscode.workspace.openTextDocument(vscode.Uri.joinPath(folder, relative));
  return vscode.window.showTextDocument(document, { preview: false, viewColumn: vscode.ViewColumn.One });
}

async function closeAllEditors() {
  await vscode.commands.executeCommand("workbench.action.closeAllEditors");
  await delay(150);
}

async function assertNoPreview(message) {
  await delay(400);
  assert.equal(markdownPreviewTabs().length, 0, message);
}

async function waitFor(predicate, message, timeout = 12_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(50);
  }
  throw new Error(message);
}

function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

module.exports = { run };
