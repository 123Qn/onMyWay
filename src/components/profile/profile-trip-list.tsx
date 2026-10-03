import type { ReactElement, ReactNode } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { TripCard, TripCardSkeleton } from '@/components/trip/trip-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { SkeletonGroup } from '@/components/ui/skeleton';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ProfileTrips } from '@/hooks/use-profile-trips';

type Props = {
  trips: ProfileTrips;
  /** Rendered above the list (usually the ProfileHeader). */
  header: ReactNode;
  /** Shown when the user has no trips. */
  empty: ReactElement;
  loadError: string;
  refreshError: string;
  onPressTrip: (id: string) => void;
  /** Extra work on pull-to-refresh (e.g. refreshing the own profile). */
  onRefresh?: () => Promise<unknown>;
};

export function ProfileTripList({
  trips,
  header,
  empty,
  loadError,
  refreshError,
  onPressTrip,
  onRefresh,
}: Props) {
  const theme = useTheme();

  let emptyNode: ReactElement | null = null;
  if (trips.status === 'loading') {
    emptyNode = (
      <SkeletonGroup style={styles.skeletons}>
        <TripCardSkeleton variant="compact" />
        <TripCardSkeleton variant="compact" />
        <TripCardSkeleton variant="compact" />
      </SkeletonGroup>
    );
  } else if (trips.status === 'error') {
    emptyNode = <ErrorBanner message={loadError} onRetry={trips.retry} />;
  } else {
    emptyNode = empty;
  }

  const footer = trips.loadingMore ? (
    <View style={styles.footer} accessible accessibilityLabel="Loading more trips">
      <ActivityIndicator color={theme.textMuted} />
    </View>
  ) : trips.loadMoreError ? (
    <View style={styles.footerRow}>
      <ThemedText themeColor="textMuted">Could not load more trips.</ThemedText>
      <Button title="Retry" variant="ghost" size="sm" onPress={trips.retryLoadMore} />
    </View>
  ) : null;

  return (
    <FlatList
      data={trips.items}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <TripCard
          trip={item}
          variant="compact"
          onPress={() => onPressTrip(item.id)}
          onCoverError={trips.retryCover}
        />
      )}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={
        <View>
          {header}
          {trips.refreshError ? (
            <ErrorBanner message={refreshError} style={styles.banner} />
          ) : null}
        </View>
      }
      ListEmptyComponent={emptyNode}
      ListFooterComponent={footer}
      contentContainerStyle={styles.content}
      onEndReachedThreshold={0.5}
      onEndReached={trips.loadMore}
      refreshControl={
        <RefreshControl
          refreshing={trips.refreshing}
          tintColor={theme.primary}
          colors={[theme.primary]}
          onRefresh={() => {
            trips.refresh();
            onRefresh?.();
          }}
        />
      }
      initialNumToRender={6}
      windowSize={7}
    />
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: Spacing.three, paddingBottom: Spacing.three },
  separator: { height: Spacing.two },
  skeletons: { gap: Spacing.two },
  banner: { marginTop: Spacing.two, marginBottom: Spacing.two },
  footer: { padding: Spacing.three, alignItems: 'center' },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
