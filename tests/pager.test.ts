import assert from 'node:assert/strict';
import test from 'node:test';
import { dragOffset, swipeTarget, VideoPager } from '../src/lib/pager.ts';

test('vertical swipes move one page at a time, while small taps and reversed flicks keep the page', () => {
  assert.equal(swipeTarget(1499, 1753, 800, -350, -0.2), 1500);
  assert.equal(swipeTarget(1499, 1753, 800, 350, 0.2), 1498);
  assert.equal(swipeTarget(1499, 1753, 800, -5000, -10), 1500);
  assert.equal(swipeTarget(1499, 1753, 800, -30, -0.8), 1500);
  assert.equal(swipeTarget(1499, 1753, 800, -10, -0.8), 1499);
  assert.equal(swipeTarget(1499, 1753, 800, -40, 0.8), 1499);
  assert.equal(swipeTarget(1499, 1753, 800, 0, 0), 1499);
});

test('first/last video and an empty library cannot wrap or scroll into a missing page', () => {
  assert.equal(swipeTarget(0, 1753, 800, 350, 1), 0);
  assert.equal(swipeTarget(1752, 1753, 800, -350, -1), 1752);
  assert.equal(swipeTarget(0, 1, 800, -350, -1), 0);
  assert.equal(swipeTarget(0, 0, 0, -350, -1), 0);
  assert.equal(dragOffset(0, 1753, 800, 200), 40);
  assert.equal(dragOffset(1752, 1753, 800, -200), -40);
  assert.equal(dragOffset(50, 1753, 800, -2000), -800);
});

test('system interruption/resize cancels navigation; a delayed old callback cannot reset the selected page', () => {
  const pager = new VideoPager(1499);
  const interrupted = pager.start(1500, 1753)!;
  pager.cancel();
  assert.equal(pager.finish(interrupted), null);
  assert.equal(pager.index, 1499);
  const next = pager.start(1500, 1753)!;
  assert.equal(pager.finish(interrupted), null);
  assert.equal(pager.finish(next), 1500);
  assert.equal(pager.index, 1500);
  assert.equal(pager.finish(next), null, 'a completion event is applied only once');
});

test('duplicate auto-advance and out-of-range transitions do not move the feed', () => {
  const pager = new VideoPager(10);
  const token = pager.start(11, 20)!;
  assert.equal(pager.start(12, 20), null);
  assert.equal(pager.finish(token), 11);
  assert.equal(pager.start(-1, 20), null);
  assert.equal(pager.start(20, 20), null);
  const snapBack = pager.start(11, 20)!;
  assert.equal(pager.finish(snapBack), 11);
});
