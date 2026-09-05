import assert from "node:assert/strict";
import test from "node:test";
import { getReadingState } from "./reading.ts";

test("reports no progress for a short document", () => {
  assert.deepEqual(getReadingState(0, 600, 700), {
    progress: 0,
    scrollable: false,
    showBackToTop: false,
  });
});

test("clamps progress and shows back to top after the midpoint", () => {
  assert.deepEqual(getReadingState(-20, 2_000, 800), {
    progress: 0,
    scrollable: true,
    showBackToTop: false,
  });
  const middle = getReadingState(700, 2_000, 800);
  assert.equal(middle.progress, 700 / 1_200);
  assert.equal(middle.showBackToTop, true);
  assert.equal(getReadingState(3_000, 2_000, 800).progress, 1);
});

test("keeps back to top hidden on a small scroll range", () => {
  const state = getReadingState(400, 1_000, 500);
  assert.equal(state.scrollable, true);
  assert.equal(state.showBackToTop, false);
});
