import { router } from 'expo-router';
import { useState } from 'react';
import { Platform } from 'react-native';

import { BottomSheet, type SheetRow } from '@/components/ui/bottom-sheet';
import { confirmRemoveRepost } from '@/lib/repost-actions';
import { shareTripLink } from '@/lib/share';
import { useTripSocial } from '@/lib/social-store';
import { showToast } from '@/lib/toast';
import { useSession } from '@/providers/session-provider';

export type ShareTarget = {
  id: string;
  title: string;
  ownerId: string;
};

type Props = {
  /** Null keeps the sheet closed. */
  target: ShareTarget | null;
  onClose: () => void;
  /** Overrides the default (not your own trip). Detail passes the server value. */
  canRepost?: boolean;
};

// Presenting the OS share sheet while the Modal is still dismissing fails on iOS.
const SHARE_DELAY_MS = Platform.OS === 'ios' ? 400 : 0;

/** Share link, Repost and Remove repost for one public trip. */
export function TripShareSheet({ target: openTarget, onClose, canRepost }: Props) {
  const { profile } = useSession();
  // Keep the last target while the sheet fades out so its rows do not vanish first.
  const [lastTarget, setLastTarget] = useState(openTarget);
  if (openTarget && openTarget !== lastTarget) setLastTarget(openTarget);
  const target = openTarget ?? lastTarget;
  const social = useTripSocial(target?.id ?? null);
  const isOwner = !!target && !!profile && target.ownerId === profile.id;
  const repostAllowed = canRepost ?? !isOwner;

  const rows: SheetRow[] = [];
  if (target) {
    rows.push({
      key: 'share',
      icon: 'share',
      label: 'Share link...',
      onPress: () => {
        onClose();
        setTimeout(() => {
          void shareTripLink(target.id, target.title).then((ok) => {
            if (!ok) showToast("Couldn't open the share options. Try again.");
          });
        }, SHARE_DELAY_MS);
      },
    });
    if (social.reposted && !isOwner) {
      rows.push({
        key: 'remove-repost',
        icon: 'repost',
        label: 'Remove repost',
        onPress: () => {
          onClose();
          if (profile) confirmRemoveRepost({ tripId: target.id, userId: profile.id });
        },
      });
    } else if (repostAllowed && !isOwner) {
      rows.push({
        key: 'repost',
        icon: 'repost',
        label: 'Repost to your feed',
        onPress: () => {
          onClose();
          router.push(`/trip/${target.id}/repost`);
        },
      });
    }
  }

  return <BottomSheet visible={!!openTarget} onClose={onClose} rows={rows} title="Share options" />;
}
