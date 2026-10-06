import assert from 'node:assert/strict';
import test from 'node:test';
import { actionAtEnd, playbackAllowed, seekPosition, showPlaybackButton } from '../src/lib/playback.ts';

test('completion repeats, advances once to the next item, or stops according to the selected mode', () => {
  assert.equal(actionAtEnd({ repeat: true, autoAdvance: false }, true), 'repeat');
  assert.equal(actionAtEnd({ repeat: true, autoAdvance: false }, false), 'repeat');
  assert.equal(actionAtEnd({ repeat: false, autoAdvance: false }, true), 'stop');
  assert.equal(actionAtEnd({ repeat: false, autoAdvance: true }, true), 'advance');
  assert.equal(actionAtEnd({ repeat: false, autoAdvance: true }, false), 'stop', 'last video must not wrap around');
  assert.equal(actionAtEnd({ repeat: true, autoAdvance: true }, false), 'stop', 'conflicting legacy state must not loop the last item');
});

test('playback and late completion events cannot override pause, seek, background, or an open dialog', () => {
  const active = { selected: true, canPlay: true, foreground: true, paused: false, ended: false, scrubbing: false, failed: false };
  assert.equal(playbackAllowed(active), true);
  for (const key of ['selected', 'canPlay', 'foreground'] as const) assert.equal(playbackAllowed({ ...active, [key]: false }), false, key);
  for (const key of ['paused', 'ended', 'scrubbing', 'failed'] as const) assert.equal(playbackAllowed({ ...active, [key]: true }), false, key);
});

test('dragging the seek bar clamps to a playable position even at the track endpoints', () => {
  assert.equal(seekPosition(-10, 60), 0);
  assert.equal(seekPosition(23.4, 60), 23.4);
  assert.equal(seekPosition(60, 60), 59.95);
  assert.equal(seekPosition(600, 60), 59.95);
  assert.equal(seekPosition(5, 0), 0);
  assert.equal(seekPosition(NaN, 60), 0);
  assert.equal(seekPosition(4, Infinity), 0);
});

test('auto-start, buffering, swiping, and system pauses never flash a play/pause button', () => {
  const state = { selected: true, canPlay: true, ready: true, failed: false, scrubbing: false, paused: false, ended: false };
  assert.equal(showPlaybackButton(state), false, 'initial selected page');
  assert.equal(showPlaybackButton({ ...state, ready: false }), false, 'loading/buffering');
  assert.equal(showPlaybackButton({ ...state, canPlay: false }), false, 'temporary swipe/system pause');
  assert.equal(showPlaybackButton({ ...state, paused: true, canPlay: false }), false, 'manually paused page during a swipe');
  assert.equal(showPlaybackButton({ ...state, paused: true }), true, 'explicit pause');
  assert.equal(showPlaybackButton({ ...state, ended: true }), true, 'stopped at the end');
  assert.equal(showPlaybackButton({ ...state, paused: true, scrubbing: true }), false);
});
