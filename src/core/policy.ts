export type ActiveTabKind = "text" | "diff" | "notebook" | "custom" | "webview" | "unknown";

export interface MarkdownCandidate {
  languageId: string;
  isUntitled: boolean;
  uriPath: string;
  tabKind: ActiveTabKind;
}

export type SettingTarget = "global" | "workspace" | "workspaceFolder";

export interface SettingInspection<T> {
  globalValue?: T;
  workspaceValue?: T;
  workspaceFolderValue?: T;
  globalLanguageValue?: T;
  workspaceLanguageValue?: T;
  workspaceFolderLanguageValue?: T;
}

export interface SettingContext {
  hasWorkspace: boolean;
  hasWorkspaceFolder: boolean;
  isMultiRoot: boolean;
}

export interface SettingWriteTarget {
  target: SettingTarget;
  overrideInLanguage: boolean;
}

const EXCLUDED_EXACT_NAMES = new Set(["agent.md", "agents.md", "skill.md"]);
const EXCLUDED_SUFFIXES = [
  ".agent.md",
  ".chatagent.md",
  ".instructions.md",
  ".prompt.md",
  ".skill.md",
];

export function isAgentMarkdownPath(uriPath: string): boolean {
  const normalized = safeDecode(uriPath).replaceAll("\\", "/").toLowerCase();
  const name = normalized.split("/").at(-1) ?? "";
  return EXCLUDED_EXACT_NAMES.has(name) || EXCLUDED_SUFFIXES.some((suffix) => name.endsWith(suffix));
}

export function isEligibleMarkdown(candidate: MarkdownCandidate): boolean {
  return candidate.languageId === "markdown"
    && !candidate.isUntitled
    && candidate.tabKind === "text"
    && !isAgentMarkdownPath(candidate.uriPath);
}

export function resolveSettingTarget(
  inspection: SettingInspection<boolean> | undefined,
  context: SettingContext,
): SettingWriteTarget {
  if (inspection?.workspaceFolderLanguageValue !== undefined) {
    return { target: "workspaceFolder", overrideInLanguage: true };
  }
  if (inspection?.workspaceLanguageValue !== undefined) {
    return { target: "workspace", overrideInLanguage: true };
  }
  if (inspection?.globalLanguageValue !== undefined) {
    return { target: "global", overrideInLanguage: true };
  }
  if (inspection?.workspaceFolderValue !== undefined) {
    return { target: "workspaceFolder", overrideInLanguage: false };
  }
  if (inspection?.workspaceValue !== undefined) {
    return { target: "workspace", overrideInLanguage: false };
  }
  if (inspection?.globalValue !== undefined) {
    return { target: "global", overrideInLanguage: false };
  }
  if (context.isMultiRoot && context.hasWorkspaceFolder) {
    return { target: "workspaceFolder", overrideInLanguage: false };
  }
  if (context.hasWorkspace) {
    return { target: "workspace", overrideInLanguage: false };
  }
  return { target: "global", overrideInLanguage: false };
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
