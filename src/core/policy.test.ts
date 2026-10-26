import assert from "node:assert/strict";
import test from "node:test";
import { isAgentMarkdownPath, isEligibleMarkdown, resolveSettingTarget } from "./policy.ts";

test("accepts saved Markdown text documents for local and virtual URIs", () => {
  for (const uriPath of ["/workspace/README.md", "/docs/guide.markdown", "/virtual/notes.md"]) {
    assert.equal(isEligibleMarkdown({ languageId: "markdown", isUntitled: false, tabKind: "text", uriPath }), true);
  }
});

test("rejects untitled, non-Markdown, diff, notebook, and custom inputs", () => {
  const base = { languageId: "markdown", isUntitled: false, tabKind: "text" as const, uriPath: "/docs/guide.md" };
  assert.equal(isEligibleMarkdown({ ...base, isUntitled: true }), false);
  assert.equal(isEligibleMarkdown({ ...base, languageId: "mdx" }), false);
  assert.equal(isEligibleMarkdown({ ...base, tabKind: "diff" }), false);
  assert.equal(isEligibleMarkdown({ ...base, tabKind: "notebook" }), false);
  assert.equal(isEligibleMarkdown({ ...base, tabKind: "custom" }), false);
});

test("rejects recognized agent Markdown names without excluding normal docs", () => {
  for (const path of [
    "/repo/AGENTS.md",
    "/repo/SKILL.md",
    "/repo/review.prompt.md",
    "/repo/team.instructions.md",
    "/repo/builder.chatagent.md",
    "/repo/audit.agent.md",
    "/repo/encoded%2Eprompt%2Emd",
  ]) {
    assert.equal(isAgentMarkdownPath(path), true, path);
  }
  for (const path of ["/repo/README.md", "/repo/agent-guide.md", "/repo/skills.md"]) {
    assert.equal(isAgentMarkdownPath(path), false, path);
  }
});

test("uses the highest-precedence existing setting override", () => {
  const context = { hasWorkspace: true, hasWorkspaceFolder: true, isMultiRoot: true };
  assert.deepEqual(resolveSettingTarget({ globalValue: true }, context), {
    target: "global",
    overrideInLanguage: false,
  });
  assert.deepEqual(resolveSettingTarget({ globalLanguageValue: true, workspaceFolderValue: false }, context), {
    target: "global",
    overrideInLanguage: true,
  });
  assert.deepEqual(resolveSettingTarget({ workspaceLanguageValue: false, globalLanguageValue: true }, context), {
    target: "workspace",
    overrideInLanguage: true,
  });
  assert.deepEqual(resolveSettingTarget({ workspaceFolderLanguageValue: true, workspaceLanguageValue: false }, context), {
    target: "workspaceFolder",
    overrideInLanguage: true,
  });
});

test("chooses folder, workspace, or global for a new override", () => {
  assert.deepEqual(resolveSettingTarget(undefined, {
    hasWorkspace: true,
    hasWorkspaceFolder: true,
    isMultiRoot: true,
  }), { target: "workspaceFolder", overrideInLanguage: false });
  assert.deepEqual(resolveSettingTarget(undefined, {
    hasWorkspace: true,
    hasWorkspaceFolder: true,
    isMultiRoot: false,
  }), { target: "workspace", overrideInLanguage: false });
  assert.deepEqual(resolveSettingTarget(undefined, {
    hasWorkspace: false,
    hasWorkspaceFolder: false,
    isMultiRoot: false,
  }), { target: "global", overrideInLanguage: false });
});
