import { Image } from "expo-image";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { SaveCircle, TripActionRail } from "@/components/social/trip-action-rail";
import { TripActionBar } from "@/components/social/trip-action-bar";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { Chip } from "@/components/ui/chip";
import { Gradient } from "@/components/ui/gradient";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import {
  coverFallbackIndex,
  Gradients,
  Layout,
  Radius,
  shadow,
  Spacing,
} from "@/constants/theme";
import { useHighContrast } from "@/hooks/use-high-contrast";
import { useTheme } from "@/hooks/use-theme";
import {
  formatDateLong,
  formatRelativeLong,
  formatRelativeShort,
} from "@/lib/format-date";

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

/** Social actions on a feed card. Omit for private trips (they have no social UI). */
export type TripCardSocial = {
  /** The viewer owns the trip: no Save. */
  isOwner: boolean;
  onOpenComments: () => void;
  onOpenShare: () => void;
};

export type TripCardProps = {
  trip: TripCardData;
  variant?: "feed" | "grid" | "embedded";
  /**
   * Defaults to true for the feed variant. The grid tile shows the author line only when this
   * is explicitly true; the embedded card always shows it.
   */
  showAuthor?: boolean;
  /** Feed variant only. */
  social?: TripCardSocial;
  /** Replaces the default screen reader label (repost and saved cards describe themselves). */
  accessibilityLabel?: string;
  onPress: () => void;
  onPressAuthor?: () => void;
  /** Called at most once per card when the cover fails to load (parent re-signs the URL). */
  onCoverError?: (coverPath: string) => void;
};

/** Font scale from which the feed card uses the stacked (no overlay) layout. */
const STACKED_FONT_SCALE = 1.5;

export function formatStopCount(n: number): string {
  if (n === 0) return "No stops";
  return n === 1 ? "1 stop" : `${n} stops`;
}

/** Long date for screen readers: relative when recent, otherwise "12 March 2025". */
function postedLabel(iso: string): string {
  return formatRelativeLong(iso) || formatDateLong(iso);
}

type FeedCardProps = {
  trip: TripCardData;
  author: TripCardData["author"];
  social?: TripCardSocial;
  label: string;
  onPress: () => void;
  onPressAuthor?: () => void;
  onCoverError?: (coverPath: string) => void;
};

/** Cover photo, or a seeded gradient with a map icon when there is none. */
function FeedMedia({
  trip,
  onCoverError,
}: Pick<FeedCardProps, "trip" | "onCoverError">) {
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
          <Icon
            name="map"
            size={Layout.iconSize.xl}
            color="onImage"
            style={styles.fallbackIcon}
          />
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
}: Pick<FeedCardProps, "trip" | "author" | "onPressAuthor"> & {
  onImage: boolean;
}) {
  if (!author) return null;
  return (
    <Pressable collapsable={false}
      disabled={!onPressAuthor}
      accessibilityRole={onPressAuthor ? "button" : undefined}
      accessibilityLabel={`${author.displayName}, @${author.username}. View profile`}
      onPress={onPressAuthor}
      style={styles.authorRow}
    >
      <Avatar
        size="sm"
        uri={author.avatarUrl}
        name={author.displayName}
        ring={onImage ? "image" : "none"}
      />
      <ThemedText
        type="small"
        themeColor={onImage ? "onImage" : "text"}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
        style={styles.authorName}
      >
        {author.displayName}
      </ThemedText>
      <ThemedText
        type="caption"
        themeColor={onImage ? "onImageMuted" : "textMuted"}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
      >
        {` · ${formatRelativeShort(trip.createdAt)}`}
      </ThemedText>
    </Pressable>
  );
}

const HIDDEN = {
  accessible: false,
  importantForAccessibility: "no-hide-descendants",
} as const;

/**
 * Hero card. Structure: the main button is a sibling UNDER the overlays; the media and text
 * layers are pointerEvents none so taps fall through to it, while the author row is its own
 * button. Title and meta are hidden from screen readers (the main label already has them).
 */
function FeedCard({
  trip,
  author,
  social,
  label,
  onPress,
  onPressAuthor,
  onCoverError,
}: FeedCardProps) {
  const theme = useTheme();
  const { fontScale, height: windowHeight } = useWindowDimensions();
  const [pressed, setPressed] = useState(false);
  const stacked = fontScale >= STACKED_FONT_SCALE;
  const highContrast = useHighContrast();
  const contrastBorder = highContrast
    ? { borderWidth: 1, borderColor: theme.borderStrong }
    : null;

  const mainButton = (
    <Pressable collapsable={false}
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
        collapsable={false}
        style={[
          styles.shadowWrap,
          shadow(theme, "md"),
          { backgroundColor: theme.surface },
          contrastBorder,
          pressStyle,
        ]}
      >
        <View style={styles.clip}>
          {mainButton}
          <View style={styles.stackedImage} pointerEvents="none" {...HIDDEN}>
            <FeedMedia trip={trip} onCoverError={onCoverError} />
          </View>
          {privateChip}
          <View style={styles.stackedBody} pointerEvents="box-none">
            <AuthorRow
              trip={trip}
              author={author}
              onPressAuthor={onPressAuthor}
              onImage={false}
            />
            <View pointerEvents="none" {...HIDDEN} style={styles.textBlock}>
              <ThemedText
                type="heading"
                numberOfLines={2}
                maxFontSizeMultiplier={1.3}
              >
                {trip.title}
              </ThemedText>
              <Chip icon="pin" label={formatStopCount(trip.stopCount)} />
            </View>
            {social ? (
              <TripActionBar
                tripId={trip.id}
                showSave={!social.isOwner}
                onOpenComments={social.onOpenComments}
                onOpenShare={social.onOpenShare}
              />
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View
      collapsable={false}
      style={[
        styles.shadowWrap,
        styles.heroRatio,
        shadow(theme, "md"),
        { backgroundColor: theme.primarySoft, maxHeight: windowHeight * 0.65 },
        contrastBorder,
        pressStyle,
      ]}
    >
      <View style={styles.clip}>
        {mainButton}
        <View style={StyleSheet.absoluteFill} pointerEvents="none" {...HIDDEN}>
          <FeedMedia trip={trip} onCoverError={onCoverError} />
          <Gradient {...Gradients.imageScrim} style={styles.scrim} />
        </View>
        {privateChip}
        <View
          style={[styles.heroBody, social && styles.heroBodySocial]}
          pointerEvents="box-none"
        >
          <AuthorRow
            trip={trip}
            author={author}
            onPressAuthor={onPressAuthor}
            onImage
          />
          <View pointerEvents="none" {...HIDDEN} style={styles.textBlock}>
            <ThemedText
              type="heading"
              themeColor="onImage"
              numberOfLines={2}
              maxFontSizeMultiplier={1.3}
            >
              {trip.title}
            </ThemedText>
            <Chip
              tone="onImage"
              icon="pin"
              label={formatStopCount(trip.stopCount)}
            />
          </View>
        </View>
        {social ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
            <TripActionRail
              tripId={trip.id}
              onOpenComments={social.onOpenComments}
              onOpenShare={social.onOpenShare}
            />
            {social.isOwner ? null : <SaveCircle tripId={trip.id} />}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** Profile grid tile (3:4). One button; the lock badge is described by the label. */
function GridTile({
  trip,
  label,
  showAuthor = false,
  onPress,
  onCoverError,
}: Pick<FeedCardProps, "trip" | "label" | "onPress" | "onCoverError"> & {
  showAuthor?: boolean;
}) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  return (
    <View
      style={[
        styles.tileShadow,
        shadow(theme, "sm"),
        { backgroundColor: theme.primarySoft },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.clip}>
        <Pressable collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Opens trip details"
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={StyleSheet.absoluteFill}
        />
        <View style={StyleSheet.absoluteFill} pointerEvents="none" {...HIDDEN}>
          <FeedMedia trip={trip} onCoverError={onCoverError} />
          <Gradient {...Gradients.tileScrim} style={styles.tileScrim} />
        </View>
        {trip.isPrivate ? (
          <View
            style={[styles.tileLock, { backgroundColor: theme.scrimChip }]}
            pointerEvents="none"
            {...HIDDEN}
          >
            <Icon name="lock" size={Layout.iconSize.sm} color="onImage" />
          </View>
        ) : null}
        <View style={styles.tileBody} pointerEvents="none" {...HIDDEN}>
          <ThemedText
            type="smallBold"
            themeColor="onImage"
            numberOfLines={2}
            maxFontSizeMultiplier={1.3}
          >
            {trip.title}
          </ThemedText>
          <View style={styles.tileMeta}>
            <Icon name="pin" size={12} color="onImageMuted" />
            <ThemedText
              type="caption"
              themeColor="onImageMuted"
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {showAuthor && trip.author
                ? `@${trip.author.username} · ${formatStopCount(trip.stopCount)}`
                : formatStopCount(trip.stopCount)}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
}

/** Original trip inside a repost: 4:3, rounded, hairline border. One button, no rail. */
function EmbeddedTile({
  trip,
  label,
  onPress,
  onCoverError,
}: Pick<FeedCardProps, "trip" | "label" | "onPress" | "onCoverError">) {
  const theme = useTheme();
  const [pressed, setPressed] = useState(false);
  return (
    <View
      collapsable={false}
      style={[
        styles.embedded,
        { backgroundColor: theme.primarySoft, borderColor: theme.border },
        pressed && styles.pressed,
      ]}
    >
      <Pressable
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityHint="Opens trip details"
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none" {...HIDDEN}>
        <FeedMedia trip={trip} onCoverError={onCoverError} />
        <Gradient {...Gradients.tileScrim} style={styles.tileScrim} />
      </View>
      <View style={styles.tileBody} pointerEvents="none" {...HIDDEN}>
        <ThemedText
          type="smallBold"
          themeColor="onImage"
          numberOfLines={2}
          maxFontSizeMultiplier={1.3}
        >
          {trip.title}
        </ThemedText>
        <ThemedText
          type="caption"
          themeColor="onImageMuted"
          numberOfLines={1}
          maxFontSizeMultiplier={1.3}
        >
          {trip.author
            ? `by @${trip.author.username} · ${formatStopCount(trip.stopCount)}`
            : formatStopCount(trip.stopCount)}
        </ThemedText>
      </View>
    </View>
  );
}

export function TripCard({
  trip,
  variant = "feed",
  showAuthor,
  social,
  accessibilityLabel,
  onPress,
  onPressAuthor,
  onCoverError,
}: TripCardProps) {
  const author = variant === "feed" && (showAuthor ?? true) ? trip.author : undefined;
  const mainLabel =
    accessibilityLabel ??
    `${trip.title}. ${formatStopCount(trip.stopCount)}. Posted ${postedLabel(trip.createdAt)}.` +
      (trip.isPrivate ? " Private trip." : "");

  if (variant === "grid") {
    return (
      <GridTile
        trip={trip}
        label={mainLabel}
        showAuthor={showAuthor === true}
        onPress={onPress}
        onCoverError={onCoverError}
      />
    );
  }

  if (variant === "embedded") {
    return (
      <EmbeddedTile
        trip={trip}
        label={mainLabel}
        onPress={onPress}
        onCoverError={onCoverError}
      />
    );
  }

  return (
    <FeedCard
      trip={trip}
      author={author}
      social={trip.isPrivate ? undefined : social}
      label={mainLabel}
      onPress={onPress}
      onPressAuthor={onPressAuthor}
      onCoverError={onCoverError}
    />
  );
}

/** Mirrors the layout of TripCard so lists do not jump when data arrives. */
export function TripCardSkeleton({
  variant = "feed",
  showAuthor,
}: {
  variant?: "feed" | "grid";
  showAuthor?: boolean;
}) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  if (variant === "grid") {
    return (
      <View style={[styles.tile, { backgroundColor: theme.skeleton }]}>
        <View style={styles.tileBody}>
          <Skeleton shape="text" width="80%" />
          <Skeleton shape="text" width="45%" />
        </View>
      </View>
    );
  }
  return (
    <View
      collapsable={false}
      style={[
        styles.shadowWrap,
        styles.heroRatio,
        { backgroundColor: theme.skeleton, maxHeight: windowHeight * 0.65 },
      ]}
    >
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
  heroRatio: { width: "100%", aspectRatio: 4 / 5 },
  clip: { borderRadius: Radius.xl, overflow: "hidden", flexGrow: 1 },
  pressed: { transform: [{ scale: 0.98 }], opacity: 0.95 },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "65%" },
  privateChip: {
    position: "absolute",
    top: Spacing.three,
    left: Spacing.three,
  },
  heroBodySocial: { paddingRight: 64 },
  heroBody: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "40%",
    padding: Spacing.three,
    gap: Spacing.two,
    justifyContent: "flex-end",
  },
  embedded: {
    width: "100%",
    aspectRatio: 4 / 3,
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: "hidden",
    justifyContent: "flex-end",
  },
  stackedImage: { width: "100%", aspectRatio: 4 / 3, overflow: "hidden" },
  stackedBody: { padding: Spacing.three, gap: Spacing.two },
  textBlock: { gap: Spacing.two },
  authorName: { flexShrink: 1 },
  authorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    minHeight: Layout.minTouchTarget,
  },
  fallbackIcon: { opacity: 0.9 },
  tile: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: Radius.lg,
    overflow: "hidden",
  },
  tileShadow: { flex: 1, aspectRatio: 3 / 4, borderRadius: Radius.lg },
  tileScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
  },
  tileBody: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: Spacing.three - Spacing.one,
    gap: Spacing.one,
  },
  tileMeta: { flexDirection: "row", alignItems: "center", gap: Spacing.one },
  tileLock: {
    position: "absolute",
    top: Spacing.two,
    left: Spacing.two,
    width: 28,
    height: 28,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholder: { flex: 1, alignItems: "center", justifyContent: "center" },
});
