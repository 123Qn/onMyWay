import { useCallback, useRef, useState, type ReactElement, type ReactNode } from "react";
import { router, useScrollToTop } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  useWindowDimensions,
  View,
} from "react-native";

import { TripCard, TripCardSkeleton } from "@/components/trip/trip-card";
import { ThemedText } from "@/components/themed-text";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SkeletonGroup } from "@/components/ui/skeleton";
import { UnderlineTabs } from "@/components/ui/underline-tabs";
import { Layout, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import type { ProfileTrips } from "@/hooks/use-profile-trips";
import type { SavedTrips } from "@/hooks/use-saved-trips";

export type ProfileTab = "trips" | "saved";

const TRIPS_ONLY = [{ key: "trips", label: "Trips" }];
const WITH_SAVED = [
  { key: "trips", label: "Trips" },
  { key: "saved", label: "Saved" },
];
const noop = () => {};
const SAVED_ERROR = "Couldn't load your saved trips.";
const SAVED_NOTE = "Only you can see what you've saved.";

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
  /**
   * Own profile only: adds the private "Saved" tab. The same list serves both tabs (same
   * columns, same component); only data, empty/loading states and the footer change.
   */
  saved?: SavedTrips;
  tab?: ProfileTab;
  onTabChange?: (tab: ProfileTab) => void;
};

export function ProfileTripList({
  trips,
  header,
  empty,
  loadError,
  refreshError,
  onPressTrip,
  onRefresh,
  saved,
  tab = "trips",
  onTabChange,
}: Props) {
  const theme = useTheme();
  const showSaved = !!saved && tab === "saved";
  // Both ProfileTrips and SavedTrips fit the list; the total count is not used here.
  const source: Omit<ProfileTrips, "count"> = showSaved && saved ? saved : trips;
  const offsets = useRef<Record<ProfileTab, number>>({ trips: 0, saved: 0 });
  // Re-tapping the active Profile tab scrolls back to the top.
  const listRef = useRef<FlatList>(null);
  useScrollToTop(listRef);
  const window = useWindowDimensions();
  const [listWidth, setListWidth] = useState(window.width);
  // Fixed tile width so a lone last tile keeps the size of the others.
  const tileWidth = Math.max(
    0,
    (listWidth - Layout.screenPadding * 2 - Layout.gridGap) / 2,
  );

  const changeTab = useCallback(
    (key: string) => {
      if (!onTabChange || (key !== "trips" && key !== "saved") || key === tab) return;
      onTabChange(key);
      // Each tab remembers its own scroll position.
      const offset = offsets.current[key];
      setTimeout(() => listRef.current?.scrollToOffset({ offset, animated: false }), 0);
    },
    [onTabChange, tab],
  );

  let emptyNode: ReactElement | null = null;
  if (source.status === "loading") {
    emptyNode = (
      <SkeletonGroup style={styles.skeletons}>
        <View style={styles.row}>
          <TripCardSkeleton variant="grid" />
          <TripCardSkeleton variant="grid" />
        </View>
        <View style={styles.row}>
          <TripCardSkeleton variant="grid" />
          <TripCardSkeleton variant="grid" />
        </View>
      </SkeletonGroup>
    );
  } else if (source.status === "error") {
    emptyNode = (
      <ErrorBanner
        message={showSaved ? SAVED_ERROR : loadError}
        onRetry={source.retry}
      />
    );
  } else if (showSaved) {
    emptyNode = (
      <EmptyState
        icon="bookmark"
        title="Nothing saved yet"
        message="Tap the bookmark on a trip to keep it here."
        actionLabel="Browse the feed"
        onAction={() => router.navigate("/")}
      />
    );
  } else {
    emptyNode = empty;
  }

  const footer = source.loadingMore ? (
    <View
      style={styles.footer}
      accessible
      accessibilityLabel="Loading more trips"
    >
      <ActivityIndicator color={theme.textMuted} />
    </View>
  ) : source.loadMoreError ? (
    <View style={styles.footerRow}>
      <ThemedText themeColor="textMuted">Could not load more trips.</ThemedText>
      <Button
        title="Retry"
        variant="ghost"
        size="sm"
        onPress={source.retryLoadMore}
      />
    </View>
  ) : null;

  return (
    <FlatList
      ref={listRef}
      data={source.items}
      keyExtractor={(item) => item.id}
      onLayout={(e) => setListWidth(e.nativeEvent.layout.width)}
      numColumns={2}
      columnWrapperStyle={styles.row}
      onScroll={(e) => {
        offsets.current[tab] = e.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={100}
      renderItem={({ item }) => (
        <View style={{ width: tileWidth }}>
          <TripCard
            trip={item}
            variant="grid"
            showAuthor={showSaved}
            accessibilityLabel={
              showSaved
                ? `Saved trip: ${item.title}, by ${item.author?.displayName ?? "unknown"}. ${item.stopCount} stops.`
                : undefined
            }
            onPress={() => onPressTrip(item.id)}
            onCoverError={source.retryCover}
          />
        </View>
      )}
      ItemSeparatorComponent={Separator}
      ListHeaderComponent={
        <View>
          {header}
          {source.refreshError ? (
            <ErrorBanner
              message={showSaved ? SAVED_ERROR : refreshError}
              style={styles.banner}
            />
          ) : null}
          <UnderlineTabs
            tabs={saved ? WITH_SAVED : TRIPS_ONLY}
            value={tab}
            onChange={saved ? changeTab : noop}
            style={styles.tabs}
          />
          {saved ? (
            <View
              collapsable={false}
              style={[styles.note, !showSaved && styles.noteHidden]}
              accessible={showSaved}
              accessibilityLiveRegion="polite"
            >
              <Icon name="lock" size={14} color="textMuted" />
              <ThemedText type="caption" themeColor="textMuted">
                {SAVED_NOTE}
              </ThemedText>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={emptyNode}
      ListFooterComponent={footer}
      contentContainerStyle={styles.content}
      onEndReachedThreshold={0.5}
      onEndReached={source.loadMore}
      refreshControl={
        <RefreshControl
          refreshing={source.refreshing}
          tintColor={theme.primary}
          colors={[theme.primary]}
          onRefresh={() => {
            source.refresh();
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
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  separator: { height: Layout.gridGap },
  row: { flexDirection: "row", gap: Layout.gridGap },
  tabs: { marginBottom: Layout.gridGap },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingBottom: Layout.gridGap,
  },
  noteHidden: { display: "none" },
  skeletons: { gap: Layout.gridGap },
  banner: { marginTop: Spacing.two, marginBottom: Spacing.two },
  footer: { padding: Spacing.three, alignItems: "center" },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
