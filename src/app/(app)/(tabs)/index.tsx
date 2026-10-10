import { router, useScrollToTop } from 'expo-router';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { FlatList, RefreshControl, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, useReducedMotion } from 'react-native-reanimated';

import { Spinner } from '@/components/ui/spinner';
import { FeedHeader } from '@/components/feed/feed-header';
import { ThemedText } from '@/components/themed-text';
import { RepostCard } from '@/components/trip/repost-card';
import { TripShareSheet, type ShareTarget } from '@/components/trip/share-sheet';
import { TripCard, TripCardSkeleton } from '@/components/trip/trip-card';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Icon } from '@/components/ui/icon';
import { Screen } from '@/components/ui/screen';
import { SkeletonGroup } from '@/components/ui/skeleton';
import { Layout, Spacing } from '@/constants/theme';
import { useFeed, type FeedItem, type FeedRepostItem } from '@/hooks/use-feed';
import { useGreeting } from '@/hooks/use-greeting';
import { useTheme } from '@/hooks/use-theme';
import { confirmRemoveRepost } from '@/lib/repost-actions';
import { useSession } from '@/providers/session-provider';

const ANIMATED_CARDS = 4;

function Separator() {
  return <View style={styles.separator} />;
}

export default function FeedScreen() {
  const theme = useTheme();
  const feed = useFeed();
  const { profile } = useSession();
  const { greeting, refresh: refreshGreeting } = useGreeting();
  const reduceMotion = useReducedMotion();
  const [shareTarget, setShareTarget] = useState<ShareTarget | null>(null);
  const [menuRepost, setMenuRepost] = useState<FeedRepostItem | null>(null);
  // Re-tapping the active Feed tab scrolls back to the top.
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  // Entrance animation only for the first cards of the initial load, never for pages or refreshes.
  const introDone = useRef(false);
  useEffect(() => {
    if (feed.items.length > 0) introDone.current = true;
  }, [feed.items.length]);

  let emptyNode: ReactElement;
  if (feed.status === 'loading') {
    emptyNode = (
      <SkeletonGroup style={styles.skeletons}>
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
        <Spinner color="textMuted" />
      </View>
    );
  } else if (feed.loadMoreError) {
    footer = (
      <View style={styles.footerRow}>
        <ThemedText type="caption" themeColor="textMuted">
          Could not load more trips.
        </ThemedText>
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

  const openComments = (tripId: string) => router.push(`/trip/${tripId}/comments`);

  const renderFeedItem = (item: FeedItem) => {
    const trip = item.trip;
    const isOwner = !!profile && trip.ownerId === profile.id;
    const openShare = () => setShareTarget({ id: trip.id, title: trip.title, ownerId: trip.ownerId });
    if (item.kind === 'repost') {
      return (
        <RepostCard
          item={item}
          isMine={!!profile && item.reposter.id === profile.id}
          isTripOwner={isOwner}
          onOpenTrip={() => router.push(`/trip/${trip.id}`)}
          onOpenReposter={() => router.push(`/user/${item.reposter.username}`)}
          onOpenComments={() => openComments(trip.id)}
          onOpenShare={openShare}
          onOpenMenu={() => setMenuRepost(item)}
          onCoverError={feed.retryCover}
        />
      );
    }
    return (
      <TripCard
        trip={trip}
        variant="feed"
        showAuthor
        social={{ isOwner, onOpenComments: () => openComments(trip.id), onOpenShare: openShare }}
        onPress={() => router.push(`/trip/${trip.id}`)}
        onPressAuthor={() => trip.author && router.push(`/user/${trip.author.username}`)}
        onCoverError={feed.retryCover}
      />
    );
  };

  return (
    <Screen tabBarInset padded={false} keyboardAvoiding={false}>
      <FlatList
        ref={listRef}
        data={feed.items}
        keyExtractor={(item) => item.key}
        renderItem={({ item, index }) => (
          <Animated.View
            entering={
              !introDone.current && !reduceMotion && index < ANIMATED_CARDS
                ? FadeInDown.duration(250).delay(60 * index)
                : undefined
            }>
            {renderFeedItem(item)}
          </Animated.View>
        )}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={
          <View style={styles.headerBlock}>
            <FeedHeader greeting={greeting} profile={profile} />
            {feed.refreshError ? (
              <ErrorBanner message="Could not refresh the feed." style={styles.banner} />
            ) : null}
          </View>
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
            onRefresh={() => {
              refreshGreeting();
              void feed.refresh();
            }}
          />
        }
        initialNumToRender={4}
        windowSize={7}
        maxToRenderPerBatch={4}
      />
      <TripShareSheet target={shareTarget} onClose={() => setShareTarget(null)} />
      <BottomSheet
        visible={!!menuRepost}
        onClose={() => setMenuRepost(null)}
        title="Repost options"
        rows={[
          {
            key: 'remove',
            icon: 'repost',
            label: 'Remove repost',
            onPress: () => {
              const target = menuRepost;
              setMenuRepost(null);
              if (target && profile) {
                confirmRemoveRepost({
                  tripId: target.trip.id,
                  userId: profile.id,
                  repostId: target.repostId,
                });
              }
            },
          },
        ]}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerBlock: { gap: Spacing.three },
  content: {
    flexGrow: 1,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
  },
  separator: { height: Spacing.three },
  skeletons: { gap: Spacing.three },
  banner: {},
  footer: { padding: Spacing.three, alignItems: 'center' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
