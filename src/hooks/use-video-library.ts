import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import { DEFAULT_SETTINGS, readSettings, sameVideoCatalog, toggleFavorite, updateFeedSettings, type FeedSettings, type VideoItem } from '@/lib/feed';
import { collectVideoPages } from '@/lib/catalog';

const STORAGE_KEY = 'svoi-video/settings/v1';
type Phase = 'loading' | 'permission' | 'ready' | 'error';

function hasAccess(permission: MediaLibrary.PermissionResponse) {
  return permission.granted || permission.accessPrivileges === 'limited';
}

export function useVideoLibrary() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [permission, setPermission] = useState<MediaLibrary.PermissionResponse | null>(null);
  const [settings, setSettings] = useState<FeedSettings>({ ...DEFAULT_SETTINGS });
  const [scanned, setScanned] = useState(0);
  const [revision, setRevision] = useState(0);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);
  const generation = useRef(0);
  const settingsReady = useRef(false);
  const permissionRef = useRef<MediaLibrary.PermissionResponse | null>(null);
  const requesting = useRef(false);
  const disposed = useRef(false);
  const writeQueue = useRef(Promise.resolve());
  const latestSettings = useRef(settings);
  const catalog = useRef<VideoItem[]>([]);
  latestSettings.current = settings;

  const remember = useCallback((next: FeedSettings) => {
    latestSettings.current = next;
    setSettings(next);
    // Serialize writes: a slow older write must never overwrite the latest position.
    const serialized = JSON.stringify(next);
    writeQueue.current = writeQueue.current
      .then(() => AsyncStorage.setItem(STORAGE_KEY, serialized))
      .catch(() => { if (!disposed.current) setStorageWarning(true); });
  }, []);

  const updateSettings = useCallback((patch: Partial<FeedSettings>) => {
    remember(updateFeedSettings(latestSettings.current, patch));
  }, [remember]);

  const markVideo = useCallback((id: string) => {
    remember({ ...latestSettings.current, favoriteIds: toggleFavorite(latestSettings.current.favoriteIds, id) });
  }, [remember]);

  const load = useCallback(async (access?: MediaLibrary.PermissionResponse, quietly = false) => {
    const ticket = ++generation.current;
    if (!quietly) setPhase('loading');
    setScanned(0);
    try {
      const nextPermission = access ?? await MediaLibrary.getPermissionsAsync(false, ['video']);
      if (disposed.current || ticket !== generation.current) return;
      setPermission(nextPermission);
      permissionRef.current = nextPermission;
      if (!hasAccess(nextPermission)) {
        catalog.current = [];
        setVideos([]);
        setPhase('permission');
        return;
      }
      // SDK 57 metadata queries avoid opening/decoding all 1500+ video files.
      const found = await collectVideoPages((offset, limit) => new MediaLibrary.Query()
          .eq(MediaLibrary.AssetField.MEDIA_TYPE, MediaLibrary.MediaType.VIDEO)
          .orderBy({ key: MediaLibrary.AssetField.CREATION_TIME, ascending: false })
          .limit(limit)
          .offset(offset)
          .exeForMetadata(), setScanned, () => disposed.current || ticket !== generation.current);
      if (!found) return;
      if (!sameVideoCatalog(catalog.current, found)) {
        catalog.current = found;
        setVideos(found);
        setRevision((value) => value + 1);
      }
      setChanged(false);
      setPhase('ready');
    } catch {
      if (!disposed.current && ticket === generation.current) {
        if (quietly) setChanged(true);
        else setPhase('error');
      }
    }
  }, []);

  const requestAccess = useCallback(async () => {
    if (requesting.current) return;
    requesting.current = true;
    setBusy(true);
    try {
      if (permissionRef.current && !permissionRef.current.canAskAgain) {
        await Linking.openSettings();
      } else {
        const access = await MediaLibrary.requestPermissionsAsync(false, ['video']);
        await load(access);
      }
    } catch {
      if (!disposed.current) setPhase('error');
    } finally {
      requesting.current = false;
      if (!disposed.current) setBusy(false);
    }
  }, [load]);

  useEffect(() => {
    disposed.current = false;
    void (async () => {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (disposed.current) return;
        const next = readSettings(saved);
        latestSettings.current = next;
        setSettings(next);
      } catch {
        if (!disposed.current) setStorageWarning(true);
      }
      if (disposed.current) return;
      settingsReady.current = true;
      await load();
    })();

    let previousState = AppState.currentState;
    const appSubscription = AppState.addEventListener('change', (state) => {
      const returnedFromBackground = previousState !== 'active' && state === 'active';
      previousState = state;
      if (!returnedFromBackground || !settingsReady.current || requesting.current) return;
      const ticket = generation.current;
      void (async () => {
        try {
          const access = await MediaLibrary.getPermissionsAsync(false, ['video']);
          if (disposed.current || ticket !== generation.current || AppState.currentState !== 'active') return;
          const previous = permissionRef.current;
          // Android may revoke access in Settings while the app is in the background.
          if (!previous || access.granted !== previous.granted
            || access.accessPrivileges !== previous.accessPrivileges) {
            await load(access);
          } else if (access.accessPrivileges === 'limited') {
            // Recheck the allowed subset without replacing the visible player when it is unchanged.
            await load(access, true);
          } else {
            permissionRef.current = access;
            setPermission(access);
            setChanged(true);
          }
        } catch {
          if (!disposed.current) setChanged(true);
        }
      })();
    });
    return () => {
      disposed.current = true;
      generation.current++;
      appSubscription.remove();
    };
  }, [load]);

  useEffect(() => {
    if (!permission || !hasAccess(permission)) return;
    const subscription = MediaLibrary.addListener(() => setChanged(true));
    return () => subscription.remove();
  }, [permission]);

  return {
    phase, videos, permission, settings, scanned, revision, changed, busy, storageWarning,
    updateSettings, markVideo, requestAccess, reload: load,
  };
}
