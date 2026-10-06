import type { VideoItem } from './feed';

type Metadata = {
  id: string;
  mediaType: string;
  filename: string | null;
  creationTime: number | null;
  modificationTime: number | null;
};

export async function collectVideoPages(
  fetchPage: (offset: number, limit: number) => Promise<Metadata[]>,
  onProgress: (count: number) => void,
  isCancelled: () => boolean,
  pageSize = 250,
): Promise<VideoItem[] | null> {
  const found = new Map<string, VideoItem>();
  let offset = 0;
  while (!isCancelled()) {
    const page = await fetchPage(offset, pageSize);
    if (isCancelled()) return null;
    const previousSize = found.size;
    for (const asset of page) {
      if (asset.mediaType !== 'video') continue;
      found.set(asset.id, {
        id: asset.id,
        filename: asset.filename || 'Видео без названия',
        createdAt: asset.creationTime || asset.modificationTime || 0,
      });
    }
    onProgress(found.size);
    if (page.length < pageSize) return [...found.values()];
    // Some device media providers ignore offsets; fail instead of loading forever.
    if (offset > 0 && previousSize === found.size) throw new Error('Media provider did not advance');
    offset += page.length;
  }
  return null;
}
