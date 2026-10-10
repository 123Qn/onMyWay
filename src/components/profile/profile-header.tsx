import { Image } from "expo-image";
import { useRef, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useReducedMotion } from "react-native-reanimated";

import { StatsRow, type Stat } from "@/components/profile/stats-row";
import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { Gradient } from "@/components/ui/gradient";
import { Skeleton } from "@/components/ui/skeleton";
import {
  coverFallbackIndex,
  Gradients,
  Radius,
  shadow,
  Spacing,
} from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

const COVER_HEIGHT = 168;
const AVATAR = 112;

export type ProfileCover = { url: string | null; path: string };

export type ProfileHeaderProps = {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  /** Newest loaded trip cover; null falls back to a gradient seeded from the username. */
  cover?: ProfileCover | null;
  /** Called at most once per cover path when the image fails (parent re-signs the URL). */
  onCoverError?: (path: string) => void;
  stats: Stat[];
  /** Own-profile buttons; omitted on other profiles (phase 2: Follow / Message slot). */
  actions?: ReactNode;
};

/** Inset rounded cover: newest trip cover over a seeded gradient. Purely decorative. */
function Cover({
  username,
  cover,
  onError,
}: {
  username: string;
  cover?: ProfileCover | null;
  onError?: (path: string) => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const retriedRef = useRef<string | null>(null);
  const spec = Gradients.coverFallbacks[coverFallbackIndex(username)];
  return (
    <View
      style={[
        styles.coverShadow,
        shadow(theme, "sm"),
        { backgroundColor: theme.primarySoft },
      ]}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.coverClip}>
        <Gradient {...spec} style={StyleSheet.absoluteFill} />
        {cover?.url ? (
          <>
            <Image
              source={{ uri: cover.url, cacheKey: cover.path }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={reduceMotion ? 0 : 200}
              cachePolicy="memory-disk"
              accessible={false}
              onError={() => {
                if (retriedRef.current === cover.path) return;
                retriedRef.current = cover.path;
                onError?.(cover.path);
              }}
            />
            <Gradient {...Gradients.tileScrim} style={styles.coverScrim} />
          </>
        ) : null}
      </View>
    </View>
  );
}

export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  bio,
  cover,
  onCoverError,
  stats,
  actions,
}: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      <Cover username={username} cover={cover} onError={onCoverError} />
      <View style={styles.avatar}>
        <Avatar size="xxl" ring="surface" uri={avatarUrl} name={displayName} />
      </View>
      <View style={styles.identity}>
        <ThemedText
          type="title"
          accessibilityRole="header"
          style={styles.center}
        >
          {displayName}
        </ThemedText>
        <ThemedText themeColor="textMuted">{`@${username}`}</ThemedText>
        {bio ? (
          <ThemedText numberOfLines={3} style={[styles.center, styles.bio]}>
            {bio}
          </ThemedText>
        ) : null}
      </View>
      <StatsRow stats={stats} style={styles.stats} />
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

/** Loading placeholder mirroring the header layout (wrap in a SkeletonGroup). */
export function ProfileHeaderSkeleton() {
  return (
    <View style={styles.container}>
      <Skeleton height={COVER_HEIGHT} radius={Radius.xl} />
      <View style={styles.avatar}>
        <Skeleton shape="circle" height={AVATAR} />
      </View>
      <View style={styles.identity}>
        <Skeleton shape="text" width={180} />
        <Skeleton shape="text" width={110} />
      </View>
      <StatsRow
        style={styles.stats}
        stats={[
          { key: "trips", label: "Trips", value: null },
          { key: "stops", label: "Stops", value: null },
          { key: "photos", label: "Photos", value: null },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingTop: Spacing.two },
  coverShadow: { height: COVER_HEIGHT, borderRadius: Radius.xl },
  coverClip: { flex: 1, borderRadius: Radius.xl, overflow: "hidden" },
  coverScrim: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "60%",
    opacity: 0.3,
  },
  avatar: { alignSelf: "center", marginTop: -AVATAR / 2 },
  identity: { alignItems: "center", gap: Spacing.one, marginTop: Spacing.two },
  center: { textAlign: "center" },
  bio: { maxWidth: 480, marginTop: Spacing.one },
  stats: { marginTop: Spacing.two },
  actions: {
    flexDirection: "row",
    justifyContent: "center",
    gap: Spacing.two,
    marginBottom: Spacing.three,
  },
});
