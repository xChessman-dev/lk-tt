export type PlaybackMode = { repeat: boolean; autoAdvance: boolean };

export function actionAtEnd(mode: PlaybackMode, canAdvance: boolean): 'repeat' | 'advance' | 'stop' {
  if (mode.autoAdvance && canAdvance) return 'advance';
  if (mode.repeat && !mode.autoAdvance) return 'repeat';
  return 'stop';
}

export function seekPosition(requested: number, duration: number) {
  if (!Number.isFinite(requested) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(Math.max(0, duration - 0.05), requested));
}

// The same eligibility rule governs play, resume, and native end-of-video events.
export function playbackAllowed(state: {
  selected: boolean; canPlay: boolean; foreground: boolean; paused: boolean;
  ended: boolean; scrubbing: boolean; failed: boolean;
}) {
  return state.selected && state.canPlay && state.foreground && !state.paused
    && !state.ended && !state.scrubbing && !state.failed;
}

export function showPlaybackButton(state: {
  selected: boolean; canPlay: boolean; ready: boolean; failed: boolean;
  scrubbing: boolean; paused: boolean; ended: boolean;
}) {
  return state.selected && state.canPlay && state.ready && !state.failed && !state.scrubbing
    && (state.paused || state.ended);
}
