import { useCallback, useEffect, useRef, useState } from 'react';

import { fetchTripSocial } from '@/lib/social-api';
import { seedTripSocial } from '@/lib/social-store';

export type TripSocialInfo = {
  /** 'unavailable' = the server returned no row (private or deleted for the viewer). */
  status: 'loading' | 'ready' | 'unavailable' | 'error';
  ownerId: string | null;
  /** Server truth: public and not the viewer's own trip. */
  canRepost: boolean;
  reload: () => void;
};

/**
 * One get_trip_social call per screen (never per feed card). Seeds the shared social store with
 * counts and flags, and reports whether the trip is visible at all.
 */
export function useTripSocialInfo(tripId: string): TripSocialInfo {
  const [state, setState] = useState<Omit<TripSocialInfo, 'reload'>>({
    status: 'loading',
    ownerId: null,
    canRepost: false,
  });
  const requestRef = useRef(0);

  const load = useCallback(() => {
    const request = ++requestRef.current;
    fetchTripSocial(tripId)
      .then((row) => {
        if (request !== requestRef.current) return;
        if (!row) {
          setState({ status: 'unavailable', ownerId: null, canRepost: false });
          return;
        }
        seedTripSocial([
          {
            tripId,
            seed: {
              likeCount: row.like_count,
              commentCount: row.comment_count,
              repostCount: row.repost_count,
              liked: row.liked_by_me,
              saved: row.saved_by_me,
              reposted: row.reposted_by_me,
            },
          },
        ]);
        setState({ status: 'ready', ownerId: row.owner_id, canRepost: row.can_repost });
      })
      .catch(() => {
        if (request !== requestRef.current) return;
        setState((prev) => (prev.status === 'ready' ? prev : { ...prev, status: 'error' }));
      });
  }, [tripId]);

  useEffect(() => {
    load();
    return () => {
      // Counter, not a DOM node: invalidates in-flight responses on unmount or id change.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      requestRef.current++;
    };
  }, [load]);

  return { ...state, reload: load };
}
