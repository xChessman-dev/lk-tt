import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { AppState } from 'react-native';
import type { VideoItem } from '@/lib/feed';

const MAX_AGE = 24 * 60 * 60 * 1000;
let sharing = false;
export class ShareError extends Error {}

export function cleanOldShares() {
  try {
    const root = new Directory(Paths.cache, 'svoi-shares');
    if (!root.exists) return;
    for (const item of root.list()) {
      const timestamp = /^share-(\d+)-/.exec(item.name)?.[1];
      if (item instanceof Directory && timestamp && Date.now() - Number(timestamp) > MAX_AGE) item.delete();
    }
  } catch { /* Android can reclaim cache files at any time. */ }
}

export async function shareVideo(video: VideoItem) {
  if (sharing) return;
  sharing = true;
  let temporary: Directory | null = null;
  let offeredToAnotherApp = false;
  try {
    if (!await Sharing.isAvailableAsync()) throw new ShareError('На телефоне недоступно меню отправки файлов.');
    cleanOldShares();
    const source = new File(video.id);
    const size = source.size;
    if (size > 0 && Paths.availableDiskSpace < size + 20 * 1024 * 1024) {
      throw new ShareError('Для подготовки видео не хватает свободного места на телефоне.');
    }
    temporary = new Directory(Paths.cache, 'svoi-shares', `share-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    temporary.create({ intermediates: true });
    const safeName = video.filename.replace(/[/\\:*?"<>|\x00-\x1f]/g, '_').replace(/^\.+/, '').slice(-160) || 'video.mp4';
    const destination = new File(temporary, safeName);
    // Only the requested file is streamed to cache; no file contents enter JS memory.
    await source.copy(destination);
    if (AppState.currentState !== 'active') throw new ShareError('Вернись в приложение и нажми «Поделиться» ещё раз.');
    const extension = safeName.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = { mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', mkv: 'video/x-matroska', avi: 'video/x-msvideo', '3gp': 'video/3gpp', ts: 'video/mp2t' };
    offeredToAnotherApp = true;
    await Sharing.shareAsync(destination.uri, { mimeType: mimeTypes[extension ?? ''] ?? 'video/*', dialogTitle: 'Поделиться видео' });
    // Keep the file for 24 hours: Android resolves the chooser before the recipient
    // necessarily finishes reading it. Removing it here would break Telegram/VK.
  } catch (error) {
    if (temporary && !offeredToAnotherApp) {
      try { temporary.delete(); } catch { /* Best effort for an incomplete cache copy. */ }
    }
    throw error;
  } finally {
    sharing = false;
  }
}
