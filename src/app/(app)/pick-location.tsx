import * as Location from 'expo-location';
import { Stack, router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Keyboard,
  Linking,
  Platform,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  LocationPickerMap,
  type LocationPickerMapHandle,
} from '@/components/map/location-picker-map';
import type { PickerRegion } from '@/components/map/location-picker-map.types';
import { PlaceResultList, placeKey } from '@/components/map/place-result-list';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Screen } from '@/components/ui/screen';
import { FontFamily, Layout, Radius, Spacing, shadow } from '@/constants/theme';
import { usePlaceSearch } from '@/hooks/use-place-search';
import { useTheme } from '@/hooks/use-theme';
import { reversePlace, type PlaceResult } from '@/lib/nominatim';
import { setPickResult, type PickedLocation } from '@/lib/pick-location-store';

const IS_WEB = Platform.OS === 'web';
const WORLD_REGION: PickerRegion = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 80,
  longitudeDelta: 80,
};
const LOCATE_TIMEOUT_MS = 10_000;
const CONFIRM_TIMEOUT_MS = 9_000;

type Notice = 'denied' | 'unavailable' | null;

function firstParam(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseCoord(v: string | undefined, limit: number): number | null {
  if (v === undefined || v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= limit ? n : null;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      },
    );
  });
}

/** Camera size that frames a result's bounding box, clamped to 0.01..0.5 degrees. */
function deltaFor(result: PlaceResult): number {
  const box = result.boundingBox;
  if (!box) return 0.01;
  const [south, north, west, east] = box;
  const span = Math.max(Math.abs(north - south), Math.abs(east - west)) * 1.2;
  return Math.min(0.5, Math.max(0.01, span));
}

export default function PickLocationScreen() {
  const params = useLocalSearchParams<{ requestId?: string; lat?: string; lng?: string }>();
  const requestId = firstParam(params.requestId);
  const startLat = parseCoord(firstParam(params.lat), 90);
  const startLng = parseCoord(firstParam(params.lng), 180);

  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { height: windowHeight } = useWindowDimensions();

  const mapRef = useRef<LocationPickerMapHandle>(null);
  const inputRef = useRef<TextInput>(null);
  const centerRef = useRef<{ lat: number; lng: number } | null>(null);
  const confirmingRef = useRef(false);
  const locatingRef = useRef(false);
  const mountedRef = useRef(true);

  const [initial, setInitial] = useState<PickerRegion | null>(null);
  const [permGranted, setPermGranted] = useState(false);
  const [text, setText] = useState('');
  const [overlayOpen, setOverlayOpen] = useState(false);
  const [selected, setSelected] = useState<PlaceResult | null>(null);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [locating, setLocating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [barHeight, setBarHeight] = useState(120);

  const { status, results, search, clear } = usePlaceSearch();
  const lastQuery = useRef('');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Cancel (Cancel button, Android back) is blocked only while confirming.
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (confirmingRef.current) e.preventDefault();
    });
  }, [navigation]);

  // Keyboard: hide the floating controls while it is open.
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', (e) =>
      setKeyboardHeight(e.endCoordinates.height),
    );
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  // Starting camera. Never prompts for permission; only uses what is already granted.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      let region: PickerRegion = WORLD_REGION;
      if (startLat !== null && startLng !== null) {
        region = { latitude: startLat, longitude: startLng, latitudeDelta: 0.01, longitudeDelta: 0.01 };
      }
      if (!IS_WEB) {
        try {
          const perm = await Location.getForegroundPermissionsAsync();
          if (perm.granted) {
            if (!cancelled) setPermGranted(true);
            if (startLat === null || startLng === null) {
              const last = await Location.getLastKnownPositionAsync();
              if (last) {
                region = {
                  latitude: last.coords.latitude,
                  longitude: last.coords.longitude,
                  latitudeDelta: 0.05,
                  longitudeDelta: 0.05,
                };
              }
            }
          }
        } catch {
          // Keep the fallback region.
        }
      }
      if (!cancelled) setInitial(region);
    })();
    return () => {
      cancelled = true;
    };
    // Only the first render's params matter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Announce the number of results to screen readers.
  useEffect(() => {
    if (status === 'ready') {
      AccessibilityInfo.announceForAccessibility(`${results.length} places found`);
    } else if (status === 'empty') {
      AccessibilityInfo.announceForAccessibility('No places found');
    }
  }, [status, results.length]);

  const onCenterChange = useCallback((c: { lat: number; lng: number }) => {
    centerRef.current = c;
    setCenter(c);
  }, []);

  const onUserPan = useCallback(() => {
    // The pin moved: an earlier result label would be wrong, and the list is in the way.
    setSelected(null);
    setOverlayOpen(false);
  }, []);

  const onMapTouch = useCallback(() => {
    setOverlayOpen(false);
    Keyboard.dismiss();
  }, []);

  const submit = () => {
    const q = text.trim();
    if (confirming || status === 'loading' || q.length < 2) return;
    Keyboard.dismiss();
    setOverlayOpen(true);
    if (status === 'ready' && lastQuery.current === q) return;
    lastQuery.current = q;
    search(q);
  };

  const retry = () => {
    const q = text.trim();
    if (q.length < 2) return;
    lastQuery.current = q;
    search(q);
  };

  const clearSearch = () => {
    setText('');
    clear();
    setOverlayOpen(false);
    lastQuery.current = '';
    inputRef.current?.focus();
  };

  const selectResult = (r: PlaceResult) => {
    setSelected(r);
    setOverlayOpen(false);
    Keyboard.dismiss();
    mapRef.current?.animateTo(r.lat, r.lng, deltaFor(r));
  };

  const locate = async () => {
    if (locatingRef.current || confirmingRef.current) return;
    locatingRef.current = true;
    setLocating(true);
    setNotice(null);
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) {
        if (mountedRef.current) setNotice('denied');
        return;
      }
      if (mountedRef.current) setPermGranted(true);
      const pos = await withTimeout(
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
        LOCATE_TIMEOUT_MS,
      );
      if (!mountedRef.current) return;
      setSelected(null);
      setOverlayOpen(false);
      mapRef.current?.animateTo(pos.coords.latitude, pos.coords.longitude, 0.01);
    } catch {
      if (mountedRef.current) setNotice('unavailable');
    } finally {
      locatingRef.current = false;
      if (mountedRef.current) setLocating(false);
    }
  };

  const confirm = async () => {
    if (confirmingRef.current || !requestId) return;
    confirmingRef.current = true;
    setConfirming(true);
    Keyboard.dismiss();
    let result: PickedLocation | null = null;

    if (selected) {
      result = { lat: selected.lat, lng: selected.lng, name: selected.name, address: selected.address };
    } else if (!IS_WEB) {
      const c = centerRef.current;
      if (c) {
        const lat = Number(c.lat.toFixed(6));
        const lng = Number(c.lng.toFixed(6));
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), CONFIRM_TIMEOUT_MS);
        try {
          const r = await reversePlace(lat, lng, { signal: controller.signal });
          result = r
            ? { lat, lng, name: r.name, address: r.address }
            : { lat, lng, name: 'Dropped pin', address: null };
        } catch {
          // Reverse geocoding never blocks the user.
          result = { lat, lng, name: 'Dropped pin', address: null };
        } finally {
          clearTimeout(timer);
        }
      }
    }

    if (!result || !mountedRef.current) {
      confirmingRef.current = false;
      if (mountedRef.current) setConfirming(false);
      return;
    }
    setPickResult(requestId, result);
    confirmingRef.current = false;
    router.back();
  };

  const keyboardVisible = keyboardHeight > 0;
  const cardShadow: ViewStyle = shadow(theme, 'lg');

  const header = (
    <Stack.Screen
      options={{
        headerLeft: () => (
          <IconButton
            icon="close"
            accessibilityLabel="Cancel"
            disabled={confirming}
            onPress={() => router.back()}
          />
        ),
      }}
    />
  );

  if (!requestId) {
    return (
      <>
        {header}
        <Screen centered edges={['left', 'right', 'bottom']}>
          <EmptyState
            icon="alert"
            title="Something went wrong"
            actionLabel="Close"
            onAction={() => router.back()}
          />
        </Screen>
      </>
    );
  }

  const coordsLabel = center ? `${center.lat.toFixed(5)}, ${center.lng.toFixed(5)}` : null;
  const labelTitle = selected
    ? selected.name
    : IS_WEB
      ? 'Search for a place to continue'
      : (coordsLabel ?? 'Move the map to place the pin');
  const labelCaption = selected
    ? selected.address
    : IS_WEB
      ? null
      : 'Address is looked up when you confirm';

  const listMax = Math.max(
    120,
    Math.min(320, windowHeight * 0.4, windowHeight - keyboardHeight - 48 - Spacing.three * 2 - Spacing.four),
  );
  const showList = overlayOpen && status !== 'idle';

  return (
    <>
      {header}
      <Screen padded={false} edges={['left', 'right']} keyboardAvoiding={false}>
        <View style={styles.flex}>
          {initial ? (
            <View style={styles.flex} pointerEvents={confirming ? 'none' : 'auto'}>
              <LocationPickerMap
                ref={mapRef}
                initialRegion={initial}
                showsUserLocation={permGranted}
                onUserPan={onUserPan}
                onCenterChange={onCenterChange}
                onMapTouch={onMapTouch}
              />
            </View>
          ) : null}

          <View style={styles.top} pointerEvents="box-none">
            <View
              style={[
                styles.searchBar,
                { backgroundColor: theme.surface, borderColor: theme.border },
                cardShadow,
              ]}>
              <Icon name="search" size={Layout.iconSize.md} color="textMuted" style={styles.searchIcon} />
              <TextInput
                ref={inputRef}
                value={text}
                onChangeText={setText}
                onSubmitEditing={submit}
                editable={!confirming}
                placeholder="Search for a place"
                placeholderTextColor={theme.textMuted}
                selectionColor={theme.primary}
                returnKeyType="search"
                enterKeyHint="search"
                autoCorrect={false}
                autoCapitalize="none"
                accessibilityLabel="Search for a place"
                accessibilityHint="Press search on the keyboard to see results"
                style={[styles.input, { color: theme.text }]}
              />
              {text.length > 0 ? (
                <IconButton icon="close" accessibilityLabel="Clear search" onPress={clearSearch} />
              ) : null}
            </View>

            {notice ? (
              <ErrorBanner
                message={
                  notice === 'denied'
                    ? 'Location permission is off. You can still search or move the map.'
                    : 'Could not get your location. Try again or move the map.'
                }
                onRetry={notice === 'denied' ? () => Linking.openSettings() : undefined}
                retryLabel="Open settings"
                onDismiss={() => setNotice(null)}
              />
            ) : null}

            {showList ? (
              <View
                style={[
                  styles.results,
                  { backgroundColor: theme.surface, borderColor: theme.border, maxHeight: listMax },
                  cardShadow,
                ]}>
                <PlaceResultList
                  status={status}
                  results={results}
                  onSelect={selectResult}
                  onRetry={retry}
                  selectedKey={IS_WEB && selected ? placeKey(selected) : null}
                />
              </View>
            ) : null}
          </View>

          {!keyboardVisible ? (
            <>
              {!IS_WEB ? (
                <IconButton
                  icon="locate"
                  size="lg"
                  variant="filled"
                  accessibilityLabel="Use my location"
                  loading={locating}
                  disabled={confirming}
                  onPress={locate}
                  style={[
                    styles.locate,
                    { bottom: barHeight + Spacing.three, borderColor: theme.border },
                    cardShadow,
                  ]}
                />
              ) : null}

              <View
                accessible
                accessibilityRole="text"
                style={[
                  styles.attribution,
                  { bottom: barHeight + Spacing.two, backgroundColor: theme.surface },
                ]}>
                <ThemedText type="caption" themeColor="textMuted">
                  © OpenStreetMap contributors
                </ThemedText>
              </View>

              <View
                onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)}
                style={[
                  styles.bar,
                  {
                    backgroundColor: theme.background,
                    borderTopColor: theme.border,
                    paddingBottom: Math.max(insets.bottom, Spacing.three),
                  },
                ]}>
                <View style={styles.barRow}>
                  <Icon name="pin" size={Layout.iconSize.lg} color="primary" />
                  <View style={styles.barText} accessibilityLiveRegion="polite">
                    <ThemedText type="bodyStrong" numberOfLines={2}>
                      {labelTitle}
                    </ThemedText>
                    {labelCaption ? (
                      <ThemedText type="caption" themeColor="textMuted" numberOfLines={2}>
                        {labelCaption}
                      </ThemedText>
                    ) : null}
                  </View>
                </View>
                <Button
                  title="Use this location"
                  icon="check"
                  size="lg"
                  fullWidth
                  loading={confirming}
                  disabled={IS_WEB ? !selected : !selected && !center}
                  accessibilityHint="Adds this place as a stop"
                  onPress={confirm}
                />
              </View>
            </>
          ) : null}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    gap: Spacing.two,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Layout.controlHeight.md,
    borderRadius: Radius.lg,
    borderWidth: 1,
    paddingLeft: Spacing.three,
  },
  searchIcon: { marginRight: Spacing.two },
  input: {
    flex: 1,
    minHeight: Layout.controlHeight.md,
    fontSize: 16,
    fontFamily: FontFamily.regular,
    paddingVertical: Spacing.two,
  },
  results: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  locate: {
    position: 'absolute',
    right: Spacing.three,
    borderWidth: 1,
  },
  attribution: {
    position: 'absolute',
    left: Spacing.three,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.full,
    opacity: 0.9,
  },
  bar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderTopWidth: 1,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  barText: { flex: 1 },
});
