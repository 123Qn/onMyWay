import { Image } from 'expo-image';
import { useRef } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import { FontFamily, Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatDateLong, formatRelativeLong, formatRelativeShort } from '@/lib/format-date';

export type TripCardData = {
  id: string;
  title: string;
  coverUrl: string | null;
  coverPath: string | null;
  stopCount: number;
  createdAt: string;
  isPrivate?: boolean;
  author?: { username: string; displayName: string; avatarUrl: string | null };
};

export type TripCardProps = {
  trip: TripCardData;
  variant?: 'feed' | 'compact';
  /** Defaults to true for the feed variant; always false for compact. */
  showAuthor?: boolean;
  onPress: () => void;
  onPressAuthor?: () => void;
  /** Called at most once per card when the cover fails to load (parent re-signs the URL). */
  onCoverError?: (coverPath: string) => void;
};

const THUMB = 88;

export function formatStopCount(n: number): string {
  if (n === 0) return 'No stops';
  return n === 1 ? '1 stop' : `${n} stops`;
}

/** Long date for screen readers: relative when recent, otherwise "12 March 2025". */
function postedLabel(iso: string): string {
  return formatRelativeLong(iso) || formatDateLong(iso);
}

type CoverProps = {
  uri: string | null;
  cacheKey: string | null;
  style: StyleProp<ViewStyle>;
  onError?: (coverPath: string) => void;
};

function Cover({ uri, cacheKey, style, onError }: CoverProps) {
  const theme = useTheme();
  const retriedRef = useRef(false);
  return (
    <View style={[style, { backgroundColor: theme.primarySoft }]}>
      {uri ? (
        <Image
          source={{ uri, cacheKey: cacheKey ?? undefined }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          accessible={false}
          onError={() => {
            if (!cacheKey || retriedRef.current) return;
            retriedRef.current = true;
            onError?.(cacheKey);
          }}
        />
      ) : (
        <View style={styles.placeholder}>
          <Icon
            name="map"
            size={Layout.iconSize.xl}
            color="primary"
            style={styles.placeholderIcon}
          />
        </View>
      )}
    </View>
  );
}

function PrivateBadge() {
  const theme = useTheme();
  return (
    <View style={[styles.badge, { backgroundColor: theme.background, borderColor: theme.border }]}>
      <Icon name="lock" size={Layout.iconSize.sm} color="textMuted" />
      <ThemedText type="caption" themeColor="textMuted">
        Private
      </ThemedText>
    </View>
  );
}

function MetaRow({ trip, trailingBadge }: { trip: TripCardData; trailingBadge: boolean }) {
  return (
    <View style={styles.metaRow}>
      <Icon name="map" size={Layout.iconSize.sm} color="textMuted" />
      <ThemedText type="caption" themeColor="textMuted">
        {`${formatStopCount(trip.stopCount)} · ${formatRelativeShort(trip.createdAt)}`}
      </ThemedText>
      {trip.isPrivate && trailingBadge ? (
        <View style={styles.badgeRight}>
          <PrivateBadge />
        </View>
      ) : null}
    </View>
  );
}

export function TripCard({
  trip,
  variant = 'feed',
  showAuthor,
  onPress,
  onPressAuthor,
  onCoverError,
}: TripCardProps) {
  const theme = useTheme();
  const compact = variant === 'compact';
  const author = !compact && (showAuthor ?? true) ? trip.author : undefined;
  const mainLabel =
    `${trip.title}. ${formatStopCount(trip.stopCount)}. Posted ${postedLabel(trip.createdAt)}.` +
    (trip.isPrivate ? ' Private trip.' : '');

  if (compact) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mainLabel}
        accessibilityHint="Opens trip details"
        onPress={onPress}
        style={({ pressed }) => [
          styles.compact,
          { backgroundColor: theme.surface, opacity: pressed ? 0.9 : 1 },
        ]}>
        <Cover
          uri={trip.coverUrl}
          cacheKey={trip.coverPath}
          style={styles.thumb}
          onError={onCoverError}
        />
        <View style={styles.compactBody}>
          <ThemedText type="subheading" numberOfLines={2}>
            {trip.title}
          </ThemedText>
          <MetaRow trip={trip} trailingBadge={false} />
          {trip.isPrivate ? (
            <View style={styles.badgeRow}>
              <PrivateBadge />
            </View>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {author ? (
        <Pressable
          disabled={!onPressAuthor}
          accessibilityRole={onPressAuthor ? 'button' : undefined}
          accessibilityLabel={`${author.displayName}, @${author.username}. View profile`}
          onPress={onPressAuthor}
          style={styles.authorRow}>
          <Avatar size="md" uri={author.avatarUrl} name={author.displayName} />
          <View style={styles.flex}>
            <ThemedText type="small" numberOfLines={1} style={styles.bold}>
              {author.displayName}
            </ThemedText>
            <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
              {`@${author.username}`}
            </ThemedText>
          </View>
        </Pressable>
      ) : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={mainLabel}
        accessibilityHint="Opens trip details"
        onPress={onPress}
        style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
        <Cover
          uri={trip.coverUrl}
          cacheKey={trip.coverPath}
          style={styles.cover}
          onError={onCoverError}
        />
        <View style={styles.body}>
          <ThemedText type="subheading" numberOfLines={2}>
            {trip.title}
          </ThemedText>
          <MetaRow trip={trip} trailingBadge />
        </View>
      </Pressable>
    </View>
  );
}

/** Mirrors the layout of TripCard so lists do not jump when data arrives. */
export function TripCardSkeleton({
  variant = 'feed',
  showAuthor,
}: {
  variant?: 'feed' | 'compact';
  showAuthor?: boolean;
}) {
  const theme = useTheme();
  if (variant === 'compact') {
    return (
      <View style={[styles.compact, { backgroundColor: theme.surface }]}>
        <Skeleton width={THUMB} height={THUMB} radius={Radius.md} />
        <View style={styles.compactBody}>
          <Skeleton shape="text" width="80%" />
          <Skeleton shape="text" width="50%" />
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      {(showAuthor ?? true) ? (
        <View style={styles.authorRow}>
          <Skeleton shape="circle" height={40} />
          <View style={styles.flex}>
            <Skeleton shape="text" width="40%" />
          </View>
        </View>
      ) : null}
      <View style={styles.cover}>
        <Skeleton height={400} radius={0} style={StyleSheet.absoluteFill} />
      </View>
      <View style={styles.body}>
        <Skeleton shape="text" width="70%" />
        <Skeleton shape="text" width="40%" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: FontFamily.semibold },
  card: { borderRadius: Radius.lg, overflow: 'hidden' },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 56,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  cover: { width: '100%', aspectRatio: 16 / 9, overflow: 'hidden' },
  body: { padding: Spacing.three, gap: Spacing.one },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  badgeRight: { marginLeft: 'auto' },
  badgeRow: { flexDirection: 'row' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
    borderRadius: Radius.full,
    borderWidth: 1,
  },
  compact: {
    flexDirection: 'row',
    gap: Spacing.three,
    padding: Spacing.two,
    minHeight: 104,
    borderRadius: Radius.lg,
  },
  thumb: { width: THUMB, height: THUMB, borderRadius: Radius.md, overflow: 'hidden' },
  compactBody: { flex: 1, gap: Spacing.one, justifyContent: 'center' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderIcon: { opacity: 0.6 },
});
