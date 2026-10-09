import { supabase } from '@/lib/supabase';
import { classifyTripError, type ErrorKind } from '@/lib/trip-errors';
import {
  normalizeText,
  pendingUploads,
  toStopsPayload,
  tripFilePath,
  type PathPatch,
  type TravelMode,
  type TripFormValues,
} from '@/lib/trip-form';
import { computeTripRoute, type RouteOutcome } from '@/lib/trip-route';
import { removePaths, uploadJpeg } from '@/lib/trip-storage';
import type { Json } from '@/types/database';

export type SaveProgress = { step: 'photos' | 'save' | 'route'; done: number; total: number };

export type SaveResult =
  | {
      ok: true;
      removed: string[];
      /** Outcome of the route step; null when routing was not needed. Never a failure of the save. */
      route: RouteOutcome | null;
    }
  | {
      ok: false;
      kind: ErrorKind;
      /** True when the failure happened while uploading (for the message copy). */
      uploading: boolean;
      photoId?: string;
      /** Paths of files deleted again after a definite failure; the caller clears them in the form. */
      discarded?: string[];
    };

export type SaveArgs = {
  userId: string;
  tripId: string;
  initialCoverPath: string | null;
  /** Server values before the edit; restored if the stops RPC fails after the trip row was updated. */
  initialTrip: {
    title: string;
    description: string | null;
    visibility: 'public' | 'private';
    travelMode: TravelMode;
  };
  /** Compute the road route after the stops were saved (see `needsRoute`). */
  routeNeeded: boolean;
  form: TripFormValues;
  /** Mutated: every path uploaded during this edit session (survives retries). */
  uploadedThisAttempt: Set<string>;
  onProgress: (p: SaveProgress) => void;
  onFormPatch: (patch: PathPatch) => void;
};

/** Definite server answers: the same request would fail again, so uploaded files are dropped. */
function isDefinite(kind: ErrorKind): boolean {
  return kind === 'limit' || kind === 'not_owner' || kind === 'invalid';
}

export async function saveTripEdits(args: SaveArgs): Promise<SaveResult> {
  const {
    userId,
    tripId,
    initialCoverPath,
    initialTrip,
    routeNeeded,
    form,
    uploadedThisAttempt,
    onProgress,
    onFormPatch,
  } = args;
  let uploading = true;
  let photoId: string | undefined;
  let rowUpdated = false;

  /** Puts the trip row back; false when it could not be confirmed. */
  const revertRow = async (): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('trips')
        .update({
          title: initialTrip.title,
          description: initialTrip.description,
          cover_path: initialCoverPath,
          visibility: initialTrip.visibility,
          travel_mode: initialTrip.travelMode,
        })
        .eq('id', tripId)
        .select('id')
        .maybeSingle();
      return !error && !!data;
    } catch {
      return false;
    }
  };

  const fail = async (kind: ErrorKind): Promise<SaveResult> => {
    let discarded: string[] | undefined;
    // After the row was updated, only drop the new files once the row no longer references them.
    const safeToDelete = !rowUpdated || !isDefinite(kind) || (await revertRow());
    if (isDefinite(kind) && safeToDelete && uploadedThisAttempt.size > 0) {
      discarded = [...uploadedThisAttempt];
      uploadedThisAttempt.clear();
      await removePaths(discarded);
    }
    return { ok: false, kind, uploading, photoId, discarded };
  };

  try {
    // 1. Upload new files first; remember the paths so a retry skips them.
    const pending = pendingUploads(form);
    const photoPaths = new Map<string, string>();
    let coverPath = form.cover?.path ?? null;
    let done = 0;
    if (pending.length > 0) onProgress({ step: 'photos', done, total: pending.length });
    for (const item of pending) {
      photoId = item.id;
      const path = tripFilePath(userId, tripId, item.id);
      const upload = await uploadJpeg(path, item.uri);
      if (!upload.ok) {
        if (upload.reason === 'missing') return await fail('photo_missing');
        return await fail(classifyTripError(upload.error));
      }
      uploadedThisAttempt.add(path);
      if (item.kind === 'cover') {
        coverPath = path;
        onFormPatch({ photoPaths: {}, coverPath: path });
      } else {
        photoPaths.set(item.id, path);
        onFormPatch({ photoPaths: { [item.id]: path } });
      }
      done += 1;
      onProgress({ step: 'photos', done, total: pending.length });
    }
    photoId = undefined;
    uploading = false;
    onProgress({ step: 'save', done: 0, total: 0 });

    // 2. Trip row. select() makes a 0-row (RLS or missing) update detectable.
    const { data, error } = await supabase
      .from('trips')
      .update({
        title: form.title.trim(),
        description: normalizeText(form.description),
        cover_path: coverPath,
        visibility: form.visibility,
        travel_mode: form.travelMode,
      })
      .eq('id', tripId)
      .select('id')
      .maybeSingle();
    if (error) return await fail(classifyTripError(error));
    if (!data) return await fail('not_owner');
    rowUpdated = true;

    // 3. Full stop list (existing ids keep their rows).
    const payload = toStopsPayload({
      ...form,
      stops: form.stops.map((s) => ({
        ...s,
        photos: s.photos.map((p) => ({ ...p, path: p.path ?? photoPaths.get(p.id) ?? null })),
      })),
    });
    if (!payload) return await fail('unknown');
    const rpc = await supabase.rpc('save_trip_stops', {
      p_trip_id: tripId,
      p_stops: payload as unknown as Json,
    });
    if (rpc.error) return await fail(classifyTripError(rpc.error));

    // 4. Cleanup is best effort and never fails the save.
    const removed = [...(rpc.data ?? [])];
    if (initialCoverPath && initialCoverPath !== coverPath) removed.push(initialCoverPath);
    await removePaths(removed);
    uploadedThisAttempt.clear();

    // 5. Road route. The save already succeeded: routing problems only mean straight lines.
    let route: RouteOutcome | null = null;
    if (routeNeeded) {
      onProgress({ step: 'route', done: 0, total: 0 });
      route = await computeTripRoute(tripId);
    }
    return { ok: true, removed, route };
  } catch (e) {
    return await fail(classifyTripError(e));
  }
}
