export type PickedLocation = {
  lat: number;
  lng: number;
  name: string;
  address: string | null;
};

const MAX_ENTRIES = 10;
const results = new Map<string, PickedLocation>();

/** Called by the picker on confirm, right before it closes. Keeps the newest 10 entries. */
export function setPickResult(requestId: string, value: PickedLocation): void {
  results.delete(requestId);
  results.set(requestId, value);
  while (results.size > MAX_ENTRIES) {
    const oldest = results.keys().next().value;
    if (oldest === undefined) break;
    results.delete(oldest);
  }
}

/** Called by the opener: reads the result once and deletes it. Null when cancelled or already taken. */
export function takePickResult(requestId: string): PickedLocation | null {
  const value = results.get(requestId) ?? null;
  results.delete(requestId);
  return value;
}
