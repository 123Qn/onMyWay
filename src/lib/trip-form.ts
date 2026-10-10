import { routeDistanceKm } from '@/lib/geo';

export const MAX_STOPS = 20;
export const MAX_PHOTOS_PER_STOP = 5;
export const TITLE_MAX = 120;
export const STOP_NAME_MAX = 120;
export const TEXT_MAX = 5000;

export type Visibility = 'public' | 'private';
export type TravelMode = 'driving' | 'walking' | 'cycling';

/** `uri` = local compressed file; `path` = storage path (set once uploaded, or for server photos). */
export type PhotoValue = { id: string; uri: string | null; path: string | null };
export type CoverValue = { id: string; uri: string | null; path: string | null };

export type StopValue = {
  id: string;
  name: string;
  /** Name that came from the picker; lets a later location change replace it. Never sent. */
  autoName: string;
  notes: string;
  lat: number;
  lng: number;
  address: string | null;
  photos: PhotoValue[];
};

export type TripFormValues = {
  title: string;
  description: string;
  visibility: Visibility;
  travelMode: TravelMode;
  cover: CoverValue | null;
  stops: StopValue[];
};

export function emptyForm(): TripFormValues {
  return { title: '', description: '', visibility: 'public', travelMode: 'driving', cover: null, stops: [] };
}

/** Trim and collapse 3+ newlines to 2; empty becomes null (never send ''). */
export function normalizeText(text: string): string | null {
  const v = text.trim().replace(/\n{3,}/g, '\n\n');
  return v.length > 0 ? v : null;
}

export function isEmptyForm(form: TripFormValues): boolean {
  return (
    form.title.trim() === '' &&
    form.description.trim() === '' &&
    form.cover === null &&
    form.stops.length === 0
  );
}

/** Stable comparable snapshot used for the edit screen's dirty check. */
export function normalizeForm(form: TripFormValues): string {
  return JSON.stringify({
    t: form.title.trim(),
    d: normalizeText(form.description),
    v: form.visibility,
    m: form.travelMode,
    c: form.cover ? form.cover.id : null,
    s: form.stops.map((s) => [
      s.id,
      s.name.trim(),
      normalizeText(s.notes),
      s.lat,
      s.lng,
      s.address,
      s.photos.map((p) => p.id),
    ]),
  });
}

export type StopErrors = { name?: string };

export type FormErrors = {
  title?: string;
  stops?: string;
  stopErrors: Record<string, StopErrors>;
  /** Number of problems (for the screen reader announcement). */
  count: number;
  /** Key of the first invalid input in screen order: 'title', 'stops' or `name:{stopId}`. */
  first: string | null;
};

export function validateForm(form: TripFormValues): FormErrors {
  const errors: FormErrors = { stopErrors: {}, count: 0, first: null };
  const add = (key: string) => {
    errors.count += 1;
    if (!errors.first) errors.first = key;
  };

  const title = form.title.trim();
  if (title.length < 1 || title.length > TITLE_MAX) {
    errors.title = 'Enter a title for your trip.';
    add('title');
  }
  if (form.description.length > TEXT_MAX) add('description');

  form.stops.forEach((s) => {
    const name = s.name.trim();
    if (name.length < 1 || name.length > STOP_NAME_MAX) {
      errors.stopErrors[s.id] = { name: 'Enter a name for this stop.' };
      add(`name:${s.id}`);
    } else if (
      s.notes.length > TEXT_MAX ||
      s.photos.length > MAX_PHOTOS_PER_STOP ||
      !Number.isFinite(s.lat) ||
      !Number.isFinite(s.lng) ||
      Math.abs(s.lat) > 90 ||
      Math.abs(s.lng) > 180
    ) {
      add(`stop:${s.id}`);
    }
  });

  if (form.stops.length < 1) {
    errors.stops = 'Add at least one stop to publish.';
    add('stops');
  } else if (form.stops.length > MAX_STOPS) {
    add('stops');
  }
  return errors;
}

export type StopPayload = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  notes: string | null;
  photos: { id: string; storage_path: string }[];
};

/** Payload for `save_trip_stops`; null when a photo has no storage path yet. */
export function toStopsPayload(form: TripFormValues): StopPayload[] | null {
  const out: StopPayload[] = [];
  for (const s of form.stops) {
    const photos: StopPayload['photos'] = [];
    for (const p of s.photos) {
      if (!p.path) return null;
      photos.push({ id: p.id, storage_path: p.path });
    }
    out.push({
      id: s.id,
      name: s.name.trim(),
      lat: s.lat,
      lng: s.lng,
      address: s.address && s.address.trim() ? s.address.trim() : null,
      notes: normalizeText(s.notes),
      photos,
    });
  }
  return out;
}

export type PathPatch = { photoPaths: Record<string, string>; coverPath?: string };

/** Pure: assigns uploaded storage paths to photos (by id) and the cover. */
export function applyPathPatch(form: TripFormValues, patch: PathPatch): TripFormValues {
  return {
    ...form,
    cover: form.cover && patch.coverPath ? { ...form.cover, path: patch.coverPath } : form.cover,
    stops: form.stops.map((s) =>
      s.photos.some((p) => patch.photoPaths[p.id])
        ? {
            ...s,
            photos: s.photos.map((p) =>
              patch.photoPaths[p.id] ? { ...p, path: patch.photoPaths[p.id] } : p,
            ),
          }
        : s,
    ),
  };
}

/** Pure: forgets storage paths of files that were deleted again (photos keep their local uri). */
export function clearPaths(form: TripFormValues, paths: Set<string>): TripFormValues {
  return {
    ...form,
    cover:
      form.cover && form.cover.path && paths.has(form.cover.path)
        ? { ...form.cover, path: null }
        : form.cover,
    stops: form.stops.map((s) => ({
      ...s,
      photos: s.photos.map((p) => (p.path && paths.has(p.path) ? { ...p, path: null } : p)),
    })),
  };
}

export function tripFilePath(userId: string, tripId: string, fileId: string): string {
  return `${userId}/${tripId}/${fileId}.jpg`;
}

export type PendingUpload = { id: string; uri: string; kind: 'cover' | 'photo' };

/** Items that still need uploading: photos and the cover without a storage path but with a file. */
export function pendingUploads(form: TripFormValues): PendingUpload[] {
  const items: PendingUpload[] = [];
  if (form.cover && !form.cover.path && form.cover.uri) {
    items.push({ id: form.cover.id, uri: form.cover.uri, kind: 'cover' });
  }
  for (const s of form.stops) {
    for (const p of s.photos) {
      if (!p.path && p.uri) items.push({ id: p.id, uri: p.uri, kind: 'photo' });
    }
  }
  return items;
}

/** Drafts saved before travel modes existed have no value: they load as driving. */
export function withTravelModeDefault(form: TripFormValues): TripFormValues {
  const mode = (form as Partial<TripFormValues>).travelMode;
  return mode === 'walking' || mode === 'cycling' || mode === 'driving'
    ? form
    : { ...form, travelMode: 'driving' };
}

/** Routing needs 2+ stops that are not all at one point (under 10 m, as the distance tile treats them). */
export function hasRoutableStops(stops: readonly { lat: number; lng: number }[]): boolean {
  return (routeDistanceKm(stops) ?? 0) >= 0.01;
}

/** True when the travel mode, or the order or position of the stops, differs (a stored route would be stale). */
export function routeInputsChanged(initial: TripFormValues, form: TripFormValues): boolean {
  if (initial.travelMode !== form.travelMode) return true;
  if (initial.stops.length !== form.stops.length) return true;
  return form.stops.some((s, i) => {
    const o = initial.stops[i];
    return o.id !== s.id || o.lat !== s.lat || o.lng !== s.lng;
  });
}

/**
 * Whether saving should (re)compute the road route: at least 2 stops AND the stored route is
 * missing, failed or stale. A fresh 'none' answer is never retried. `storedStatus` is the status
 * of the route as loaded with the trip (null = never computed or already stale).
 */
export function needsRoute(
  initial: TripFormValues,
  form: TripFormValues,
  storedStatus: 'ok' | 'none' | 'error' | null,
): boolean {
  if (!hasRoutableStops(form.stops)) return false;
  if (routeInputsChanged(initial, form)) return true;
  return storedStatus === null || storedStatus === 'error';
}
