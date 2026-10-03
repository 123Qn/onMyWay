import { router } from 'expo-router';
import type { ReactElement } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { TripCard, TripCardSkeleton } from '@/components/trip/trip-card';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { SkeletonGroup } from '@/components/ui/skeleton';
import { Layout, Spacing } from '@/constants/theme';
import { useFeed } from '@/hooks/use-feed';
import { useTheme } from '@/hooks/use-theme';

function Separator() {
  return <View style={styles.separator} />;
}

export default function FeedScreen() {
  const theme = useTheme();
  const feed = useFeed();

  let emptyNode: ReactElement;
  if (feed.status === 'loading') {
    emptyNode = (
      <SkeletonGroup style={styles.skeletons}>
        <TripCardSkeleton variant="feed" />
        <TripCardSkeleton variant="feed" />
        <TripCardSkeleton variant="feed" />
      </SkeletonGroup>
    );
  } else if (feed.status === 'error') {
    emptyNode = <ErrorBanner message="Could not load the feed." onRetry={feed.retry} />;
  } else {
    emptyNode = (
      <EmptyState
        icon="map"
        title="No trips yet"
        message="Be the first to share a journey."
        actionLabel="Create your first trip"
        onAction={() => router.push('/trip/new')}
      />
    );
  }

  let footer: ReactElement | null = null;
  if (feed.loadingMore) {
    footer = (
      <View style={styles.footer} accessible accessibilityLabel="Loading more trips">
        <ActivityIndicator color={theme.textMuted} />
      </View>
    );
  } else if (feed.loadMoreError) {
    footer = (
      <View style={styles.footerRow}>
        <ThemedText themeColor="textMuted">Could not load more trips.</ThemedText>
        <Button title="Retry" variant="ghost" size="sm" onPress={feed.retryLoadMore} />
      </View>
    );
  } else if (!feed.hasMore && feed.items.length >= 1) {
    footer = (
      <View style={styles.footerRow}>
        <Icon name="check" size={Layout.iconSize.sm} color="textMuted" />
        <ThemedText type="caption" themeColor="textMuted">
          You&apos;re all caught up
        </ThemedText>
      </View>
    );
  }

  return (
    <Screen tabBarInset padded={false} keyboardAvoiding={false}>
      <View style={styles.header}>
        <ThemedText type="title" accessibilityRole="header">
          Feed
        </ThemedText>
        <IconButton
          icon="plus"
          variant="filled"
          accessibilityLabel="Create trip"
          onPress={() => router.push('/trip/new')}
        />
      </View>
      <FlatList
        data={feed.items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TripCard
            trip={item}
            variant="feed"
            showAuthor
            onPress={() => router.push(`/trip/${item.id}`)}
            onPressAuthor={() => item.author && router.push(`/user/${item.author.username}`)}
            onCoverError={feed.retryCover}
          />
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          feed.refreshError ? (
            <ErrorBanner message="Could not refresh the feed." style={styles.banner} />
          ) : null
        }
        ListEmptyComponent={emptyNode}
        ListFooterComponent={footer}
        contentContainerStyle={styles.content}
        onEndReachedThreshold={0.5}
        onEndReached={feed.loadMore}
        refreshControl={
          <RefreshControl
            refreshing={feed.refreshing}
            tintColor={theme.primary}
            colors={[theme.primary]}
            onRefresh={feed.refresh}
          />
        }
        initialNumToRender={4}
        windowSize={7}
        maxToRenderPerBatch={4}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
  },
  content: { flexGrow: 1, padding: Spacing.three, paddingTop: 0 },
  separator: { height: Spacing.three },
  skeletons: { gap: Spacing.three },
  banner: { marginBottom: Spacing.three },
  footer: { padding: Spacing.three, alignItems: 'center' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
