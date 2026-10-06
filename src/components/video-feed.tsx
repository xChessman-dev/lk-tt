import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Animated, AppState, Easing, PanResponder, StyleSheet, View } from 'react-native';
import { VideoPage } from '@/components/video-page';
import { restoredIndex, type FeedSettings, type VideoItem } from '@/lib/feed';
import { dragOffset, swipeTarget, VideoPager } from '@/lib/pager';

type Props = {
  videos: VideoItem[]; height: number; settings: FeedSettings; blocked: boolean; sharing: boolean;
  onPosition: (id: string) => void; onBookmark: (id: string) => void;
  onSettings: (patch: Partial<FeedSettings>) => void; onShare: (video: VideoItem) => void;
};

export function VideoFeed(props: Props) {
  const [index, setIndex] = useState(() => restoredIndex(props.videos, props.settings.currentId));
  const [moving, setMoving] = useState(false);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [playbackRevision, setPlaybackRevision] = useState(0);
  const [pager] = useState(() => new VideoPager(index));
  const [translation] = useState(() => new Animated.Value(0));
  const transform = useMemo(() => Animated.subtract(translation, props.height), [translation, props.height]);
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const distance = useRef(0);
  const scrubbing = useRef(false);
  const latest = useRef({ props, foreground, moving });
  latest.current = { props, foreground, moving };

  const cancelMotion = useCallback(() => {
    pager.cancel();
    animation.current?.stop();
    animation.current = null;
    translation.setValue(0);
    distance.current = 0;
    latest.current.moving = false;
    setMoving(false);
  }, [pager, translation]);

  useEffect(() => {
    let appActive = AppState.currentState === 'active';
    let windowFocused = true;
    const publish = () => {
      const active = appActive && windowFocused;
      latest.current.foreground = active;
      setForeground(active);
      if (active) setPlaybackRevision((value) => value + 1);
      else cancelMotion();
    };
    const change = AppState.addEventListener('change', (state) => { appActive = state === 'active'; publish(); });
    const blur = AppState.addEventListener('blur', () => { windowFocused = false; publish(); });
    const focus = AppState.addEventListener('focus', () => { windowFocused = true; publish(); });
    return () => {
      change.remove(); blur.remove(); focus.remove();
      pager.cancel();
      animation.current?.stop();
    };
  }, [cancelMotion, pager]);

  // Resize/reposition the same player views; never remount the feed for system insets.
  useLayoutEffect(() => { cancelMotion(); }, [props.height, cancelMotion]);
  useLayoutEffect(() => { if (props.blocked) cancelMotion(); }, [props.blocked, cancelMotion]);
  useLayoutEffect(() => {
    translation.setValue(0);
    distance.current = 0;
    latest.current.moving = false;
    setMoving(false);
  }, [index, translation]);

  useEffect(() => {
    const video = props.videos[pager.index];
    if (video && video.id !== latest.current.props.settings.currentId) latest.current.props.onPosition(video.id);
  }, [pager, props.videos]);

  const animateTo = useCallback((target: number) => {
    const current = latest.current;
    if (!current.foreground || current.props.blocked || scrubbing.current) { cancelMotion(); return; }
    const token = pager.start(target, current.props.videos.length);
    if (token === null) return;
    current.moving = true;
    setMoving(true);
    const targetOffset = (pager.index - target) * current.props.height;
    const remaining = Math.abs(targetOffset - distance.current) / current.props.height;
    const transition = Animated.timing(translation, {
      toValue: targetOffset, duration: Math.max(90, Math.min(240, remaining * 220)),
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.current = transition;
    transition.start(({ finished }) => {
      if (!finished || !latest.current.foreground || latest.current.props.blocked) return;
      const previous = pager.index;
      const next = pager.finish(token);
      if (next === null) return;
      animation.current = null;
      if (next === previous) { cancelMotion(); return; }
      // Save the asset ID before rendering the next page, including before a system interruption.
      latest.current.props.onPosition(latest.current.props.videos[next].id);
      setIndex(next);
    });
  }, [cancelMotion, pager, translation]);

  const navigate = useCallback((direction: 1 | -1) => {
    const current = latest.current;
    if (current.moving || !current.foreground || current.props.blocked || scrubbing.current) return;
    const target = pager.index + direction;
    if (target >= 0 && target < current.props.videos.length) animateTo(target);
  }, [animateTo, pager]);

  const advance = useCallback((id: string) => {
    const current = latest.current;
    if (current.props.videos[pager.index]?.id === id && current.props.settings.autoAdvance) navigate(1);
  }, [navigate, pager]);

  const gestures = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => {
      const current = latest.current;
      return !current.moving && current.foreground && !current.props.blocked && !scrubbing.current
        && Math.abs(gesture.dy) > 12 && Math.abs(gesture.dy) > Math.abs(gesture.dx) * 1.4;
    },
    onPanResponderGrant: () => {
      latest.current.moving = true;
      setMoving(true);
      distance.current = 0;
    },
    onPanResponderMove: (_, gesture) => {
      const current = latest.current;
      if (!current.moving || !current.foreground || current.props.blocked) return;
      distance.current = dragOffset(pager.index, current.props.videos.length, current.props.height, gesture.dy);
      translation.setValue(distance.current);
    },
    onPanResponderRelease: (_, gesture) => {
      const current = latest.current;
      if (!current.moving) return;
      animateTo(swipeTarget(pager.index, current.props.videos.length, current.props.height, gesture.dy, gesture.vy));
    },
    onPanResponderTerminate: cancelMotion,
    onPanResponderTerminationRequest: () => true,
    onShouldBlockNativeResponder: () => true,
  }), [animateTo, cancelMotion, pager, translation]);

  return <View style={styles.viewport} {...gestures.panHandlers}>
    {/* Three ordinary views have no native scroll-to-top target for HyperOS's status-bar gesture. */}
    <Animated.View style={{ height: props.height * 3, transform: [{ translateY: transform }] }}>
      {[index - 1, index, index + 1].map((itemIndex) => {
        const item = props.videos[itemIndex];
        if (!item) return <View key={`edge-${itemIndex}`} style={{ height: props.height }} />;
        return <VideoPage key={item.id} video={item} height={props.height} selected={itemIndex === index}
          canPlay={foreground && !props.blocked && !moving} playbackRevision={playbackRevision}
          muted={props.settings.muted} repeat={props.settings.repeat} autoAdvance={props.settings.autoAdvance}
          bookmarked={props.settings.favoriteIds.includes(item.id)} sharing={props.sharing} hasNext={itemIndex + 1 < props.videos.length}
          onBookmark={() => props.onBookmark(item.id)} onMute={() => props.onSettings({ muted: !props.settings.muted })}
          onRepeat={() => props.onSettings({ repeat: !props.settings.repeat })} onAutoAdvance={() => props.onSettings({ autoAdvance: !props.settings.autoAdvance })}
          onShare={() => props.onShare(item)} onFinished={advance} onScrubbing={(active) => { scrubbing.current = active; }} onNavigate={navigate} />;
      })}
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({ viewport: { flex: 1, backgroundColor: '#000000', overflow: 'hidden' } });
