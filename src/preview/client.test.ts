import assert from "node:assert/strict";
import test from "node:test";
import { Window as HappyWindow } from "happy-dom";
import { installPreviewEnhancements } from "./client.ts";

test("installs one idempotent set of reading controls", async () => {
  const happyWindow = new HappyWindow({ url: "https://preview.invalid/" });
  const previewWindow = happyWindow as unknown as Window;
  happyWindow.document.body.innerHTML = `
    <h1>Guide</h1>
    <pre><code class="language-ts">const value = 1;\n</code></pre>
    <pre class="mermaid"><code class="language-mermaid">graph TD</code></pre>
    <pre><code class="language-math">x^2</code></pre>
    <table><tbody><tr><td>Cell</td></tr></tbody></table>
  `;
  let copied = "";
  Object.defineProperty(happyWindow.navigator, "clipboard", {
    configurable: true,
    value: { writeText: async (text: string) => { copied = text; } },
  });
  Object.defineProperty(happyWindow, "innerHeight", { configurable: true, value: 800 });
  Object.defineProperty(happyWindow, "scrollY", { configurable: true, value: 700 });
  Object.defineProperty(happyWindow.document.documentElement, "scrollHeight", {
    configurable: true,
    value: 2_000,
  });

  const runtime = installPreviewEnhancements(previewWindow);
  runtime.refresh();
  runtime.refresh();
  await happyWindow.happyDOM.whenAsyncComplete();

  assert.equal(happyWindow.document.querySelectorAll(".open-md-preview__progress").length, 1);
  assert.equal(happyWindow.document.querySelectorAll(".open-md-preview__back-to-top").length, 1);
  assert.equal(happyWindow.document.querySelectorAll(".open-md-preview__copy").length, 1);
  assert.equal(happyWindow.document.querySelectorAll(".open-md-preview__table-wrap").length, 1);

  const progress = happyWindow.document.querySelector(".open-md-preview__progress") as unknown as HTMLElement | null;
  const backToTop = happyWindow.document.querySelector(".open-md-preview__back-to-top") as unknown as HTMLButtonElement | null;
  assert.equal(progress?.hidden, false);
  assert.equal(progress?.getAttribute("aria-valuenow"), "58");
  assert.equal(backToTop?.hidden, false);

  const copy = happyWindow.document.querySelector(".open-md-preview__copy") as unknown as HTMLButtonElement | null;
  copy?.click();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(copied, "const value = 1;\n");
  assert.equal(copy?.textContent, "Copied");

  runtime.dispose();
  assert.equal(happyWindow.document.querySelectorAll("[data-open-md-preview-control]").length, 0);
  assert.equal(happyWindow.document.querySelectorAll("table").length, 1);
  await happyWindow.close();
});
