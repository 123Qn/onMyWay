import AsyncStorage from '@react-native-async-storage/async-storage';

import type { TripFormValues } from '@/lib/trip-form';

export type TripDraft = { v: 1; savedAt: string; tripId: string | null; form: TripFormValues };

const key = (userId: string) => `onmyway:trip-draft:v1:${userId}`;

function isDraft(value: unknown): value is TripDraft {
  if (!value || typeof value !== 'object') return false;
  const d = value as Partial<TripDraft>;
  const f = d.form as Partial<TripFormValues> | undefined;
  return (
    d.v === 1 &&
    typeof d.savedAt === 'string' &&
    (d.tripId === null || typeof d.tripId === 'string') &&
    !!f &&
    typeof f.title === 'string' &&
    typeof f.description === 'string' &&
    (f.visibility === 'public' || f.visibility === 'private') &&
    Array.isArray(f.stops)
  );
}

/** Returns the saved draft, or null (and removes it) when it is missing or unreadable. */
export async function loadDraft(userId: string): Promise<TripDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (isDraft(parsed)) return parsed;
    await AsyncStorage.removeItem(key(userId));
  } catch {
    try {
      await AsyncStorage.removeItem(key(userId));
    } catch {
      // Ignored.
    }
  }
  return null;
}

/** Write failures (storage full) are ignored; the UI does not depend on them. */
export async function saveDraft(
  userId: string,
  tripId: string | null,
  form: TripFormValues,
): Promise<boolean> {
  try {
    const draft: TripDraft = { v: 1, savedAt: new Date().toISOString(), tripId, form };
    await AsyncStorage.setItem(key(userId), JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export async function clearDraft(userId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key(userId));
  } catch {
    // Ignored.
  }
}
