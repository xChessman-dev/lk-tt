import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FeedHeader } from '@/components/feed-header';
import { FeedIcon } from '@/components/feed-icon';
import { FeedMenu } from '@/components/feed-menu';
import { JumpToVideo } from '@/components/jump-to-video';
import { LibraryState } from '@/components/library-state';
import { VideoFeed } from '@/components/video-feed';
import { useVideoLibrary } from '@/hooks/use-video-library';
import { filterVideos, orderVideos, restoredIndex, type FeedSettings, type VideoItem } from '@/lib/feed';
import { cleanOldShares, ShareError, shareVideo } from '@/lib/share-video';

function AndroidGallery() {
  const library = useVideoLibrary();
  const insets = useSafeAreaInsets();
  const [height, setHeight] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [feedRevision, setFeedRevision] = useState(0);
  const shareBusy = useRef(false);
  const mounted = useRef(true);
  const ordered = useMemo(() => orderVideos(library.videos, library.settings.order, library.settings.seed),
    [library.videos, library.settings.order, library.settings.seed]);
  const visible = useMemo(() => filterVideos(ordered, library.settings.scope, library.settings.favoriteIds),
    [ordered, library.settings.scope, library.settings.favoriteIds]);
  const favoriteCount = useMemo(() => filterVideos(ordered, 'favorites', library.settings.favoriteIds).length,
    [ordered, library.settings.favoriteIds]);
  const currentIndex = restoredIndex(visible, library.settings.currentId);

  useEffect(() => { if (library.phase !== 'ready') setJumpOpen(false); }, [library.phase]);

  useEffect(() => {
    mounted.current = true;
    cleanOldShares();
    return () => { mounted.current = false; };
  }, []);

  const changeSettings = (patch: Partial<FeedSettings>) => {
    const orderChanged = patch.order !== undefined && patch.order !== library.settings.order;
    library.updateSettings(orderChanged ? { ...patch, currentId: null } : patch);
    setMenuOpen(false);
    if (orderChanged || patch.scope !== undefined || patch.seed !== undefined || patch.currentId !== undefined) setFeedRevision((value) => value + 1);
  };
  const jumpToVideo = (video: VideoItem) => {
    library.updateSettings({ currentId: video.id });
    setFeedRevision((value) => value + 1);
    setJumpOpen(false);
  };
  const bookmark = (id: string) => {
    if (library.settings.scope === 'favorites') {
      const index = visible.findIndex((video) => video.id === id);
      const successor = visible[index + 1] ?? visible[index - 1];
      library.updateSettings({ currentId: successor?.id ?? null });
      setFeedRevision((value) => value + 1);
    }
    library.markVideo(id);
  };
  const share = async (video: VideoItem) => {
    if (shareBusy.current || AppState.currentState !== 'active') return;
    shareBusy.current = true;
    setSharing(true);
    try { await shareVideo(video); }
    catch (error) {
      if (mounted.current) Alert.alert('Не удалось поделиться', error instanceof ShareError ? error.message : 'Не удалось подготовить файл. Проверь, что видео доступно в галерее и на телефоне достаточно свободного места.');
    } finally {
      shareBusy.current = false;
      if (mounted.current) setSharing(false);
    }
  };
  const reload = () => { setMenuOpen(false); void library.reload(); };
  const openSettings = () => { void Linking.openSettings().catch(() => library.requestAccess()); };

  if (library.phase === 'loading') return <LibraryState title="Собираем твою ленту" description={library.scanned ? `Найдено видео: ${library.scanned.toLocaleString('ru-RU')}` : 'Читаем список видео на телефоне…'} loading />;
  if (library.phase === 'permission') return <LibraryState
    title={'Все твои видео.\nОдно движение.'}
    description={'Открой доступ к видео, чтобы листать галерею вверх и вниз. Файлы останутся на телефоне.\n\nВ запросе Android выбери доступ ко всем видео.'}
    action={library.permission?.canAskAgain === false ? 'Открыть настройки' : 'Открыть мою галерею'}
    onAction={() => void library.requestAccess()} disabled={library.busy} />;
  if (library.phase === 'error') return <LibraryState title="Галерея недоступна" description="Не удалось прочитать список видео. Проверь разрешение на доступ к видео и попробуй ещё раз." action="Попробовать снова" onAction={reload} secondary="Настройки доступа" onSecondary={openSettings} />;
  if (ordered.length === 0) return <LibraryState title="Здесь будут твои видео" description={library.permission?.accessPrivileges === 'limited' ? 'Среди разрешённых файлов нет видео. Открой настройки и разреши доступ ко всем видео.' : 'Пока на телефоне не найдено доступных видео. Сохрани или сними ролик, затем обнови ленту.'} action="Обновить видео" onAction={reload} secondary="Настройки доступа" onSecondary={openSettings} />;

  return <View style={[styles.screen, { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }]}>
    <FeedHeader index={currentIndex} count={visible.length}
      favorites={library.settings.scope === 'favorites'} limited={library.permission?.accessPrivileges === 'limited'}
      changed={library.changed} disabled={sharing} onJump={() => setJumpOpen(true)} onFilter={() => setMenuOpen(true)} onRefresh={reload} />
    <View style={styles.viewport} onLayout={(event) => {
      const measured = Math.round(event.nativeEvent.layout.height);
      if (!jumpOpen && measured > 0) setHeight(measured);
    }}>
      {visible.length === 0 ? <View style={styles.empty}>
        <FeedIcon name="bookmark" size={42} color="#B9CCFF" />
        <Text style={styles.emptyTitle}>Пока нет отмеченных</Text>
        <Text style={styles.emptyText}>Нажми закладку справа от видео, чтобы сохранить его в этой подборке.</Text>
        <Pressable accessibilityRole="button" onPress={() => changeSettings({ scope: 'all' })} style={styles.emptyButton}><Text style={styles.emptyButtonText}>Все видео</Text></Pressable>
      </View> : height > 0 && <VideoFeed key={`${library.revision}:${feedRevision}`} videos={visible} height={height}
        settings={library.settings} blocked={menuOpen || jumpOpen || sharing} sharing={sharing}
        onPosition={(id) => library.updateSettings({ currentId: id })} onBookmark={bookmark}
        onSettings={library.updateSettings} onShare={(video) => void share(video)} />}
      {sharing && <View pointerEvents="none" style={styles.shareNotice}><Text style={styles.shareNoticeText}>Подготовка видео к отправке…</Text></View>}
    </View>
    <FeedMenu visible={menuOpen} onClose={() => setMenuOpen(false)} settings={library.settings}
      onChange={changeSettings} count={ordered.length} favoriteCount={favoriteCount}
      limited={library.permission?.accessPrivileges === 'limited'} storageWarning={library.storageWarning} />
    {jumpOpen && <JumpToVideo videos={visible} index={currentIndex} onClose={() => setJumpOpen(false)} onJump={jumpToVideo} />}
  </View>;
}

export default function HomeScreen() {
  if (Platform.OS !== 'android') return <LibraryState title="Твоя видеолента на Android" description="Установи APK на телефон, чтобы смотреть видео из его галереи. Доступ к галерее Android работает в приложении." />;
  return <AndroidGallery />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000000' },
  viewport: { flex: 1, overflow: 'hidden', backgroundColor: '#000000' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  emptyTitle: { color: '#FFFFFF', fontSize: 23, fontWeight: '600', textAlign: 'center', marginTop: 24 },
  emptyText: { color: '#BCC5D7', fontSize: 15, lineHeight: 23, textAlign: 'center', marginTop: 12, maxWidth: 320 },
  emptyButton: { minHeight: 50, paddingHorizontal: 28, justifyContent: 'center', borderRadius: 16, backgroundColor: '#B9CCFF', marginTop: 28 },
  emptyButtonText: { color: '#17233D', fontSize: 15, fontWeight: '600' },
  shareNotice: { position: 'absolute', top: 16, alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: '#101520' },
  shareNoticeText: { color: '#D4D9E5', fontSize: 13 },
});
