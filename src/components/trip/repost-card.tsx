import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { TripActionBar } from '@/components/social/trip-action-bar';
import { ThemedText } from '@/components/themed-text';
import { TripCard, formatStopCount } from '@/components/trip/trip-card';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { IconButton } from '@/components/ui/icon-button';
import { Layout, Radius, Spacing } from '@/constants/theme';
import type { FeedRepostItem } from '@/hooks/use-feed';
import { formatRelativeShort } from '@/lib/format-date';
import { COLLAPSED, collapsedA11y } from '@/lib/collapse';

const CAPTION_LINES = 3;
const CAPTION_COLLAPSE_CHARS = 140;

type Props = {
  item: FeedRepostItem;
  /** The viewer made this repost: shows the more button. */
  isMine: boolean;
  /** The viewer owns the original trip: no Save. */
  isTripOwner: boolean;
  onOpenTrip: () => void;
  onOpenReposter: () => void;
  onOpenComments: () => void;
  onOpenShare: () => void;
  onOpenMenu: () => void;
  onCoverError?: (coverPath: string) => void;
};

/** Collapsible caption in an always-mounted slot (no view is inserted when it is empty). */
function CaptionSlot({ caption }: { caption: string | null }) {
  const [expanded, setExpanded] = useState(false);
  const text = caption?.trim() ?? '';
  const collapsible = text.length > CAPTION_COLLAPSE_CHARS || text.split('\n').length > CAPTION_LINES;
  return (
    <View
      collapsable={false}
      {...collapsedA11y(!text)}
      style={text ? styles.caption : styles.noneStack}>
      <ThemedText numberOfLines={collapsible && !expanded ? CAPTION_LINES : undefined}>{text}</ThemedText>
      <View
        collapsable={false}
        {...collapsedA11y(!collapsible)}
        style={[styles.more, !collapsible && styles.none]}>
        <Button
          title={expanded ? 'less' : 'more'}
          variant="ghost"
          size="sm"
          onPress={() => setExpanded((v) => !v)}
        />
      </View>
    </View>
  );
}

/**
 * A repost in the feed: reposter header, optional caption, the embedded ORIGINAL trip and the
 * action bar (which acts on the original).
 */
export function RepostCard({
  item,
  isMine,
  isTripOwner,
  onOpenTrip,
  onOpenReposter,
  onOpenComments,
  onOpenShare,
  onOpenMenu,
  onCoverError,
}: Props) {
  const { reposter, trip } = item;
  const author = trip.author;
  const tripLabel =
    `Trip: ${trip.title}` +
    (author ? `, by ${author.displayName}` : '') +
    `. ${formatStopCount(trip.stopCount)}. Reposted by ${reposter.displayName}.`;

  return (
    <Card radius="xl" padding={Spacing.three}>
      <View style={styles.stack}>
        <View style={styles.header}>
          <Pressable
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel={`${reposter.displayName}, @${reposter.username}. View profile`}
            onPress={onOpenReposter}
            style={styles.who}>
            <Avatar size="md" uri={reposter.avatarUrl} name={reposter.displayName} />
            <View style={styles.whoText}>
              <ThemedText type="small" numberOfLines={1}>
                {reposter.displayName}
                <ThemedText type="small" themeColor="textMuted">
                  {' reposted'}
                </ThemedText>
              </ThemedText>
              <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
                {formatRelativeShort(item.createdAt)}
              </ThemedText>
            </View>
          </Pressable>
          <View
            collapsable={false}
            {...collapsedA11y(!isMine)}
            style={isMine ? undefined : styles.noneRow}>
            <IconButton
              icon="more"
              accessibilityLabel="Repost options"
              disabled={!isMine}
              onPress={onOpenMenu}
            />
          </View>
        </View>

        <CaptionSlot caption={item.caption} />

        <TripCard
          trip={trip}
          variant="embedded"
          accessibilityLabel={tripLabel}
          onPress={onOpenTrip}
          onCoverError={onCoverError}
        />

        <TripActionBar
          tripId={trip.id}
          showSave={!isTripOwner}
          onOpenComments={onOpenComments}
          onOpenShare={onOpenShare}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.three - Spacing.one },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  who: {
    flex: 1,
    minHeight: Layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
  },
  whoText: { flex: 1, minWidth: 0 },
  caption: { gap: Spacing.one, borderRadius: Radius.md },
  more: { alignSelf: 'flex-start' },
  // Collapsed (see lib/collapse); negative margins cancel the gap of the parent.
  none: { ...COLLAPSED, marginBottom: -Spacing.one },
  noneStack: { ...COLLAPSED, marginBottom: -(Spacing.three - Spacing.one) },
  noneRow: { ...COLLAPSED, marginRight: -Spacing.two },
});
