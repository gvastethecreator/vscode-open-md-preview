import assert from "node:assert/strict";
import test from "node:test";
import { PreviewSessionState } from "./session.ts";

test("tracks current requests and invalidates stale generations", () => {
  const session = new PreviewSessionState();
  const first = session.nextGeneration();
  assert.equal(session.isCurrent(first), true);
  const second = session.nextGeneration();
  assert.equal(session.isCurrent(first), false);
  assert.equal(session.isCurrent(second), true);
});

test("suppresses and restores one URI without affecting another", () => {
  const session = new PreviewSessionState();
  session.suppress("file:///one.md");
  assert.equal(session.isSuppressed("file:///one.md"), true);
  assert.equal(session.isSuppressed("file:///two.md"), false);
  session.clearSuppression("file:///one.md");
  assert.equal(session.isSuppressed("file:///one.md"), false);
});

test("allows one warning in a window session", () => {
  const session = new PreviewSessionState();
  assert.equal(session.claimWarning(), true);
  assert.equal(session.claimWarning(), false);
});
