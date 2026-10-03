/** Tiny in-memory bus so lists that are already mounted can react to trip changes. */
export type TripEvent =
  | { type: 'removed'; id: string }
  | { type: 'created'; id: string }
  | { type: 'updated'; id: string }
  | { type: 'visibility'; id: string; visibility: 'public' | 'private' };

type Listener = (event: TripEvent) => void;

const listeners = new Set<Listener>();

export function subscribeTripEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitTripEvent(event: TripEvent): void {
  listeners.forEach((l) => l(event));
}
