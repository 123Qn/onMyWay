/**
 * Pending deep link: a link opened while signed out is remembered (validated) and opened once
 * after sign-in. Only internal `/trip/<uuid>` paths are ever stored, so a crafted link can never
 * become an open redirect.
 */
const SCHEME = 'onmyway://';
const TRIP_PATH = /^trip\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Maps an incoming URL to a safe internal path, or null. Rejects http(s) and other schemes. */
export function toInternalPath(url: string | null | undefined): string | null {
  if (!url || url.length > 300) return null;
  let rest: string;
  if (url.toLowerCase().startsWith(SCHEME)) rest = url.slice(SCHEME.length);
  else if (url.startsWith('/') && !url.startsWith('//')) rest = url.slice(1);
  else return null;
  rest = rest.split(/[?#]/)[0].replace(/^\/+/, '').replace(/\/+$/, '');
  const match = TRIP_PATH.exec(rest);
  return match ? `/trip/${match[1].toLowerCase()}` : null;
}

let pending: string | null = null;

/** Stores the link if it is a safe internal path; otherwise leaves the current value alone. */
export function setPendingLink(url: string | null | undefined): void {
  const path = toInternalPath(url);
  if (path) pending = path;
}

/** Returns the stored path once and clears it. */
export function consumePendingLink(): string | null {
  const path = pending;
  pending = null;
  return path;
}
