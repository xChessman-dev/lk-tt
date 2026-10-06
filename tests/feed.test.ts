import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_SETTINGS, filterVideos, formatTime, orderVideos, readSettings, restoredIndex, sameVideoCatalog, settledIndex, toggleFavorite, updateFeedSettings, videoAtNumber } from '../src/lib/feed.ts';
import { collectVideoPages } from '../src/lib/catalog.ts';

const library = Array.from({ length: 1753 }, (_, index) => ({
  id: `content://media/external/video/media/${index + 1}`,
  filename: `video-${index}.mp4`, createdAt: index * 1000,
}));

test('a large collection is shuffled without losing or repeating videos; order survives restart and insertion', () => {
  const shuffled = orderVideos([...library, library[4]], 'random', 8521);
  assert.equal(shuffled.length, 1753);
  assert.equal(new Set(shuffled.map((item) => item.id)).size, 1753);
  assert.deepEqual(shuffled, orderVideos([...library].reverse(), 'random', 8521));
  assert.notDeepEqual(shuffled, orderVideos(library, 'random', 8522));
  const inserted = { id: 'new-video', filename: 'new.mp4', createdAt: 9999999 };
  assert.deepEqual(orderVideos([...library, inserted], 'random', 8521).filter((item) => item.id !== inserted.id), shuffled);
  assert.equal(library[0].createdAt, 0, 'original library must not be mutated');
});

test('restoring by asset ID survives new files and deletion', () => {
  const ordered = orderVideos(library, 'newest', 1);
  assert.equal(ordered[0].id, library.at(-1)!.id);
  const id = library[42].id;
  assert.equal(ordered[restoredIndex(ordered, id)].id, id);
  assert.equal(restoredIndex(ordered.filter((item) => item.id !== id), id), 0);
  assert.equal(restoredIndex([], id), 0);
});

test('invalid saved settings and scroll boundary events recover safely', () => {
  assert.deepEqual(readSettings('{broken'), DEFAULT_SETTINGS);
  assert.deepEqual(readSettings('null'), DEFAULT_SETTINGS);
  assert.equal(readSettings('{"order":"random","seed":"oops","muted":"false"}').muted, false);
  assert.equal(settledIndex(-200, 800, 1753), 0);
  assert.equal(settledIndex(801, 800, 1753), 1);
  assert.equal(settledIndex(9999999, 800, 1753), 1752);
  assert.equal(settledIndex(500, 0, 0), 0);
  assert.equal(formatTime(3661.9), '1:01:01');
  assert.equal(formatTime(NaN), '0:00');
});

test('catalog scans every page, excludes photos/audio, and deduplicates overlapping results', async () => {
  const metadata = library.map((item) => ({ ...item, mediaType: 'video', creationTime: item.createdAt, modificationTime: null }));
  const rows = [...metadata.slice(0, 300), { ...metadata[0], id: 'photo', mediaType: 'image' }, ...metadata.slice(300), metadata[4], { ...metadata[0], id: 'audio', mediaType: 'audio' }];
  const offsets: number[] = [];
  const counts: number[] = [];
  const result = await collectVideoPages(async (offset, limit) => {
    offsets.push(offset);
    assert.equal(limit, 250);
    return rows.slice(offset, offset + limit);
  }, (count) => counts.push(count), () => false);
  assert.equal(result!.length, 1753);
  assert.deepEqual(offsets, [0, 250, 500, 750, 1000, 1250, 1500, 1750]);
  assert.equal(counts.at(-1), 1753);
  assert(!result!.some((item) => item.id === 'photo' || item.id === 'audio'));
});

test('a stale scan is discarded and a broken provider cannot loop indefinitely', async () => {
  let cancelled = false;
  const result = await collectVideoPages(async () => { cancelled = true; return []; }, () => assert.fail('stale progress'), () => cancelled);
  assert.equal(result, null);
  let calls = 0;
  const repeating = Array.from({ length: 250 }, (_, i) => ({ id: String(i), mediaType: 'video', filename: null, creationTime: null, modificationTime: 3 }));
  await assert.rejects(() => collectVideoPages(async () => { calls++; return repeating; }, () => {}, () => false), /did not advance/);
  assert.equal(calls, 2);
  await assert.rejects(() => collectVideoPages(async () => { throw new Error('permission revoked'); }, () => {}, () => false), /permission revoked/);
});

test('upgrading from 1.0 keeps the viewing position and enables repeat by default', () => {
  const saved = readSettings(JSON.stringify({ order: 'random', seed: 31, currentId: library[42].id, muted: true }));
  assert.equal(saved.currentId, library[42].id);
  assert.equal(saved.seed, 31);
  assert.equal(saved.muted, true);
  assert.equal(saved.repeat, true);
  assert.equal(saved.autoAdvance, false);
  assert.equal(saved.scope, 'all');
  assert.deepEqual(saved.favoriteIds, []);
});

test('repeat and auto-advance are exclusive while both may be off, including after restart', () => {
  let settings = updateFeedSettings(DEFAULT_SETTINGS, { autoAdvance: true });
  assert.equal(settings.repeat, false);
  assert.equal(settings.autoAdvance, true);
  settings = updateFeedSettings(settings, { repeat: true });
  assert.equal(settings.repeat, true);
  assert.equal(settings.autoAdvance, false);
  settings = updateFeedSettings(settings, { repeat: false });
  assert.equal(settings.repeat, false);
  assert.equal(settings.autoAdvance, false);
  assert.deepEqual(readSettings(JSON.stringify(settings)), settings);
  const conflicting = readSettings('{"repeat":true,"autoAdvance":true}');
  assert.equal(conflicting.autoAdvance, true);
  assert.equal(conflicting.repeat, false);
});

test('bookmarks persist, filter only available videos, and preserve the selected ordering', () => {
  let ids = toggleFavorite([], library[12].id);
  ids = toggleFavorite(ids, library[32].id);
  const saved = readSettings(JSON.stringify({ favoriteIds: [...ids, ids[0], null, 4, '', 'deleted-id'], scope: 'favorites' }));
  assert.deepEqual(saved.favoriteIds, [...ids, 'deleted-id']);
  const newest = orderVideos(library, 'newest', 1);
  assert.deepEqual(filterVideos(newest, saved.scope, saved.favoriteIds), [library[32], library[12]]);
  ids = toggleFavorite(ids, library[32].id);
  assert.deepEqual(filterVideos(newest, 'favorites', ids), [library[12]]);
  assert.deepEqual(filterVideos(newest, 'favorites', toggleFavorite(ids, library[12].id)), []);
  assert.equal(filterVideos(newest, 'all', ids), newest);
});

test('jumping by a one-based number follows the current shuffle and favorites without changing their order', () => {
  const shuffled = orderVideos(library, 'random', 913);
  const originalIds = shuffled.map((video) => video.id);
  assert.equal(videoAtNumber(shuffled, '1'), shuffled[0]);
  assert.equal(videoAtNumber(shuffled, '1500'), shuffled[1499]);
  assert.equal(videoAtNumber(shuffled, '1753'), shuffled.at(-1));
  assert.equal(videoAtNumber(shuffled, ' 002 '), shuffled[1]);
  const favorites = filterVideos(shuffled, 'favorites', [shuffled[27].id, shuffled[131].id]);
  assert.equal(videoAtNumber(favorites, '2'), shuffled[131]);
  assert.equal(videoAtNumber(favorites, '3'), null);
  const settings = updateFeedSettings({ ...DEFAULT_SETTINGS, order: 'random', seed: 913 }, { currentId: videoAtNumber(shuffled, '1500')!.id });
  assert.equal(restoredIndex(orderVideos(library, settings.order, settings.seed), settings.currentId), 1499);
  assert.deepEqual(shuffled.map((video) => video.id), originalIds);
});

test('invalid video numbers never silently jump to the first video or clamp to the last', () => {
  for (const value of ['', ' ', '0', '-1', '1754', '1.5', '1e3', '1,5', '+1', '10abc', '1\n2', '9007199254740992']) {
    assert.equal(videoAtNumber(library, value), null, value);
  }
  assert.equal(videoAtNumber([], '1'), null);
});

test('an unchanged permission rescan preserves the catalog even when provider row order changes', () => {
  assert.equal(sameVideoCatalog(library, [...library].reverse().map((video) => ({ ...video }))), true);
  assert.equal(sameVideoCatalog(library, library.slice(1)), false);
  assert.equal(sameVideoCatalog(library, library.map((video, i) => i === 0 ? { ...video, createdAt: 19 } : video)), false);
  assert.equal(sameVideoCatalog(library, library.map((video, i) => i === 0 ? { ...video, filename: 'renamed.mp4' } : video)), false);
});
