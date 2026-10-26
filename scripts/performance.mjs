import assert from "node:assert/strict";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
import { isEligibleMarkdown, resolveSettingTarget } from "../src/core/policy.ts";
import { getReadingState } from "../src/core/reading.ts";

const iterations = 100_000;
const started = performance.now();
for (let index = 0; index < iterations; index += 1) {
  isEligibleMarkdown({
    languageId: "markdown",
    isUntitled: false,
    tabKind: "text",
    uriPath: `/docs/guide-${index}.md`,
  });
  getReadingState(index % 2_000, 3_000, 800);
  resolveSettingTarget(undefined, { hasWorkspace: true, hasWorkspaceFolder: true, isMultiRoot: true });
}
const elapsed = performance.now() - started;
assert.ok(elapsed < 1_000, `Pure policy loop exceeded 1,000 ms: ${elapsed.toFixed(2)} ms.`);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
for (const [relative, budget] of [
  ["dist/node/extension.cjs", 250 * 1024],
  ["dist/web/extension.cjs", 250 * 1024],
  ["dist/preview/client.js", 100 * 1024],
]) {
  const size = (await stat(path.join(root, relative))).size;
  assert.ok(size < budget, `${relative} exceeds ${budget} bytes.`);
}
console.log(`Performance checks passed: ${iterations} policy iterations in ${elapsed.toFixed(2)} ms and bounded bundles.`);
