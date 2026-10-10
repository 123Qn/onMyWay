import { Image } from 'expo-image';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  BackHandler,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import type { Edge } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { FollowTripButton } from '@/components/trip/follow-trip-button';
import { CollapsibleText } from '@/components/trip/collapsible-text';
import { StopListItem } from '@/components/trip/stop-list-item';
import { TripPhotoStrip } from '@/components/trip/photo-strip';
import { RouteNotice } from '@/components/trip/route-notice';
import { TripShareSheet } from '@/components/trip/share-sheet';
import { DoubleTapLike } from '@/components/social/double-tap-like';
import { TripActionBar } from '@/components/social/trip-action-bar';
import { SaveCircle } from '@/components/social/trip-action-rail';
import { TripMap, type TripMapHandle } from '@/components/trip/trip-map';
import { Avatar } from '@/components/ui/avatar';
import { Gradient } from '@/components/ui/gradient';
import { Chip } from '@/components/ui/chip';
import { InfoTile } from '@/components/ui/info-tile';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { Gradients, Layout, Radius, Spacing, coverFallbackIndex, shadow } from '@/constants/theme';
import { useSignedUrls } from '@/hooks/use-signed-urls';
import { useTheme } from '@/hooks/use-theme';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { useTrip, type TripDetail } from '@/hooks/use-trip';
import { useTripSocialInfo } from '@/hooks/use-trip-social-info';
import { getAvatarUrl } from '@/lib/avatar-url';
import { formatDateLong, formatDateShort } from '@/lib/format-date';
import { durationA11yLabel, formatDuration } from '@/lib/format-duration';
import {
  distanceA11yLabel,
  formatDistance,
  roadDistanceA11yLabel,
  routeDistanceKm,
} from '@/lib/geo';
import { decodePolyline } from '@/lib/polyline';
import type { TravelMode } from '@/lib/trip-form';

const MODE_ICON = { driving: 'car', walking: 'walk', cycling: 'bike' } as const;

const ROUTE_CAPTION: Record<TravelMode, string> = {
  driving: 'Route along roads for driving.',
  walking: 'Route along paths and roads for walking.',
  cycling: 'Route along roads and bike paths for cycling.',
};

const EDGES: Edge[] = ['left', 'right'];
const DEFAULT_BAR_HEIGHT = 96;

function stopCountLabel(n: number): string {
  return n === 1 ? '1 stop' : `${n} stops`;
}

export default function TripDetailScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const id = String(params.id ?? '');
  const theme = useTheme();
  const stackOptions = useStackScreenOptions();
  const reduceMotion = useReducedMotion();
  const { height: windowHeight } = useWindowDimensions();
  const {
    trip,
    status,
    isOwner,
    refreshing,
    refreshError,
    refresh,
    retry,
    refreshRoute,
    setVisibility,
    remove,
  } = useTrip(id);

  // One get_trip_social call: seeds the social store and tells whether Repost is allowed.
  const social = useTripSocialInfo(id);
  const [shareOpen, setShareOpen] = useState(false);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [barHeight, setBarHeight] = useState(DEFAULT_BAR_HEIGHT);
  const [menuBusy, setMenuBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [openError, setOpenError] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const mapRef = useRef<TripMapHandle>(null);
  const routeY = useRef(0);
  const stopsSectionY = useRef(0);
  const stopsListY = useRef(0);
  const cardY = useRef(new Map<string, number>());
  const coverRetried = useRef(false);

  // One batched signing request for the cover and every stop photo (max 1 + 20 x 5 paths).
  const paths = useMemo(
    () => [
      trip?.coverPath ?? null,
      ...(trip?.stops.flatMap((s) => s.photos.map((p) => p.storagePath)) ?? []),
    ],
    [trip],
  );
  const { urls, retry: retryUrl } = useSignedUrls(paths);

  const mapStops = useMemo(
    () =>
      (trip?.stops ?? []).map((s, i) => ({
        id: s.id,
        number: i + 1,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
      })),
    [trip],
  );

  // Decoded once per stored route (never per render). Null = draw dashed straight lines.
  const roadRoute = useMemo(() => {
    const route = trip?.route;
    if (!route || route.status !== 'ok' || !route.polyline) return null;
    const points = decodePolyline(route.polyline);
    return points.length >= 2 ? points : null;
  }, [trip?.route]);

  // Block Android back while the delete is running.
  useEffect(() => {
    if (!deleting) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [deleting]);

  const mapHeight = Math.max(220, Math.min(320, windowHeight * 0.4));

  const handleSelectFromMap = (stopId: string | null) => {
    setSelectedStopId(stopId);
    if (!stopId) return;
    const y = cardY.current.get(stopId);
    if (y !== undefined) {
      scrollRef.current?.scrollTo({ y: Math.max(0, stopsSectionY.current + stopsListY.current + y - Spacing.three), animated: true });
    }
  };

  const handleSelectFromList = (stopId: string) => {
    setSelectedStopId(stopId);
    mapRef.current?.focusStop(stopId);
    scrollRef.current?.scrollTo({ y: Math.max(0, routeY.current - Spacing.three), animated: true });
  };

  const confirmDelete = () => {
    Alert.alert('Delete this trip?', 'This permanently deletes the trip, its stops and photos.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          const ok = await remove();
          if (ok) {
            router.back();
          } else {
            setDeleting(false);
            Alert.alert('Could not delete the trip. Please try again.');
          }
        },
      },
    ]);
  };

  const changeVisibility = async (next: 'public' | 'private') => {
    setMenuBusy(true);
    const ok = await setVisibility(next);
    setMenuBusy(false);
    if (!ok) Alert.alert('Could not update visibility. Please try again.');
  };

  const toggleVisibility = (current: TripDetail) => {
    if (current.visibility === 'private') {
      Alert.alert('Make this trip public?', 'Everyone on onMyWay will be able to see it.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Make public', onPress: () => void changeVisibility('public') },
      ]);
    } else {
      void changeVisibility('private');
    }
  };

  const openMenu = () => {
    if (!trip) return;
    const toggleLabel = trip.visibility === 'private' ? 'Make public' : 'Make private';
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: 'Trip options',
          options: [toggleLabel, 'Delete trip', 'Cancel'],
          destructiveButtonIndex: 1,
          cancelButtonIndex: 2,
        },
        (index) => {
          if (index === 0) toggleVisibility(trip);
          else if (index === 1) confirmDelete();
        },
      );
    } else {
      Alert.alert('Trip options', undefined, [
        { text: toggleLabel, onPress: () => toggleVisibility(trip) },
        { text: 'Delete trip', style: 'destructive', onPress: () => confirmDelete() },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const header = (
    <Stack.Screen
      options={{
        ...stackOptions,
        title: 'Trip',
        gestureEnabled: !deleting,
        headerBackVisible: !deleting,
        headerRight:
          isOwner && trip
            ? () => (
                <View style={styles.headerActions}>
                  <IconButton
                    icon="edit"
                    accessibilityLabel="Edit trip"
                    disabled={menuBusy || deleting}
                    onPress={() => router.push(`/trip/${trip.id}/edit`)}
                  />
                  <IconButton
                    icon="more"
                    accessibilityLabel="Trip options"
                    disabled={menuBusy || deleting}
                    onPress={openMenu}
                  />
                </View>
              )
            : undefined,
      }}
    />
  );

  if (status === 'loading') {
    return (
      <Screen edges={EDGES} padded={false}>
        {header}
        <TripSkeleton mapHeight={mapHeight} />
      </Screen>
    );
  }

  if (status === 'unavailable' || !trip) {
    return (
      <Screen edges={[...EDGES, 'bottom']} centered>
        {header}
        {status === 'error' ? (
          <ErrorBanner message="Could not load this trip." onRetry={retry} />
        ) : (
          <EmptyState
            icon="lock"
            title="Trip unavailable"
            message="This trip doesn't exist, was removed, or is private."
            actionLabel="Go back"
            onAction={() => router.back()}
          />
        )}
      </Screen>
    );
  }

  const coverUrl = trip.coverPath ? (urls[trip.coverPath] ?? null) : null;
  const author = trip.author;
  const hasStops = trip.stops.length > 0;
  const cardData = trip.stops.map((s) => ({
    id: s.id,
    name: s.name,
    address: s.address,
    notes: s.notes,
    photos: s.photos.map((p) => ({
      id: p.id,
      path: p.storagePath,
      url: urls[p.storagePath] ?? null,
    })),
  }));
  // Trip-level strip: every stop photo, ordered by stop then position.
  const tripPhotos = trip.stops.flatMap((s) =>
    s.photos.map((p) => ({
      id: p.id,
      path: p.storagePath,
      url: urls[p.storagePath] ?? null,
      stopName: s.name,
    })),
  );

  const travelMode = trip.travelMode;
  const modeIcon = MODE_ICON[travelMode];
  const roadKm =
    roadRoute && trip.route?.distanceM != null ? trip.route.distanceM / 1000 : null;
  // A road distance that rounds to nothing is not shown as a road route stat.
  const hasRoadDistance = roadKm !== null && formatDistance(roadKm) !== '-';
  const roadDuration =
    roadRoute && trip.route?.durationS != null ? trip.route.durationS : null;
  const distanceKm = routeDistanceKm(trip.stops);
  const distanceText = formatDistance(hasRoadDistance ? roadKm : distanceKm);
  const distanceA11y = hasRoadDistance
    ? roadDistanceA11yLabel(roadKm, travelMode)
    : distanceA11yLabel(distanceKm);
  const routeStatus = trip.route?.status ?? null;
  const showNotice = isOwner && trip.stops.length >= 2 && (routeStatus === 'error' || routeStatus === 'none');
  const stopsLabel = trip.stops.length === 1 ? 'Stop' : 'Stops';
  const publishedShort = formatDateShort(trip.createdAt);
  const publishedLong = formatDateLong(trip.createdAt);
  const tilesLabel = [
    stopCountLabel(trip.stops.length),
    distanceA11y,
    `Published ${publishedLong}`,
  ].join('. ');
  const coverFallback = Gradients.coverFallbacks[coverFallbackIndex(trip.id)];
  // Private trips have no social UI at all.
  const isPublic = trip.visibility === 'public';

  return (
    <Screen edges={EDGES} padded={false} keyboardAvoiding={false}>
      {header}
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: barHeight + Spacing.three }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              void refresh();
              social.reload();
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }>
        {refreshError ? (
          <ErrorBanner message="Could not load this trip." onRetry={() => void refresh()} style={styles.pad} />
        ) : null}
        {openError ? (
          <ErrorBanner
            message="Could not open maps. No maps app could open this route."
            onDismiss={() => setOpenError(false)}
            style={styles.pad}
          />
        ) : null}

        <View style={styles.pad}>
          <View style={[styles.coverShadow, shadow(theme, 'md'), { backgroundColor: theme.primarySoft }]}>
            <View style={[styles.cover, { maxHeight: windowHeight * 0.45 }]}>
              <View
                style={StyleSheet.absoluteFill}
                pointerEvents="none"
                accessible={!!coverUrl}
                accessibilityRole={coverUrl ? 'image' : undefined}
                accessibilityLabel={coverUrl ? `Cover photo of ${trip.title}` : undefined}>
              <Gradient {...coverFallback} style={StyleSheet.absoluteFill} />
              {coverUrl ? (
                <Image
                  source={{ uri: coverUrl, cacheKey: trip.coverPath ?? undefined }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={reduceMotion ? 0 : 200}
                  cachePolicy="memory-disk"
                  accessible={false}
                  onError={() => {
                    if (!trip.coverPath || coverRetried.current) return;
                    coverRetried.current = true;
                    retryUrl(trip.coverPath);
                  }}
                />
              ) : (
                <View style={styles.coverPlaceholder}>
                  <Icon name="map" size={Layout.iconSize.xl} color="onImage" style={styles.dim} />
                </View>
              )}
              </View>
              {trip.visibility === 'private' ? (
                <Chip
                  tone="onImage"
                  icon="lock"
                  label="Private"
                  accessibilityLabel="Private trip"
                  style={styles.coverBadge}
                />
              ) : null}
              {isPublic ? <DoubleTapLike tripId={trip.id} /> : null}
              {isPublic && !isOwner ? <SaveCircle tripId={trip.id} /> : null}
            </View>
          </View>
        </View>

        <View style={[styles.pad, styles.head]}>
          <ThemedText type="title" accessibilityRole="header">
            {trip.title}
          </ThemedText>

          {trip.visibility === 'private' ? (
            <ThemedText type="caption" themeColor="textMuted">
              Private. Only you can see this trip.
            </ThemedText>
          ) : null}

          <Pressable collapsable={false}
            disabled={!author.username}
            accessibilityRole="button"
            accessibilityLabel={`${author.displayName}, @${author.username}. View profile`}
            onPress={() => router.push(`/user/${author.username}`)}
            style={({ pressed }) => [styles.authorRow, { opacity: pressed ? 0.85 : 1 }]}>
            <Avatar size="md" uri={getAvatarUrl(author.avatarPath)} name={author.displayName} />
            <View style={styles.flex}>
              <ThemedText type="smallBold" numberOfLines={1}>
                {author.displayName}
              </ThemedText>
              <ThemedText type="caption" themeColor="textMuted" numberOfLines={1}>
                {`@${author.username}`}
              </ThemedText>
            </View>
            <Icon name="chevron-right" size={16} color="textMuted" />
          </Pressable>
        </View>

        {/* Always-mounted slot: a visibility change toggles its content, not the layout. */}
        <View collapsable={false} style={isPublic ? styles.pad : styles.hidden}>
          {isPublic ? (
            <TripActionBar
              tripId={trip.id}
              showSave={!isOwner}
              onOpenComments={() => router.push(`/trip/${trip.id}/comments`)}
              onOpenShare={() => setShareOpen(true)}
            />
          ) : null}
        </View>

        <View
          style={styles.pad}
          accessible
          accessibilityLabel={tilesLabel}>
          <View style={styles.tiles} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <InfoTile icon="pin" value={String(trip.stops.length)} label={stopsLabel} />
            <InfoTile
              icon={hasRoadDistance ? modeIcon : 'route'}
              value={distanceText === '-' || hasRoadDistance ? distanceText : `~${distanceText}`}
              label="Distance"
            />
            <InfoTile icon="calendar" value={publishedShort} label="Published" />
          </View>
        </View>

        {trip.description?.trim() ? (
          <View style={[styles.pad, styles.section]}>
            <ThemedText type="heading" accessibilityRole="header">
              About this trip
            </ThemedText>
            <CollapsibleText text={trip.description.trim()} maxChars={240} />
          </View>
        ) : null}

        {tripPhotos.length > 0 ? (
          <View style={styles.section}>
            <View style={[styles.pad, styles.sectionHeader]}>
              <ThemedText type="heading" accessibilityRole="header">
                Photos
              </ThemedText>
              <ThemedText type="caption" themeColor="textMuted">
                {tripPhotos.length === 1 ? '1 photo' : `${tripPhotos.length} photos`}
              </ThemedText>
            </View>
            <TripPhotoStrip photos={tripPhotos} onRetryPhoto={retryUrl} />
          </View>
        ) : null}

        {hasStops ? (
          <>
            <View
              style={[styles.pad, styles.section]}
              onLayout={(e) => {
                routeY.current = e.nativeEvent.layout.y;
              }}>
              <View style={styles.sectionHeader}>
                <ThemedText type="heading" accessibilityRole="header">
                  Route
                </ThemedText>
                {roadDuration !== null ? (
                  <View
                    style={styles.duration}
                    accessible
                    accessibilityLabel={durationA11yLabel(roadDuration)}>
                    <Icon name={modeIcon} size={14} color="textMuted" />
                    <ThemedText type="caption" themeColor="textMuted">
                      {`~${formatDuration(roadDuration)}`}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              {showNotice && routeStatus ? (
                <RouteNotice
                  status={routeStatus}
                  reason={trip.route?.reason ?? null}
                  travelMode={travelMode}
                  tripId={trip.id}
                  onRecomputed={refreshRoute}
                  onEdit={() => router.push(`/trip/${trip.id}/edit`)}
                />
              ) : null}
              <View
                collapsable={false}
                style={[styles.mapShadow, shadow(theme, 'md'), { backgroundColor: theme.surface }]}>
                <View collapsable={false} style={styles.mapClip}>
                  <TripMap
                    ref={mapRef}
                    stops={mapStops}
                    selectedStopId={selectedStopId}
                    onSelectStop={handleSelectFromMap}
                    height={mapHeight}
                    route={roadRoute}
                    travelMode={travelMode}
                  />
                </View>
              </View>
              {trip.stops.length >= 2 ? (
                <ThemedText type="caption" themeColor="textMuted">
                  {roadRoute
                    ? ROUTE_CAPTION[travelMode]
                    : 'Lines connect the stops in order. They do not follow roads.'}
                </ThemedText>
              ) : null}
            </View>

            <View
              style={[styles.pad, styles.section]}
              onLayout={(e) => {
                stopsSectionY.current = e.nativeEvent.layout.y;
              }}>
              <View style={styles.sectionHeader}>
                <ThemedText type="heading" accessibilityRole="header">
                  Stops
                </ThemedText>
                <ThemedText type="caption" themeColor="textMuted">
                  {stopCountLabel(trip.stops.length)}
                </ThemedText>
              </View>
              <View
                style={styles.stops}
                onLayout={(e) => {
                  stopsListY.current = e.nativeEvent.layout.y;
                }}>
                {cardData.map((stop, i) => (
                  <StopListItem
                    key={stop.id}
                    index={i + 1}
                    stop={stop}
                    selected={stop.id === selectedStopId}
                    onPress={() => handleSelectFromList(stop.id)}
                    onRetryPhoto={retryUrl}
                    onLayout={(e) => {
                      cardY.current.set(stop.id, e.nativeEvent.layout.y);
                    }}
                  />
                ))}
              </View>
            </View>
          </>
        ) : (
          <View style={styles.noStops}>
            <Icon name="map" size={Layout.iconSize.xl} color="textMuted" />
            <ThemedText type="subheading" themeColor="textMuted">
              No stops yet
            </ThemedText>
            <ThemedText themeColor="textMuted" style={styles.center}>
              This trip doesn&apos;t have any stops.
            </ThemedText>
          </View>
        )}
      </ScrollView>

      <TripShareSheet
        target={shareOpen ? { id: trip.id, title: trip.title, ownerId: trip.ownerId } : null}
        onClose={() => setShareOpen(false)}
        canRepost={social.status === 'ready' ? social.canRepost : !isOwner}
      />

      <FollowTripButton
        stops={mapStops}
        travelMode={travelMode}
        onOpenError={() => setOpenError(true)}
        onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
      />

      {deleting ? (
        <View
          style={[styles.overlay, { backgroundColor: theme.overlay }]}
          onStartShouldSetResponder={() => true}
          accessibilityViewIsModal
          accessibilityLiveRegion="polite">
          <ActivityIndicator size="large" color={theme.onImage} />
          <ThemedText themeColor="onImage">Deleting trip...</ThemedText>
        </View>
      ) : null}
    </Screen>
  );
}

function TripSkeleton({ mapHeight }: { mapHeight: number }) {
  return (
    <SkeletonGroup style={styles.scrollContent}>
      <View style={styles.pad}>
        <View style={[styles.cover, styles.skeletonClip]}>
          <Skeleton height={400} radius={0} style={StyleSheet.absoluteFill} />
        </View>
      </View>
      <View style={[styles.pad, styles.head]}>
        <Skeleton shape="text" width="70%" height={28} />
        <View style={styles.authorRow}>
          <Skeleton shape="circle" height={40} />
          <View style={styles.flex}>
            <Skeleton shape="text" width="40%" />
            <Skeleton shape="text" width="30%" />
          </View>
        </View>
      </View>
      <View style={[styles.pad, styles.tiles]}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={104} radius={Radius.lg} style={styles.flex} />
        ))}
      </View>
      <View style={[styles.pad, styles.section]}>
        <Skeleton shape="text" />
        <Skeleton shape="text" width="80%" />
      </View>
      <View style={[styles.pad, styles.photoSkeletons]}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} width={120} height={150} radius={Radius.lg} />
        ))}
      </View>
      <View style={styles.pad}>
        <Skeleton height={mapHeight} radius={Radius.xl} />
      </View>
      <View style={[styles.pad, styles.stops]}>
        {[0, 1].map((i) => (
          <Skeleton key={i} height={96} radius={Radius.lg} />
        ))}
      </View>
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  dim: { opacity: 0.9 },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  center: { textAlign: 'center' },
  scrollContent: { paddingTop: Spacing.two, gap: Spacing.four },
  pad: { paddingHorizontal: Spacing.three },
  hidden: { display: 'none' },
  coverShadow: { borderRadius: Radius.xl },
  cover: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  skeletonClip: { backgroundColor: 'transparent' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coverBadge: { position: 'absolute', top: Spacing.three, left: Spacing.three },
  head: { gap: Spacing.two + Spacing.one },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - Spacing.one, minHeight: 56 },
  tiles: { flexDirection: 'row', gap: Spacing.three - Spacing.one },
  section: { gap: Spacing.three - Spacing.one },
  duration: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  sectionHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  photoSkeletons: { flexDirection: 'row', gap: Spacing.three - Spacing.one },
  mapShadow: { borderRadius: Radius.xl },
  mapClip: { borderRadius: Radius.xl, overflow: 'hidden' },
  stops: { gap: Spacing.three },
  noStops: {
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.four,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.three,
  },
});
