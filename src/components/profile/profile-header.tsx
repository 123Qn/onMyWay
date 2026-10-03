import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { FontFamily, Spacing } from '@/constants/theme';

export type ProfileHeaderProps = {
  displayName: string;
  username: string;
  avatarUrl?: string | null;
  bio?: string | null;
  /** Null shows a skeleton line while the count loads. */
  tripCount?: number | null;
  actions?: ReactNode;
};

export function ProfileHeader({
  displayName,
  username,
  avatarUrl,
  bio,
  tripCount = null,
  actions,
}: ProfileHeaderProps) {
  return (
    <View style={styles.container}>
      <Avatar size="xl" uri={avatarUrl} name={displayName} />
      <ThemedText type="title" accessibilityRole="header" style={styles.center}>
        {displayName}
      </ThemedText>
      <ThemedText themeColor="textMuted">{`@${username}`}</ThemedText>
      {bio ? <ThemedText style={[styles.center, styles.bio]}>{bio}</ThemedText> : null}
      {tripCount === null ? (
        <Skeleton shape="text" width={64} />
      ) : (
        <ThemedText type="small" style={styles.stat}>
          {tripCount === 1 ? '1 trip' : `${tripCount} trips`}
        </ThemedText>
      )}
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

/** Loading placeholder mirroring the header layout (wrap in a SkeletonGroup). */
export function ProfileHeaderSkeleton() {
  return (
    <View style={styles.container}>
      <Skeleton shape="circle" height={96} />
      <Skeleton shape="text" width={180} />
      <Skeleton shape="text" width={110} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.two, padding: Spacing.three },
  center: { textAlign: 'center' },
  bio: { maxWidth: 480 },
  stat: { fontFamily: FontFamily.semibold },
  actions: { flexDirection: 'row', gap: Spacing.two, alignSelf: 'stretch' },
});
