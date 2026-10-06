export type VideoItem = {
  id: string;
  filename: string;
  createdAt: number;
};

export type FeedSettings = {
  order: 'newest' | 'random';
  seed: number;
  currentId: string | null;
  muted: boolean;
  repeat: boolean;
  autoAdvance: boolean;
  scope: 'all' | 'favorites';
  favoriteIds: string[];
};

export const DEFAULT_SETTINGS: FeedSettings = {
  order: 'newest', seed: 72413, currentId: null, muted: false,
  repeat: true, autoAdvance: false, scope: 'all', favoriteIds: [],
};

export function readSettings(raw: string | null): FeedSettings {
  try {
    const value = JSON.parse(raw ?? '{}');
    return {
      order: value?.order === 'random' ? 'random' : 'newest',
      seed: Number.isSafeInteger(value?.seed) ? value.seed : DEFAULT_SETTINGS.seed,
      currentId: typeof value?.currentId === 'string' ? value.currentId : null,
      muted: value?.muted === true,
      repeat: value?.autoAdvance === true ? false : value?.repeat !== false,
      autoAdvance: value?.autoAdvance === true,
      scope: value?.scope === 'favorites' ? 'favorites' : 'all',
      favoriteIds: Array.isArray(value?.favoriteIds)
        ? [...new Set<string>(value.favoriteIds.filter((id: unknown) => typeof id === 'string' && id.length > 0))]
        : [],
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function updateFeedSettings(current: FeedSettings, patch: Partial<FeedSettings>): FeedSettings {
  const next = { ...current, ...patch };
  if (patch.autoAdvance === true) next.repeat = false;
  else if (patch.repeat === true) next.autoAdvance = false;
  return next;
}

export function filterVideos(videos: VideoItem[], scope: FeedSettings['scope'], favoriteIds: string[]) {
  if (scope === 'all') return videos;
  const favorites = new Set(favoriteIds);
  return videos.filter((video) => favorites.has(video.id));
}

export function toggleFavorite(favoriteIds: string[], id: string) {
  return favoriteIds.includes(id) ? favoriteIds.filter((saved) => saved !== id) : [...favoriteIds, id];
}

export function sameVideoCatalog(first: VideoItem[], second: VideoItem[]) {
  if (first.length !== second.length) return false;
  const existing = new Map(first.map((video) => [video.id, video]));
  return second.every((video) => {
    const previous = existing.get(video.id);
    return previous?.filename === video.filename && previous.createdAt === video.createdAt;
  });
}

function rank(id: string, seed: number): number {
  let hash = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < id.length; i++) {
    hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  return (hash ^ (hash >>> 16)) >>> 0;
}

export function orderVideos(videos: VideoItem[], order: FeedSettings['order'], seed: number) {
  const unique = [...new Map(videos.map((video) => [video.id, video])).values()];
  const ranks = new Map(unique.map((video) => [video.id, rank(video.id, seed)]));
  return unique.sort((a, b) => {
    const difference = order === 'random'
      ? ranks.get(a.id)! - ranks.get(b.id)!
      : b.createdAt - a.createdAt;
    return difference || a.id.localeCompare(b.id);
  });
}

export function restoredIndex(videos: VideoItem[], currentId: string | null) {
  return Math.max(0, videos.findIndex((video) => video.id === currentId));
}

export function videoAtNumber(videos: VideoItem[], input: string): VideoItem | null {
  const value = input.trim();
  if (!/^\d+$/.test(value)) return null;
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number < 1 || number > videos.length) return null;
  return videos[number - 1];
}

export function settledIndex(offset: number, height: number, count: number) {
  if (height <= 0 || count <= 0 || !Number.isFinite(offset)) return 0;
  return Math.max(0, Math.min(count - 1, Math.round(offset / height)));
}

export function formatTime(seconds: number): string {
  const total = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total / 60) % 60;
  const remaining = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${remaining}`
    : `${minutes}:${remaining}`;
}
