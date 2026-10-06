import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import test from 'node:test';
import React from 'react';
import ts from 'typescript';
import * as feed from '../src/lib/feed.ts';
import * as paging from '../src/lib/pager.ts';

const require = createRequire(import.meta.url);
const { create, act } = require('react-test-renderer');
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Render the actual feed component with only native platform primitives replaced.
// This checks React page identity and event wiring without an emulator or video files.
function harness() {
  let gestures: any;
  let nextInstance = 0;
  const animations: any[] = [];
  const listeners = new Map<string, Set<(value?: string) => void>>();
  const appState = {
    currentState: 'active',
    addEventListener(event: string, listener: (value?: string) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
      return { remove: () => listeners.get(event)!.delete(listener) };
    },
  };
  const native = {
    View: 'View', StyleSheet: { create: (styles: unknown) => styles }, AppState: appState,
    Easing: { cubic: (n: number) => n ** 3, out: (fn: unknown) => fn },
    PanResponder: { create: (config: unknown) => { gestures = config; return { panHandlers: {} }; } },
    Animated: {
      View: 'AnimatedView',
      Value: class { value: number; constructor(value: number) { this.value = value; } setValue(value: number) { this.value = value; } },
      subtract: (value: unknown, offset: number) => ({ value, offset }),
      timing(value: { setValue: (n: number) => void }, options: { toValue: number }) {
        let callback: ((event: { finished: boolean }) => void) | undefined;
        let stopped = false;
        const animation = {
          start: (onFinish: typeof callback) => { callback = onFinish; },
          stop: () => { stopped = true; callback?.({ finished: false }); },
          finish: () => { if (!stopped) value.setValue(options.toValue); callback?.({ finished: true }); },
        };
        animations.push(animation);
        return animation;
      },
    },
  };
  function VideoPage(props: any) {
    const [instance] = React.useState(() => ++nextInstance);
    return React.createElement('VideoPage', { ...props, instance });
  }
  const source = readFileSync(new URL('../src/components/video-feed.tsx', import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true, target: ts.ScriptTarget.ES2022,
  } }).outputText;
  const module = { exports: {} as any };
  new Function('require', 'module', 'exports', compiled)((name: string) => {
    if (name === 'react-native') return native;
    if (name === '@/components/video-page') return { VideoPage };
    if (name === '@/lib/feed') return feed;
    if (name === '@/lib/pager') return paging;
    return require(name);
  }, module, module.exports);

  return {
    Component: module.exports.VideoFeed,
    gestures: () => gestures,
    animations,
    emit(event: string, value?: string) {
      if (event === 'change' && value) appState.currentState = value;
      listeners.get(event)?.forEach((listener) => listener(value));
    },
  };
}

const videos = Array.from({ length: 1753 }, (_, i) => ({ id: `video-${i}`, filename: `${i}.mp4`, createdAt: i }));
const pageProps = (onPosition: (id: string) => void) => ({
  videos, height: 800, settings: { ...feed.DEFAULT_SETTINGS, currentId: videos[1499].id },
  blocked: false, sharing: false, onPosition, onBookmark: () => {}, onSettings: () => {}, onShare: () => {},
});
const gesture = { dy: -220, dx: 0, vy: -0.5 };
const selected = (renderer: any) => renderer.root.findAllByType('VideoPage').find((node: any) => node.props.selected).props;

test('the real pager has no system scroll target, preserves player instances on swipe/resize, and commits once', async () => {
  const h = harness();
  const positions: string[] = [];
  const props = pageProps((id) => positions.push(id));
  let renderer: any;
  await act(() => { renderer = create(React.createElement(h.Component, props)); });
  assert.equal(renderer.root.findAllByType('VideoPage').length, 3);
  assert.equal(renderer.root.findAllByType('ScrollView').length, 0);
  assert.equal(renderer.root.findAllByType('FlatList').length, 0);
  const prefetched = renderer.root.findAllByType('VideoPage').find((node: any) => node.props.video.id === videos[1500].id).props.instance;
  assert.equal(h.gestures().onMoveShouldSetPanResponder(null, gesture), true);
  await act(() => { h.gestures().onPanResponderGrant(); h.gestures().onPanResponderMove(null, gesture); });
  assert.equal(selected(renderer).canPlay, false);
  await act(() => { h.gestures().onPanResponderRelease(null, gesture); });
  await act(() => { h.animations.at(-1).finish(); });
  assert.equal(selected(renderer).video.id, videos[1500].id);
  assert.equal(selected(renderer).instance, prefetched, 'the prefetched native player is retained');
  assert.equal(selected(renderer).canPlay, true);
  assert.deepEqual(positions, [videos[1500].id]);
  await act(() => { renderer.update(React.createElement(h.Component, { ...props, height: 838 })); });
  assert.equal(selected(renderer).video.id, videos[1500].id);
  assert.equal(selected(renderer).instance, prefetched, 'system insets must not recreate the player');
  await act(() => { renderer.unmount(); });
});

test('focus loss cancels an in-flight swipe; late callbacks cannot reset position and repeated completion advances once', async () => {
  const h = harness();
  const positions: string[] = [];
  const props = pageProps((id) => positions.push(id));
  props.settings.autoAdvance = true;
  props.settings.repeat = false;
  let renderer: any;
  await act(() => { renderer = create(React.createElement(h.Component, props)); });
  const instance = selected(renderer).instance;
  await act(() => { h.gestures().onPanResponderGrant(); h.gestures().onPanResponderRelease(null, gesture); });
  const cancelled = h.animations.at(-1);
  await act(() => { h.emit('blur'); });
  assert.equal(selected(renderer).canPlay, false);
  await act(() => { h.emit('focus'); cancelled.finish(); });
  assert.equal(selected(renderer).canPlay, true);
  assert.equal(selected(renderer).video.id, videos[1499].id);
  assert.equal(selected(renderer).instance, instance);
  assert.deepEqual(positions, []);
  await act(() => { h.emit('change', 'background'); h.emit('change', 'active'); });
  assert.equal(selected(renderer).video.id, videos[1499].id);
  assert.equal(selected(renderer).instance, instance);
  const before = h.animations.length;
  await act(() => { selected(renderer).onFinished(videos[1499].id); selected(renderer).onFinished(videos[1499].id); });
  assert.equal(h.animations.length, before + 1);
  await act(() => { h.animations.at(-1).finish(); });
  assert.equal(selected(renderer).video.id, videos[1500].id);
  assert.deepEqual(positions, [videos[1500].id]);
  await act(() => { renderer.unmount(); });
});
