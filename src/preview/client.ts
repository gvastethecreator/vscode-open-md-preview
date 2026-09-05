import { getReadingState } from "../core/reading.ts";

const RUNTIME_KEY = "__openMdPreviewRuntimeV1";
const CONTROL_SELECTOR = "[data-open-md-preview-control]";

export interface PreviewRuntime {
  dispose(): void;
  refresh(): void;
}

export function installPreviewEnhancements(targetWindow: Window): PreviewRuntime {
  const document = targetWindow.document;
  const cleanup: Array<() => void> = [];
  const resetTimers = new Set<number>();
  let animationFrame = 0;
  let refreshQueued = false;

  document.body.classList.add("open-md-preview-ready");

  const progress = document.createElement("div");
  progress.className = "open-md-preview__progress";
  progress.dataset.openMdPreviewControl = "progress";
  progress.setAttribute("role", "progressbar");
  progress.setAttribute("aria-label", "Reading progress");
  progress.setAttribute("aria-valuemin", "0");
  progress.setAttribute("aria-valuemax", "100");
  progress.setAttribute("aria-valuenow", "0");
  progress.hidden = true;
  document.body.append(progress);

  const backToTop = document.createElement("button");
  backToTop.type = "button";
  backToTop.className = "open-md-preview__back-to-top";
  backToTop.dataset.openMdPreviewControl = "back-to-top";
  backToTop.textContent = "Back to top";
  backToTop.hidden = true;
  backToTop.addEventListener("click", () => {
    const reducedMotion = targetWindow.matchMedia("(prefers-reduced-motion: reduce)").matches;
    targetWindow.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  });
  document.body.append(backToTop);

  const updateReadingPosition = () => {
    animationFrame = 0;
    const root = document.documentElement;
    const scrollTop = targetWindow.scrollY || root.scrollTop || document.body.scrollTop;
    const scrollHeight = Math.max(root.scrollHeight, document.body.scrollHeight);
    const state = getReadingState(scrollTop, scrollHeight, targetWindow.innerHeight);
    const percent = Math.round(state.progress * 100);
    progress.hidden = !state.scrollable;
    progress.style.setProperty("--open-md-preview-progress", String(state.progress));
    progress.setAttribute("aria-valuenow", String(percent));
    backToTop.hidden = !state.showBackToTop;
  };

  const scheduleReadingUpdate = () => {
    if (animationFrame) return;
    animationFrame = targetWindow.requestAnimationFrame(updateReadingPosition);
  };

  const enhanceContent = () => {
    wrapTables(document);
    for (const code of document.querySelectorAll<HTMLElement>("pre > code")) {
      if (!isCopyEligible(code)) continue;
      const container = code.parentElement;
      if (!container || container.querySelector(":scope > .open-md-preview__copy")) continue;
      const button = createCopyButton(targetWindow, code, resetTimers);
      container.append(button);
    }
    scheduleReadingUpdate();
  };

  const queueRefresh = () => {
    if (refreshQueued) return;
    refreshQueued = true;
    targetWindow.queueMicrotask(() => {
      refreshQueued = false;
      enhanceContent();
    });
  };

  const MutationObserverConstructor = (targetWindow as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver;
  const observer = new MutationObserverConstructor(queueRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
  targetWindow.addEventListener("scroll", scheduleReadingUpdate, { passive: true });
  targetWindow.addEventListener("resize", scheduleReadingUpdate, { passive: true });
  cleanup.push(
    () => observer.disconnect(),
    () => targetWindow.removeEventListener("scroll", scheduleReadingUpdate),
    () => targetWindow.removeEventListener("resize", scheduleReadingUpdate),
  );

  enhanceContent();

  return {
    dispose() {
      for (const dispose of cleanup.splice(0)) dispose();
      if (animationFrame) targetWindow.cancelAnimationFrame(animationFrame);
      for (const timer of resetTimers) targetWindow.clearTimeout(timer);
      resetTimers.clear();
      unwrapTables(document);
      for (const control of document.querySelectorAll(CONTROL_SELECTOR)) control.remove();
      document.body.classList.remove("open-md-preview-ready");
    },
    refresh: enhanceContent,
  };
}

export function isCopyEligible(code: HTMLElement): boolean {
  const classes = `${code.className} ${code.parentElement?.className ?? ""}`.toLowerCase();
  if (/\b(?:language-)?(?:mermaid|math|latex|katex)\b/u.test(classes)) return false;
  return !code.closest(".mermaid, .katex, .math, [data-math]");
}

export async function copyText(targetWindow: Window, text: string): Promise<boolean> {
  try {
    if (targetWindow.navigator.clipboard?.writeText) {
      await targetWindow.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Use the local DOM fallback below.
  }

  const textarea = targetWindow.document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  targetWindow.document.body.append(textarea);
  textarea.select();
  try {
    const copy = targetWindow.document.execCommand?.("copy") ?? false;
    return copy;
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function createCopyButton(
  targetWindow: Window,
  code: HTMLElement,
  resetTimers: Set<number>,
): HTMLButtonElement {
  const button = targetWindow.document.createElement("button");
  button.type = "button";
  button.className = "open-md-preview__copy";
  button.dataset.openMdPreviewControl = "copy";
  button.setAttribute("aria-label", "Copy code block");
  button.setAttribute("aria-live", "polite");
  button.textContent = "Copy";
  button.addEventListener("click", async () => {
    const copied = await copyText(targetWindow, code.textContent ?? "");
    button.classList.toggle("is-copied", copied);
    button.classList.toggle("is-copy-error", !copied);
    button.textContent = copied ? "Copied" : "Copy failed";
    const timer = targetWindow.setTimeout(() => {
      resetTimers.delete(timer);
      button.classList.remove("is-copied", "is-copy-error");
      button.textContent = "Copy";
    }, 1_600);
    resetTimers.add(timer);
  });
  return button;
}

function wrapTables(document: Document): void {
  for (const table of document.querySelectorAll("table")) {
    if (table.parentElement?.classList.contains("open-md-preview__table-wrap")) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "open-md-preview__table-wrap";
    wrapper.dataset.openMdPreviewControl = "table-wrap";
    table.before(wrapper);
    wrapper.append(table);
  }
}

function unwrapTables(document: Document): void {
  for (const wrapper of document.querySelectorAll<HTMLElement>(".open-md-preview__table-wrap")) {
    const table = wrapper.querySelector(":scope > table");
    if (table) wrapper.before(table);
    wrapper.remove();
  }
}

function startInBrowser(): void {
  const previewWindow = window as unknown as Window & Record<string, PreviewRuntime | undefined>;
  previewWindow[RUNTIME_KEY]?.dispose();
  previewWindow[RUNTIME_KEY] = installPreviewEnhancements(window);
}

if (typeof window !== "undefined" && typeof document !== "undefined") startInBrowser();
