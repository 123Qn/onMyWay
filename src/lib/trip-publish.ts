import { supabase } from '@/lib/supabase';
import { classifyTripError, type ErrorKind } from '@/lib/trip-errors';
import {
  normalizeText,
  pendingUploads,
  toStopsPayload,
  tripFilePath,
  type PathPatch,
  type TripFormValues,
} from '@/lib/trip-form';
import { listAll, removePaths, removePrefix, uploadJpeg } from '@/lib/trip-storage';
import type { Json } from '@/types/database';

export type PublishStep = 'trip' | 'photos' | 'stops' | 'finish';
export type PublishProgress = { step: PublishStep; done: number; total: number };

export type PublishResult =
  | { ok: true }
  | { ok: false; step: PublishStep; kind: ErrorKind; photoId?: string };

export type PublishArgs = {
  userId: string;
  tripId: string;
  form: TripFormValues;
  onProgress: (p: PublishProgress) => void;
  /** Persist assigned storage paths into the form and the draft immediately. */
  onFormPatch: (patch: PathPatch) => void;
};

/**
 * Idempotent publish: every step can be re-run with the same tripId and the
 * form (which carries already uploaded paths) after a failure.
 */
export async function publishTrip(args: PublishArgs): Promise<PublishResult> {
  const { userId, tripId, form, onProgress, onFormPatch } = args;
  let step: PublishStep = 'trip';
  let photoId: string | undefined;
  try {
    // 1. Private trip row. 23505 = it already exists from an earlier attempt.
    onProgress({ step, done: 0, total: 0 });
    const insert = await supabase.from('trips').insert({
      id: tripId,
      owner_id: userId,
      title: form.title.trim(),
      description: normalizeText(form.description),
      visibility: 'private',
    });
    if (insert.error && insert.error.code !== '23505') {
      return { ok: false, step, kind: classifyTripError(insert.error) };
    }

    // 2. Uploads (only what has no path yet), then the cover pointer.
    step = 'photos';
    const pending = pendingUploads(form);
    const paths = {
      cover: form.cover?.path ?? null,
      photos: new Map<string, string>(),
    };
    let done = 0;
    if (pending.length > 0) onProgress({ step, done, total: pending.length });
    for (const item of pending) {
      photoId = item.id;
      const path = tripFilePath(userId, tripId, item.id);
      const upload = await uploadJpeg(path, item.uri);
      if (!upload.ok) {
        if (upload.reason === 'missing') return { ok: false, step, kind: 'photo_missing', photoId };
        return { ok: false, step, kind: classifyTripError(upload.error), photoId };
      }
      if (item.kind === 'cover') {
        paths.cover = path;
        onFormPatch({ photoPaths: {}, coverPath: path });
      } else {
        paths.photos.set(item.id, path);
        onFormPatch({ photoPaths: { [item.id]: path } });
      }
      done += 1;
      onProgress({ step, done, total: pending.length });
    }
    photoId = undefined;
    if (paths.cover) {
      const { data, error } = await supabase
        .from('trips')
        .update({ cover_path: paths.cover })
        .eq('id', tripId)
        .select('id')
        .maybeSingle();
      if (error) return { ok: false, step, kind: classifyTripError(error) };
      if (!data) return { ok: false, step, kind: 'not_owner' };
    }

    // 3. Stops and photo rows in one atomic call.
    step = 'stops';
    onProgress({ step, done: 0, total: 0 });
    const patched: TripFormValues = {
      ...form,
      stops: form.stops.map((s) => ({
        ...s,
        photos: s.photos.map((p) => ({ ...p, path: p.path ?? paths.photos.get(p.id) ?? null })),
      })),
    };
    const payload = toStopsPayload(patched);
    if (!payload) return { ok: false, step, kind: 'unknown' };
    const rpc = await supabase.rpc('save_trip_stops', {
      p_trip_id: tripId,
      p_stops: payload as unknown as Json,
    });
    if (rpc.error) return { ok: false, step, kind: classifyTripError(rpc.error) };

    // 4. Visibility last: the trip stays private until everything else worked.
    step = 'finish';
    onProgress({ step, done: 0, total: 0 });
    const visibility = await supabase
      .from('trips')
      .update({ visibility: form.visibility })
      .eq('id', tripId)
      .select('id')
      .maybeSingle();
    if (visibility.error) {
      return { ok: false, step, kind: classifyTripError(visibility.error) };
    }
    if (!visibility.data) return { ok: false, step, kind: 'not_owner' };

    // 5. Best-effort sweep of uploads that no row references (lost responses on retries).
    try {
      const referenced = new Set<string>(patched.stops.flatMap((s) => s.photos.map((p) => p.path ?? '')));
      if (paths.cover) referenced.add(paths.cover);
      const all = await listAll(`${userId}/${tripId}`);
      if (all) {
        const stray = all.filter((p) => !referenced.has(p));
        if (stray.length > 0) await removePaths(stray);
      }
    } catch {
      // Ignored.
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, step, kind: classifyTripError(e), photoId };
  }
}

/** Deletes the uploaded files, then the private half-created trip row. True when nothing is left. */
export async function discardPublishedTrip(userId: string, tripId: string): Promise<boolean> {
  try {
    if (!(await removePrefix(userId, tripId))) return false;
    const { error } = await supabase
      .from('trips')
      .delete()
      .eq('id', tripId)
      .select('id')
      .maybeSingle();
    // No row = already gone = success.
    return !error;
  } catch {
    return false;
  }
}
