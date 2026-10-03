import { supabase } from '@/lib/supabase';

export const TRIP_BUCKET = 'trip-photos';
const LIST_PAGE = 100;

/** Lists every object directly under `prefix` (paginated) and returns full paths; null on failure. */
export async function listAll(prefix: string): Promise<string[] | null> {
  const paths: string[] = [];
  for (let offset = 0; ; offset += LIST_PAGE) {
    const { data, error } = await supabase.storage
      .from(TRIP_BUCKET)
      .list(prefix, { limit: LIST_PAGE, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error || !data) return null;
    for (const item of data) paths.push(`${prefix}/${item.name}`);
    if (data.length < LIST_PAGE) return paths;
  }
}

/** Best-effort removal; errors are ignored on purpose (an orphaned file is harmless). */
export async function removePaths(paths: string[]): Promise<void> {
  try {
    for (let i = 0; i < paths.length; i += LIST_PAGE) {
      await supabase.storage.from(TRIP_BUCKET).remove(paths.slice(i, i + LIST_PAGE));
    }
  } catch {
    // Ignored.
  }
}

/** Removes every object under `{uid}/{tripId}/`. Resolves false when listing or removal failed. */
export async function removePrefix(uid: string, tripId: string): Promise<boolean> {
  try {
    const paths = await listAll(`${uid}/${tripId}`);
    if (!paths) return false;
    for (let i = 0; i < paths.length; i += LIST_PAGE) {
      const chunk = paths.slice(i, i + LIST_PAGE);
      const { data, error } = await supabase.storage.from(TRIP_BUCKET).remove(chunk);
      if (error || !data || data.length < chunk.length) return false;
    }
    return true;
  } catch {
    return false;
  }
}

export type UploadResult =
  | { ok: true }
  | { ok: false; reason: 'missing' }
  | { ok: false; reason: 'error'; error: unknown };

/** Uploads a local JPEG to `path`. A 409 duplicate (lost response on a retry) counts as success. */
export async function uploadJpeg(path: string, uri: string): Promise<UploadResult> {
  let bytes: ArrayBuffer;
  try {
    bytes = await (await fetch(uri)).arrayBuffer();
  } catch {
    return { ok: false, reason: 'missing' };
  }
  try {
    const { error } = await supabase.storage
      .from(TRIP_BUCKET)
      .upload(path, bytes, { contentType: 'image/jpeg', upsert: false });
    if (!error) return { ok: true };
    const e = error as { statusCode?: unknown; status?: unknown; error?: unknown };
    if (String(e.statusCode) === '409' || String(e.status) === '409' || e.error === 'Duplicate') {
      return { ok: true };
    }
    return { ok: false, reason: 'error', error };
  } catch (error) {
    return { ok: false, reason: 'error', error };
  }
}
