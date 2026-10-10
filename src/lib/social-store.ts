import { useCallback, useSyncExternalStore } from 'react';

import { setTripLike, setTripSave } from '@/lib/social-api';
import { SocialError, toggleErrorMessage } from '@/lib/social-errors';
import { showToast } from '@/lib/toast';
import { emitTripEvent } from '@/lib/trip-events';

/**
 * One client store keyed by trip id. Feed cards, repost cards, the detail screen and the
 * saved grid all read from it, so a toggle anywhere updates everywhere.
 *
 * Like and save are optimistic: the UI value is the DESIRED value, counts derive from the last
 * server-confirmed count, at most one request per (trip, kind) is in flight, and after it
 * settles the store sends once more if the desired value changed meanwhile.
 */

export type TripSocial = {
  likeCount: number;
  commentCount: number;
  repostCount: number;
  liked: boolean;
  saved: boolean;
  reposted: boolean;
  /** The viewer's own repost id once known; null until resolved. */
  repostId: string | null;
};

export type TripSocialSeed = Partial<TripSocial>;

type EntryBase = {
  confirmed: TripSocial;
  desiredLiked: boolean;
  desiredSaved: boolean;
};

type Entry = EntryBase & { snapshot: TripSocial };

const EMPTY: TripSocial = {
  likeCount: 0,
  commentCount: 0,
  repostCount: 0,
  liked: false,
  saved: false,
  reposted: false,
  repostId: null,
};

const entries = new Map<string, Entry>();
const inflight = new Set<string>();
const listeners = new Set<() => void>();
let saveVersion = 0;
let savedToastShown = false;

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function derive({ confirmed, desiredLiked, desiredSaved }: EntryBase): TripSocial {
  // Never add +1 per tap: the count is the confirmed one adjusted by the single desired delta.
  const likeCount = Math.max(
    0,
    confirmed.likeCount + (desiredLiked ? 1 : 0) - (confirmed.liked ? 1 : 0),
  );
  return { ...confirmed, likeCount, liked: desiredLiked, saved: desiredSaved };
}

function sameSocial(a: TripSocial, b: TripSocial): boolean {
  return (
    a.likeCount === b.likeCount &&
    a.commentCount === b.commentCount &&
    a.repostCount === b.repostCount &&
    a.liked === b.liked &&
    a.saved === b.saved &&
    a.reposted === b.reposted &&
    a.repostId === b.repostId
  );
}

/** Writes an entry; keeps the old snapshot object when nothing visible changed. */
function put(tripId: string, base: EntryBase): boolean {
  const next = derive(base);
  const previous = entries.get(tripId);
  const snapshot = previous && sameSocial(previous.snapshot, next) ? previous.snapshot : next;
  entries.set(tripId, { ...base, snapshot });
  return snapshot !== previous?.snapshot;
}

function applySeed(tripId: string, seed: TripSocialSeed): boolean {
  const previous = entries.get(tripId);
  const confirmed: TripSocial = { ...(previous?.confirmed ?? EMPTY), ...seed };
  // An optimistic value that is still in flight wins until it settles.
  const desiredLiked =
    inflight.has(`${tripId}:like`) && previous ? previous.desiredLiked : confirmed.liked;
  const desiredSaved =
    inflight.has(`${tripId}:save`) && previous ? previous.desiredSaved : confirmed.saved;
  return put(tripId, { confirmed, desiredLiked, desiredSaved });
}

/** Seeds counts and flags from a list or detail response. Call from promise callbacks only. */
export function seedTripSocial(seeds: { tripId: string; seed: TripSocialSeed }[]): void {
  let changed = false;
  for (const { tripId, seed } of seeds) {
    if (applySeed(tripId, seed)) changed = true;
  }
  if (changed) emit();
}

/** Applies a server-confirmed change (repost created or removed, comment count). */
export function updateTripSocial(tripId: string, seed: TripSocialSeed): void {
  if (applySeed(tripId, seed)) emit();
}

export function getTripSocial(tripId: string): TripSocial {
  return entries.get(tripId)?.snapshot ?? EMPTY;
}

/** Clears everything (sign-out or account switch). */
export function resetSocialStore(): void {
  entries.clear();
  inflight.clear();
  savedToastShown = false;
  saveVersion++;
  emit();
}

/** Increments whenever the viewer saves or unsaves a trip (the Saved tab refetches on it). */
export function getSaveVersion(): number {
  return saveVersion;
}

export function useSaveVersion(): number {
  return useSyncExternalStore(subscribe, getSaveVersion, getSaveVersion);
}

type Kind = 'like' | 'save';

const MAX_ROUNDS = 6;

async function pump(tripId: string, kind: Kind): Promise<void> {
  const key = `${tripId}:${kind}`;
  if (inflight.has(key)) return;
  inflight.add(key);
  try {
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const entry = entries.get(tripId);
      if (!entry) return;
      const want = kind === 'like' ? entry.desiredLiked : entry.desiredSaved;
      const have = kind === 'like' ? entry.confirmed.liked : entry.confirmed.saved;
      if (want === have) return;
      try {
        let patch: TripSocialSeed;
        if (kind === 'like') {
          const result = await setTripLike(tripId, want);
          patch = { liked: result.liked, likeCount: result.likeCount };
        } else {
          const result = await setTripSave(tripId, want);
          patch = { saved: result.saved };
          saveVersion++;
        }
        const latest = entries.get(tripId);
        if (!latest) return;
        // Reconcile to the canonical server answer; desired stays as the user last set it.
        if (put(tripId, { ...latest, confirmed: { ...latest.confirmed, ...patch } })) emit();
        else if (kind === 'save') emit();
      } catch (error) {
        const latest = entries.get(tripId);
        if (latest) {
          // Revert to the last confirmed value.
          put(tripId, {
            confirmed: latest.confirmed,
            desiredLiked: kind === 'like' ? latest.confirmed.liked : latest.desiredLiked,
            desiredSaved: kind === 'save' ? latest.confirmed.saved : latest.desiredSaved,
          });
          emit();
        }
        const errorKind = error instanceof SocialError ? error.kind : 'other';
        showToast(toggleErrorMessage(errorKind), 5000);
        if (errorKind === 'trip_unavailable') {
          emitTripEvent({ type: 'visibility', id: tripId, visibility: 'private' });
        }
        return;
      }
    }
  } finally {
    inflight.delete(key);
  }
}

function toggle(tripId: string, kind: Kind): void {
  const base: EntryBase = entries.get(tripId) ?? {
    confirmed: EMPTY,
    desiredLiked: false,
    desiredSaved: false,
  };
  const next: EntryBase =
    kind === 'like'
      ? { ...base, desiredLiked: !base.desiredLiked }
      : { ...base, desiredSaved: !base.desiredSaved };
  put(tripId, next);
  emit();
  if (kind === 'save' && next.desiredSaved && !savedToastShown) {
    savedToastShown = true;
    showToast('Saved to your private list');
  }
  void pump(tripId, kind);
}

export function toggleTripLike(tripId: string): void {
  toggle(tripId, 'like');
}

/** Turns the like on (never off); used by double-tap. No request when already liked. */
export function likeTripOnce(tripId: string): void {
  if (!getTripSocial(tripId).liked) toggle(tripId, 'like');
}

export function toggleTripSave(tripId: string): void {
  toggle(tripId, 'save');
}

export type TripSocialApi = TripSocial & {
  toggleLike: () => void;
  toggleSave: () => void;
};

/** Store selector for one trip. Pass null while the id is unknown. */
export function useTripSocial(tripId: string | null): TripSocialApi {
  const getSnapshot = useCallback(() => (tripId ? getTripSocial(tripId) : EMPTY), [tripId]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const toggleLike = useCallback(() => {
    if (tripId) toggleTripLike(tripId);
  }, [tripId]);
  const toggleSave = useCallback(() => {
    if (tripId) toggleTripSave(tripId);
  }, [tripId]);
  return { ...snapshot, toggleLike, toggleSave };
}

// Feed-level events: reposts change which items the feed shows.
export type SocialEvent =
  | { type: 'repost-removing'; repostId: string; tripId: string }
  | { type: 'repost-remove-failed'; repostId: string }
  | { type: 'repost-removed'; repostId: string; tripId: string }
  | { type: 'repost-created'; tripId: string };

const eventListeners = new Set<(event: SocialEvent) => void>();

export function subscribeSocialEvents(listener: (event: SocialEvent) => void): () => void {
  eventListeners.add(listener);
  return () => {
    eventListeners.delete(listener);
  };
}

export function emitSocialEvent(event: SocialEvent): void {
  eventListeners.forEach((l) => l(event));
}
