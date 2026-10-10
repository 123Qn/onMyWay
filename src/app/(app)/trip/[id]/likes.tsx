import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { useTripLikes, type Liker } from '@/hooks/use-trip-likes';
import { useTripSocialInfo } from '@/hooks/use-trip-social-info';
import { useTheme } from '@/hooks/use-theme';
import { pluralize } from '@/lib/format-count';
import { useTripSocial } from '@/lib/social-store';

const EDGES = ['left', 'right', 'bottom'] as const;
const ROW_SKELETONS = [0, 1, 2, 3, 4, 5];

function LikerRow({ liker }: { liker: Liker }) {
  const theme = useTheme();
  return (
    <Pressable
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={`${liker.displayName}, @${liker.username}`}
      onPress={() => router.push(`/user/${liker.username}`)}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.surfaceMuted }]}>
      <Avatar size="md" uri={liker.avatarUrl} name={liker.displayName} />
      <View style={styles.names}>
        <ThemedText type="smallBold" numberOfLines={1}>
          {liker.displayName}
        </ThemedText>
        <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
          {`@${liker.username}`}
        </ThemedText>
      </View>
    </Pressable>
  );
}

export default function TripLikesScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id ?? '');
  const theme = useTheme();
  const likes = useTripLikes(id);
  const info = useTripSocialInfo(id);
  const social = useTripSocial(id);

  if (info.status === 'unavailable') {
    return (
      <Screen edges={[...EDGES]} centered>
        <EmptyState
          icon="lock"
          title="Trip unavailable"
          message="This trip doesn't exist, was removed, or is private."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  let emptyNode;
  if (likes.status === 'loading') {
    emptyNode = (
      <SkeletonGroup>
        {ROW_SKELETONS.map((i) => (
          <View key={i} style={styles.row}>
            <Skeleton shape="circle" height={40} />
            <View style={styles.names}>
              <Skeleton shape="text" width="45%" />
              <Skeleton shape="text" width="30%" />
            </View>
          </View>
        ))}
      </SkeletonGroup>
    );
  } else if (likes.status === 'error') {
    emptyNode = (
      <ErrorBanner message="Couldn't load likes." onRetry={likes.retry} style={styles.banner} />
    );
  } else {
    emptyNode = (
      <EmptyState
        icon="heart"
        title="No likes yet"
        message="Be the first to like this trip."
        actionLabel={social.liked ? undefined : 'Like this trip'}
        onAction={social.liked ? undefined : social.toggleLike}
      />
    );
  }

  let footer = null;
  if (likes.loadingMore) {
    footer = (
      <View style={styles.footer} accessible accessibilityLabel="Loading more">
        <ActivityIndicator color={theme.textMuted} />
      </View>
    );
  } else if (likes.loadMoreError) {
    footer = (
      <View style={styles.footerRow}>
        <ThemedText type="caption" themeColor="textMuted">
          Couldn&apos;t load more likes.
        </ThemedText>
        <Button title="Retry" variant="ghost" size="sm" onPress={likes.retryLoadMore} />
      </View>
    );
  }

  return (
    <Screen edges={[...EDGES]} padded={false} keyboardAvoiding={false}>
      <FlatList
        data={likes.items}
        keyExtractor={(item) => item.userId}
        renderItem={({ item }) => <LikerRow liker={item} />}
        ListHeaderComponent={
          <View collapsable={false} style={styles.header}>
            <ThemedText type="caption" themeColor="textMuted">
              {pluralize(social.likeCount, 'like')}
            </ThemedText>
          </View>
        }
        ListEmptyComponent={emptyNode}
        ListFooterComponent={footer}
        contentContainerStyle={styles.content}
        onEndReachedThreshold={0.5}
        onEndReached={likes.loadMore}
        refreshControl={
          <RefreshControl
            refreshing={likes.refreshing}
            tintColor={theme.primary}
            colors={[theme.primary]}
            onRefresh={likes.refresh}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { paddingHorizontal: Spacing.three, paddingVertical: Spacing.two },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three - Spacing.one,
  },
  names: { flex: 1, minWidth: 0, gap: Spacing.half },
  banner: { margin: Spacing.three },
  footer: { padding: Spacing.three, alignItems: 'center' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
