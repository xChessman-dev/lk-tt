import Slider from '@react-native-community/slider';
import { useEvent, useEventListener } from 'expo';
import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import { memo, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { FeedIcon } from '@/components/feed-icon';
import { VideoActions } from '@/components/video-actions';
import { formatTime, type VideoItem } from '@/lib/feed';
import { actionAtEnd, playbackAllowed, seekPosition, showPlaybackButton } from '@/lib/playback';

const players = new Set<VideoPlayer>();

type Props = {
  video: VideoItem; height: number; selected: boolean; canPlay: boolean; playbackRevision: number;
  muted: boolean; repeat: boolean; autoAdvance: boolean; bookmarked: boolean;
  sharing: boolean; hasNext: boolean;
  onBookmark: () => void; onMute: () => void; onRepeat: () => void; onAutoAdvance: () => void;
  onShare: () => void; onFinished: (id: string) => void; onScrubbing: (active: boolean) => void;
  onNavigate: (direction: 1 | -1) => void;
};

export const VideoPage = memo(function VideoPage(props: Props) {
  const { video, selected, canPlay, muted, repeat, autoAdvance } = props;
  const [paused, setPaused] = useState(false);
  const [ended, setEnded] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [draftTime, setDraftTime] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [retrying, setRetrying] = useState(false);
  const [retryFailed, setRetryFailed] = useState(false);
  const [slow, setSlow] = useState(false);
  const wasSelected = useRef(selected);
  const windowFocused = useRef(true);
  const endDelivered = useRef(false);
  const scrubActive = useRef(false);
  const resumeAfterScrub = useRef(false);
  const sliderStartValue = useRef(0);
  const seekPending = useRef<{ time: number; until: number } | null>(null);
  const scrubCallback = useRef(props.onScrubbing);
  scrubCallback.current = props.onScrubbing;
  const player = useVideoPlayer(video.id, (instance) => {
    instance.loop = repeat && !autoAdvance;
    instance.muted = true;
    instance.staysActiveInBackground = false;
    instance.keepScreenOnWhilePlaying = true;
    instance.audioMixingMode = 'doNotMix';
    instance.bufferOptions = { preferredForwardBufferDuration: 4, minBufferForPlayback: 0.3, maxBufferBytes: 12 * 1024 * 1024, prioritizeTimeOverSizeThreshold: false };
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });
  const failed = status === 'error' || retryFailed;
  // Android reports an ended player as idle; its last frame and seek controls remain usable.
  const ready = status === 'readyToPlay' || ended;
  const duration = player.duration || 0;
  const intent = useRef({ selected, canPlay, paused, ended, scrubbing, failed });
  intent.current = { selected, canPlay, paused, ended, scrubbing, failed };

  useEventListener(player, 'timeUpdate', (event) => {
    if (scrubActive.current) return;
    const pending = seekPending.current;
    if (pending && Date.now() < pending.until && Math.abs(event.currentTime - pending.time) > 1) return;
    seekPending.current = null;
    setCurrentTime(event.currentTime);
  });

  useEventListener(player, 'playToEnd', () => {
    if (!intent.current.selected || scrubActive.current || endDelivered.current) return;
    const action = actionAtEnd({ repeat, autoAdvance }, props.hasNext);
    if (action === 'repeat') return; // The native loop retains gapless repeat behavior.
    const allowed = playbackAllowed({ ...intent.current, foreground: AppState.currentState === 'active' && windowFocused.current });
    endDelivered.current = true;
    intent.current.ended = true;
    intent.current.paused = true;
    player.pause();
    setCurrentTime(player.duration);
    setEnded(true);
    setPaused(true);
    if (action === 'advance' && allowed) props.onFinished(video.id);
  });

  useEffect(() => {
    players.add(player);
    const interrupt = () => {
      player.pause();
      if (scrubActive.current) {
        scrubActive.current = false;
        intent.current.scrubbing = false;
        intent.current.paused = !resumeAfterScrub.current;
        setScrubbing(false);
        setPaused(!resumeAfterScrub.current);
        scrubCallback.current(false);
      }
    };
    const subscription = AppState.addEventListener('change', (state) => { if (state !== 'active') interrupt(); });
    const blur = AppState.addEventListener('blur', () => { windowFocused.current = false; interrupt(); });
    const focus = AppState.addEventListener('focus', () => { windowFocused.current = true; });
    return () => {
      players.delete(player);
      subscription.remove();
      blur.remove(); focus.remove();
      if (scrubActive.current) scrubCallback.current(false);
    };
  }, [player]);

  useEffect(() => { player.loop = repeat && !autoAdvance; }, [player, repeat, autoAdvance]);

  useEffect(() => {
    // A modal or app switch can cancel the native slider gesture without a completion event.
    if ((canPlay && selected) || !scrubActive.current) return;
    scrubActive.current = false;
    intent.current.scrubbing = false;
    intent.current.paused = !resumeAfterScrub.current;
    setScrubbing(false);
    setPaused(!resumeAfterScrub.current);
    scrubCallback.current(false);
  }, [canPlay, selected]);

  useEffect(() => {
    player.timeUpdateEventInterval = selected ? 0.25 : 0;
    if (!selected && wasSelected.current) {
      player.pause();
      player.currentTime = 0;
      endDelivered.current = false;
      seekPending.current = null;
      setPaused(false);
      setEnded(false);
      setCurrentTime(0);
    }
    wasSelected.current = selected;
  }, [player, selected]);

  useEffect(() => {
    if (playbackAllowed({ selected, canPlay, paused, ended, scrubbing, failed, foreground: AppState.currentState === 'active' && windowFocused.current })) {
      for (const other of players) {
        if (other !== player) { other.muted = true; other.pause(); }
      }
      player.muted = muted;
      player.play();
    } else {
      player.pause();
      player.muted = true;
    }
  }, [player, selected, canPlay, paused, ended, scrubbing, muted, failed, props.playbackRevision]);

  useEffect(() => {
    setSlow(false);
    if (!selected || ready || failed) return;
    const timer = setTimeout(() => setSlow(true), 10000);
    return () => clearTimeout(timer);
  }, [selected, ready, failed]);

  const seek = (requested: number) => {
    const target = seekPosition(requested, duration);
    player.currentTime = target;
    seekPending.current = { time: target, until: Date.now() + 1000 };
    setCurrentTime(target);
    endDelivered.current = false;
    intent.current.ended = false;
    setEnded(false);
  };

  const togglePlay = () => {
    if (failed || props.sharing || !selected || !canPlay || scrubbing) return;
    if (!paused && !ended) {
      intent.current.paused = true;
      player.pause();
      setPaused(true);
    } else {
      if (ended || (duration > 0 && player.currentTime >= duration - 0.05)) seek(0);
      intent.current.paused = false;
      setPaused(false);
      if (playbackAllowed({ ...intent.current, foreground: AppState.currentState === 'active' && windowFocused.current })) {
        player.muted = muted;
        player.play();
      }
    }
  };

  const retry = async () => {
    if (retrying) return;
    setRetrying(true);
    setRetryFailed(false);
    try {
      await player.replaceAsync(video.id);
      endDelivered.current = false;
      setCurrentTime(0);
      setEnded(false);
      setPaused(false);
    } catch { setRetryFailed(true); }
    finally { setRetrying(false); }
  };

  const displayedTime = Math.min(duration, Math.max(0, scrubbing ? draftTime : currentTime));
  return <View style={[styles.page, { height: props.height }]}>
    <View style={styles.videoArea}>
      <VideoView player={player} style={StyleSheet.absoluteFill} nativeControls={false} contentFit="contain" surfaceType="textureView" accessible={false} pointerEvents="none" />
      {selected && <>
        <Pressable style={styles.touchArea} accessibilityRole="button" accessibilityLabel={!paused && !ended ? 'Поставить видео на паузу' : ended ? 'Воспроизвести с начала' : 'Продолжить видео'} accessibilityHint="Проведите вверх или вниз, чтобы сменить видео" onPress={togglePlay}
          accessibilityActions={[{ name: 'increment', label: 'Следующее видео' }, { name: 'decrement', label: 'Предыдущее видео' }]}
          onAccessibilityAction={(event) => props.onNavigate(event.nativeEvent.actionName === 'increment' ? 1 : -1)}>
          {showPlaybackButton({ selected, canPlay, ready, failed, scrubbing, paused, ended }) && <View style={styles.playButton} pointerEvents="none"><FeedIcon name="play" size={38} /></View>}
        </Pressable>
        {!failed && !ready && <View style={styles.center} pointerEvents="none"><ActivityIndicator size="large" color="#FFFFFF" />{slow && <Text style={styles.loadingText}>Видео долго открывается.{ '\n' }Можно перелистнуть дальше.</Text>}</View>}
        {failed && <View style={styles.center} pointerEvents="box-none"><View style={styles.error}>
          <FeedIcon name="video" size={34} color="#FFB4AB" /><Text style={styles.errorTitle}>Не удалось открыть видео</Text>
          <Text style={styles.errorText}>Файл недоступен или его формат не поддерживается телефоном.</Text>
          <Pressable accessibilityRole="button" disabled={retrying} style={styles.retry} onPress={() => void retry()}><Text style={styles.retryText}>{retrying ? 'Открываем…' : 'Попробовать снова'}</Text></Pressable>
        </View></View>}
        <VideoActions bookmarked={props.bookmarked} muted={muted} repeat={repeat} autoAdvance={autoAdvance} sharing={props.sharing}
          onBookmark={props.onBookmark} onMute={props.onMute} onRepeat={props.onRepeat} onAutoAdvance={props.onAutoAdvance}
          onShare={() => { intent.current.canPlay = false; player.pause(); props.onShare(); }} />
      </>}
    </View>
    <View style={styles.footer}>
      {selected && <>
        <Text style={styles.time}>{formatTime(displayedTime)}</Text>
        <Slider style={styles.slider} minimumValue={0} maximumValue={Math.max(duration, 0.001)}
          value={scrubbing ? sliderStartValue.current : displayedTime}
          minimumTrackTintColor="#B9CCFF" maximumTrackTintColor="#3F4552" thumbTintColor="#B9CCFF" thumbSize={14}
          disabled={duration <= 0 || failed || props.sharing || !ready}
          accessibilityLabel="Перемотка видео"
          accessibilityValue={{ min: 0, max: Math.max(1, Math.floor(duration)), now: Math.floor(displayedTime), text: `${formatTime(displayedTime)} из ${formatTime(duration)}` }}
          onSlidingStart={(value) => {
            resumeAfterScrub.current = player.playing && !paused && !ended;
            scrubActive.current = true;
            intent.current.scrubbing = true;
            sliderStartValue.current = value;
            setDraftTime(value);
            setScrubbing(true);
            player.pause();
            props.onScrubbing(true);
          }}
          onValueChange={(value) => { if (scrubActive.current) setDraftTime(value); }}
          onSlidingComplete={(value) => {
            if (!scrubActive.current) return;
            seek(value);
            intent.current.paused = !resumeAfterScrub.current;
            intent.current.scrubbing = false;
            scrubActive.current = false;
            setPaused(!resumeAfterScrub.current);
            setScrubbing(false);
            props.onScrubbing(false);
          }}
          accessibilityActions={[{ name: 'increment', label: 'Вперёд на 10 секунд' }, { name: 'decrement', label: 'Назад на 10 секунд' }]}
          onAccessibilityAction={(event) => seek(player.currentTime + (event.nativeEvent.actionName === 'increment' ? 10 : -10))} />
        <Text style={styles.time}>{formatTime(duration)}</Text>
      </>}
    </View>
  </View>;
});

const styles = StyleSheet.create({
  page: { backgroundColor: '#000000', overflow: 'hidden' },
  videoArea: { flex: 1, overflow: 'hidden' },
  touchArea: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(0,0,0,0.38)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  center: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center', paddingLeft: 24, paddingRight: 74 },
  loadingText: { color: '#BCC5D7', fontSize: 14, textAlign: 'center', lineHeight: 22, marginTop: 18 },
  error: { alignItems: 'center', maxWidth: 320, padding: 20, borderRadius: 22, backgroundColor: '#10131C' },
  errorTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '600', textAlign: 'center', marginTop: 16 },
  errorText: { color: '#BCC5D7', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 10 },
  retry: { paddingVertical: 14, paddingHorizontal: 18, backgroundColor: '#17233D', borderRadius: 14, marginTop: 20, minHeight: 48 },
  retryText: { color: '#B9CCFF', fontSize: 14, fontWeight: '600' },
  footer: { height: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, backgroundColor: '#000000' },
  time: { color: '#D4D9E5', fontSize: 12, fontVariant: ['tabular-nums'], minWidth: 33, textAlign: 'center' },
  slider: { flex: 1, height: 48, marginHorizontal: 6 },
});
