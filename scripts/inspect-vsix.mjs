import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yauzl from "yauzl";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const filename = path.resolve(root, process.argv[2] || "open-md-preview.vsix");
assert.ok(filename.endsWith(".vsix"), "No open.md Preview VSIX found.");
assert.ok((await stat(filename)).size < 5 * 1024 * 1024, "VSIX exceeds the 5 MB budget.");

const required = [
  "extension/package.json",
  "extension/dist/node/extension.cjs",
  "extension/dist/web/extension.cjs",
  "extension/dist/preview/client.js",
  "extension/media/icon.png",
  "extension/media/preview.css",
  "extension/media/preview.png",
  "extension/readme.md",
  "extension/changelog.md",
  "extension/LICENSE.txt",
  "extension/SECURITY.md",
  "extension/THIRD_PARTY_NOTICES.md",
];
const { names, contents } = await inspect(filename);
for (const name of required) assert.ok(names.has(name), `Missing packaged file: ${name}`);

for (const name of names) {
  assert.ok(!name.includes(".."), `Unsafe archive entry: ${name}`);
  assert.ok(!name.startsWith("extension/src/"), `Source file leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/test/"), `Test file leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/scripts/"), `Build script leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/docs/"), `Private document leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/node_modules/"), `Dependency leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/media/source/"), `Source media leaked into VSIX: ${name}`);
  assert.ok(!name.startsWith("extension/media/qa/"), `QA media leaked into VSIX: ${name}`);
  assert.ok(!name.endsWith(".map"), `Source map leaked into VSIX: ${name}`);
}

const manifest = JSON.parse(contents.get("extension/package.json").toString("utf8"));
assert.equal(manifest.name, "open-md-preview");
assert.equal(manifest.version, JSON.parse(await readFile(path.join(root, "package.json"), "utf8")).version);
assert.equal(manifest.main, "./dist/node/extension.cjs");
assert.equal(manifest.browser, "./dist/web/extension.cjs");
assert.deepEqual(manifest.activationEvents, ["onLanguage:markdown"]);
assert.deepEqual(manifest.extensionKind, ["ui", "workspace"]);
assert.equal(manifest.capabilities.untrustedWorkspaces.supported, true);
assert.equal(manifest.capabilities.virtualWorkspaces.supported, true);
assert.deepEqual(manifest.contributes.commands.map((entry) => entry.command), [
  "openMdPreview.toggleAutoPreview", "openMdPreview.pauseSession", "openMdPreview.resumeSession",
]);
assert.equal(manifest.contributes.configuration.properties["openMdPreview.autoOpen"].default, true);
assert.equal(manifest.contributes.configuration.properties["openMdPreview.autoOpen"].scope, "resource");
assert.deepEqual(manifest.contributes["markdown.previewStyles"], ["./media/preview.css"]);
assert.deepEqual(manifest.contributes["markdown.previewScripts"], ["./dist/preview/client.js"]);
assert.equal(manifest.contributes.keybindings, undefined, "No default keybinding can ship in 0.1.0.");
assert.deepEqual(Object.keys(manifest.contributes.menus), ["commandPalette"], "Commands must remain in the Command Palette only.");
assert.equal(manifest.contributes.views, undefined, "The extension must not ship a custom view.");

for (const [bundleName, budget] of [
  ["extension/dist/node/extension.cjs", 250 * 1024],
  ["extension/dist/web/extension.cjs", 250 * 1024],
  ["extension/dist/preview/client.js", 100 * 1024],
]) {
  const bundle = contents.get(bundleName).toString("utf8");
  assert.ok(Buffer.byteLength(bundle) < budget, `${bundleName} exceeds its size budget.`);
  for (const forbidden of ["child_process", "XMLHttpRequest", "WebSocket(", "fetch(", "eval("]) {
    assert.equal(bundle.includes(forbidden), false, `${bundleName} contains forbidden runtime surface: ${forbidden}`);
  }
}

console.log(`VSIX inspection passed: ${names.size} bounded files and no source, tests, dependencies, maps, or network clients.`);

function inspect(file) {
  return new Promise((resolve, reject) => {
    yauzl.open(file, { lazyEntries: true }, (openError, zip) => {
      if (openError || !zip) return reject(openError ?? new Error("Could not open VSIX."));
      const names = new Set();
      const contents = new Map();
      zip.on("error", reject);
      zip.on("entry", (entry) => {
        names.add(entry.fileName);
        if (!required.includes(entry.fileName) && entry.fileName !== "extension/package.json") {
          zip.readEntry();
          return;
        }
        zip.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) return reject(streamError ?? new Error(`Could not read ${entry.fileName}.`));
          const chunks = [];
          stream.on("data", (chunk) => chunks.push(chunk));
          stream.on("error", reject);
          stream.on("end", () => {
            contents.set(entry.fileName, Buffer.concat(chunks));
            zip.readEntry();
          });
        });
      });
      zip.on("end", () => resolve({ names, contents }));
      zip.readEntry();
    });
  });
}
