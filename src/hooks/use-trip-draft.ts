import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { clearDraft, loadDraft, saveDraft, type TripDraft } from '@/lib/trip-drafts';
import { isEmptyForm, type TripFormValues } from '@/lib/trip-form';

const DEBOUNCE_MS = 800;

export type TripDraftState = {
  /** The initial read finished. */
  loaded: boolean;
  /** Loaded and either no draft exists or the caller already decided; the form can be shown. */
  ready: boolean;
  /** The draft found on open (null = none or unreadable). */
  draft: TripDraft | null;
  /** At least one autosave succeeded (drives "Draft saved on this device"). */
  saved: boolean;
  /** Writes the current form now (skipped debounce). */
  flush: () => Promise<void>;
  /** Writes explicit values now, e.g. bookkeeping (tripId, uploaded paths). */
  persistNow: (form: TripFormValues, tripId: string | null) => Promise<void>;
  /** Removes the draft and stops further autosaves. */
  clear: () => Promise<void>;
};

/** Local draft for a NEW trip: load once, debounced autosave, flush on background. */
export function useTripDraft(
  userId: string | null,
  form: TripFormValues,
  tripId: string | null,
  /** The caller resolved the resume prompt (resume or discard). */
  decided: boolean,
  /** Pauses autosave (e.g. while a discard runs). */
  paused: boolean,
): TripDraftState {
  const [loaded, setLoaded] = useState(false);
  const [draft, setDraft] = useState<TripDraft | null>(null);
  const [saved, setSaved] = useState(false);
  const closedRef = useRef(false);
  const ready = decided || (loaded && draft === null);
  const enabled = ready && !paused;
  const latest = useRef({ form, tripId });

  useEffect(() => {
    latest.current = { form, tripId };
  });

  useEffect(() => {
    if (!userId) return;
    let active = true;
    loadDraft(userId).then((d) => {
      if (!active) return;
      setDraft(d);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [userId]);

  const persistNow = useCallback(
    async (values: TripFormValues, id: string | null) => {
      if (!userId || closedRef.current) return;
      // An empty form with no partial publish leaves no draft behind.
      if (isEmptyForm(values) && id === null) {
        await clearDraft(userId);
        return;
      }
      if (await saveDraft(userId, id, values)) setSaved(true);
    },
    [userId],
  );

  const flush = useCallback(
    () => persistNow(latest.current.form, latest.current.tripId),
    [persistNow],
  );

  const clear = useCallback(async () => {
    closedRef.current = true;
    if (userId) await clearDraft(userId);
  }, [userId]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => void persistNow(form, tripId), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [enabled, form, tripId, persistNow]);

  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'inactive' || state === 'background') void flush();
    });
    return () => sub.remove();
  }, [enabled, flush]);

  return { loaded, ready, draft, saved, flush, persistNow, clear };
}
