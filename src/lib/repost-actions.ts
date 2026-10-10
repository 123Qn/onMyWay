import { Alert } from 'react-native';

import { deleteRepost, findMyRepostId } from '@/lib/social-api';
import { SocialError } from '@/lib/social-errors';
import { emitSocialEvent, getTripSocial, updateTripSocial } from '@/lib/social-store';
import { showToast } from '@/lib/toast';

const TOAST_REMOVE_FAILED = "Couldn't remove the repost. Try again.";

/**
 * Removes the viewer's repost of a trip. `repostId` is known from a repost card; from an
 * original card it is looked up (own reposts are readable under RLS). The feed hides the card
 * at once and restores it when the request fails.
 */
export async function removeRepost(opts: {
  tripId: string;
  userId: string;
  repostId?: string | null;
}): Promise<boolean> {
  const { tripId, userId } = opts;
  let repostId = opts.repostId ?? getTripSocial(tripId).repostId;
  try {
    if (!repostId) repostId = await findMyRepostId(tripId, userId);
    if (!repostId) {
      // Nothing to delete on the server: just correct the local state.
      updateTripSocial(tripId, { reposted: false, repostId: null });
      return true;
    }
    emitSocialEvent({ type: 'repost-removing', repostId, tripId });
    const result = await deleteRepost(repostId);
    // A repost that is already gone counts as removed.
    updateTripSocial(tripId, {
      reposted: false,
      repostId: null,
      ...(result ? { repostCount: result.repostCount } : {}),
    });
    emitSocialEvent({ type: 'repost-removed', repostId, tripId });
    return true;
  } catch (error) {
    if (repostId) emitSocialEvent({ type: 'repost-remove-failed', repostId });
    showToast(error instanceof SocialError && error.kind === 'rate_limited'
      ? "You're doing that too fast. Try again in a moment."
      : TOAST_REMOVE_FAILED);
    return false;
  }
}

/** "Remove repost?" confirm, then removeRepost. */
export function confirmRemoveRepost(opts: {
  tripId: string;
  userId: string;
  repostId?: string | null;
  onDone?: (ok: boolean) => void;
}): void {
  Alert.alert(
    'Remove repost?',
    'It will be removed from your feed. The original trip is not affected.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          void removeRepost(opts).then((ok) => opts.onDone?.(ok));
        },
      },
    ],
  );
}
