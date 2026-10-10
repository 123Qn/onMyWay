import type { ProfileCover } from "@/components/profile/profile-header";
import type { ProfileTrips } from "@/hooks/use-profile-trips";

/** Newest loaded trip that has a cover; its URL may still be signing (null). */
export function firstCover(
  trips: Pick<ProfileTrips, "items">,
): ProfileCover | null {
  const trip = trips.items.find((t) => t.coverPath);
  return trip?.coverPath ? { url: trip.coverUrl, path: trip.coverPath } : null;
}
