import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Chip } from '@/components/ui/chip';
import { Gradient } from '@/components/ui/gradient';
import { Icon } from '@/components/ui/icon';
import { Skeleton } from '@/components/ui/skeleton';
import {
  coverFallbackIndex,
  Gradients,
  Layout,
  Radius,
  shadow,
  Spacing,
} from '@/constants/theme';
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
/** Font scale from which the feed card uses the stacked (no overlay) layout. */
const STACKED_FONT_SCALE = 1.5;

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

/** Compact (profile list) thumbnail. */
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

function MetaRow({ trip }: { trip: TripCardData }) {
  return (
    <View style={styles.metaRow}>
      <Icon name="map" size={Layout.iconSize.sm} color="textMuted" />
      <ThemedText type="caption" themeColor="textMuted">
        {`${formatStopCount(trip.stopCount)} · ${formatRelativeShort(trip.createdAt)}`}
      </ThemedText>
    </View>
  );
}

type FeedCardProps = {
  trip: TripCardData;
  author: TripCardData['author'];
  label: string;
  onPress: () => void;
  onPressAuthor?: () => void;
  onCoverError?: (coverPath: string) => void;
};

/** Cover photo, or a seeded gradient with a map icon when there is none. */
function FeedMedia({ trip, onCoverError }: Pick<FeedCardProps, 'trip' | 'onCoverError'>) {
  const reduceMotion = useReducedMotion();
  const retriedRef = useRef(false);
  const spec = Gradients.coverFallbacks[coverFallbackIndex(trip.id)];
  const cacheKey = trip.coverPath;
  return (
    <>
      <Gradient {...spec} style={StyleSheet.absoluteFill} />
      {trip.coverUrl ? (
        <Image
          source={{ uri: trip.coverUrl, cacheKey: cacheKey ?? undefined }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={reduceMotion ? 0 : 200}
          cachePolicy="memory-disk"
          accessible={false}
          onError={() => {
            if (!cacheKey || retriedRef.current) return;
            retriedRef.current = true;
            onCoverError?.(cacheKey);
          }}
        />
      ) : (
        <View style={styles.placeholder}>
          <Icon name="map" size={Layout.iconSize.xl} color="onImage" style={styles.fallbackIcon} />
        </View>
      )}
    </>
  );
}

function AuthorRow({
  trip,
  author,
  onPressAuthor,
  onImage,
}: Pick<FeedCardProps, 'trip' | 'author' | 'onPressAuthor'> & { onImage: boolean }) {
  if (!author) return null;
  return (
    <Pressable
      disabled={!onPressAuthor}
      accessibilityRole={onPressAuthor ? 'button' : undefined}
      accessibilityLabel={`${author.displayName}, @${author.username}. View profile`}
      onPress={onPressAuthor}
      style={styles.authorRow}>
      <Avatar
        size="sm"
        uri={author.avatarUrl}
        name={author.displayName}
        ring={onImage ? 'image' : 'none'}
      />
      <ThemedText
        type="small"
        themeColor={onImage ? 'onImage' : 'text'}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
        style={styles.authorName}>
        {author.displayName}
      </ThemedText>
      <ThemedText
        type="caption"
        themeColor={onImage ? 'onImageMuted' : 'textMuted'}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}>
        {` · ${formatRelativeShort(trip.createdAt)}`}
      </ThemedText>
    </Pressable>
  );
}

const HIDDEN = { accessible: false, importantForAccessibility: 'no-hide-descendants' } as const;

/**
 * Hero card. Structure: the main button is a sibling UNDER the overlays; the media and text
 * layers are pointerEvents none so taps fall through to it, while the author row is its own
 * button. Title and meta are hidden from screen readers (the main label already has them).
 */
function FeedCard({ trip, author, label, onPress, onPressAuthor, onCoverError }: FeedCardProps) {
  const theme = useTheme();
  const { fontScale, height: windowHeight } = useWindowDimensions();
  const [pressed, setPressed] = useState(false);
  const stacked = fontScale >= STACKED_FONT_SCALE;

  const mainButton = (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Opens trip details"
      onPress={onPress}
      onPressIn={() => setPressed(true)}
      onPressOut={() => setPressed(false)}
      style={StyleSheet.absoluteFill}
    />
  );
  const privateChip = trip.isPrivate ? (
    <View style={styles.privateChip} pointerEvents="none" {...HIDDEN}>
      <Chip tone="onImage" icon="lock" label="Private" />
    </View>
  ) : null;
  const pressStyle = pressed ? styles.pressed : null;

  if (stacked) {
    return (
      <View
        style={[
          styles.shadowWrap,
          shadow(theme, 'md'),
          { backgroundColor: theme.surface },
          pressStyle,
        ]}>
        <View style={styles.clip}>
          {mainButton}
          <View style={styles.stackedImage} pointerEvents="none" {...HIDDEN}>
            <FeedMedia trip={trip} onCoverError={onCoverError} />
          </View>
          {privateChip}
          <View style={styles.stackedBody} pointerEvents="box-none">
            <AuthorRow trip={trip} author={author} onPressAuthor={onPressAuthor} onImage={false} />
            <View pointerEvents="none" {...HIDDEN} style={styles.textBlock}>
              <ThemedText type="heading" numberOfLines={2} maxFontSizeMultiplier={1.3}>
                {trip.title}
              </ThemedText>
              <Chip icon="pin" label={formatStopCount(trip.stopCount)} />
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.shadowWrap,
        styles.heroRatio,
        shadow(theme, 'md'),
        { backgroundColor: theme.primarySoft, maxHeight: windowHeight * 0.65 },
        pressStyle,
      ]}>
      <View style={styles.clip}>
        {mainButton}
        <View style={StyleSheet.absoluteFill} pointerEvents="none" {...HIDDEN}>
          <FeedMedia trip={trip} onCoverError={onCoverError} />
          <Gradient {...Gradients.imageScrim} style={styles.scrim} />
        </View>
        {privateChip}
        <View style={styles.heroBody} pointerEvents="box-none">
          <AuthorRow trip={trip} author={author} onPressAuthor={onPressAuthor} onImage />
          <View pointerEvents="none" {...HIDDEN} style={styles.textBlock}>
            <ThemedText
              type="heading"
              themeColor="onImage"
              numberOfLines={2}
              maxFontSizeMultiplier={1.3}>
              {trip.title}
            </ThemedText>
            <Chip tone="onImage" icon="pin" label={formatStopCount(trip.stopCount)} />
          </View>
        </View>
      </View>
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

  if (!compact) {
    return (
      <FeedCard
        trip={trip}
        author={author}
        label={mainLabel}
        onPress={onPress}
        onPressAuthor={onPressAuthor}
        onCoverError={onCoverError}
      />
    );
  }

  // Compact stays for the profile lists until step 6 replaces it with the grid tile.
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
        <MetaRow trip={trip} />
        {trip.isPrivate ? (
          <View style={styles.badgeRow}>
            <PrivateBadge />
          </View>
        ) : null}
      </View>
    </Pressable>
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
  const { height: windowHeight } = useWindowDimensions();
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
    <View
      style={[
        styles.shadowWrap,
        styles.heroRatio,
        { backgroundColor: theme.skeleton, maxHeight: windowHeight * 0.65 },
      ]}>
      <View style={styles.clip}>
        <Skeleton height={800} radius={0} style={StyleSheet.absoluteFill} />
        <View style={styles.heroBody}>
          {(showAuthor ?? true) ? (
            <View style={styles.authorRow}>
              <Skeleton shape="circle" height={32} />
              <Skeleton shape="text" width="40%" />
            </View>
          ) : null}
          <Skeleton shape="text" width="70%" />
          <Skeleton shape="text" width="40%" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: { borderRadius: Radius.xl },
  heroRatio: { width: '100%', aspectRatio: 4 / 5 },
  clip: { borderRadius: Radius.xl, overflow: 'hidden', flexGrow: 1 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '65%' },
  privateChip: { position: 'absolute', top: Spacing.three, left: Spacing.three },
  heroBody: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '40%',
    padding: Spacing.three,
    gap: Spacing.two,
    justifyContent: 'flex-end',
  },
  stackedImage: { width: '100%', aspectRatio: 4 / 3, overflow: 'hidden' },
  stackedBody: { padding: Spacing.three, gap: Spacing.two },
  textBlock: { gap: Spacing.two },
  authorName: { flexShrink: 1 },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: Layout.minTouchTarget,
  },
  fallbackIcon: { opacity: 0.9 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
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
