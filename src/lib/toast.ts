import { AccessibilityInfo } from 'react-native';

/** Minimal toast bus: one message at a time, shown by the topmost mounted ToastHost. */
export type ToastState = { id: number; message: string } | null;

const DURATION_MS = 3000;

let state: ToastState = null;
let counter = 0;
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
const lastShown = new Map<string, number>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeToast(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToast(): ToastState {
  return state;
}

/** Shows a toast for 3 s and announces it. `throttleMs` drops repeats of the same text. */
export function showToast(message: string, throttleMs = 0): void {
  const now = Date.now();
  const last = lastShown.get(message);
  if (throttleMs > 0 && last !== undefined && now - last < throttleMs) return;
  lastShown.set(message, now);
  state = { id: ++counter, message };
  emit();
  AccessibilityInfo.announceForAccessibility(message);
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    state = null;
    timer = null;
    emit();
  }, DURATION_MS);
}

// Which host renders: the most recently mounted one (a modal covers the layout-level host).
const hosts: number[] = [];
const hostListeners = new Set<() => void>();
let hostCounter = 0;

export function allocateToastHostId(): number {
  return ++hostCounter;
}

/** Makes `id` the topmost host until the returned function is called. */
export function registerToastHost(id: number): () => void {
  hosts.push(id);
  hostListeners.forEach((l) => l());
  return () => {
    const index = hosts.indexOf(id);
    if (index >= 0) hosts.splice(index, 1);
    hostListeners.forEach((l) => l());
  };
}

export function subscribeToastHosts(listener: () => void): () => void {
  hostListeners.add(listener);
  return () => {
    hostListeners.delete(listener);
  };
}

export function getActiveToastHost(): number | null {
  return hosts.length > 0 ? hosts[hosts.length - 1] : null;
}
