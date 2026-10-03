import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';

import type { TripMapHandle, TripMapProps, TripMapStop } from './trip-map.types';

import { mapStyleDark } from '@/constants/map-style-dark';
import { Radius } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export type { TripMapHandle, TripMapProps, TripMapStop } from './trip-map.types';

const NEIGHBOURHOOD_DELTA = 0.02;
const FIT_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };
const MARKER = 32;
const MARKER_SELECTED = 40;
const SETTLE_MS = 400;

const coordKey = (s: { lat: number; lng: number }) => `${s.lat.toFixed(6)},${s.lng.toFixed(6)}`;

type StopMarkerProps = {
  stop: TripMapStop;
  selected: boolean;
  onPress: (id: string) => void;
};

/**
 * Custom marker view. The native layer only re-renders the view while tracksViewChanges is
 * true, so it is on for the first render and after `selected` changes, then switched off.
 */
function StopMarker({ stop, selected, onPress }: StopMarkerProps) {
  const theme = useTheme();
  const [settledFor, setSettledFor] = useState<boolean | null>(null);
  const tracking = settledFor !== selected;

  useEffect(() => {
    const timer = setTimeout(() => setSettledFor(selected), SETTLE_MS);
    return () => clearTimeout(timer);
  }, [selected]);

  const size = selected ? MARKER_SELECTED : MARKER;
  return (
    <Marker
      identifier={stop.id}
      title={stop.name}
      coordinate={{ latitude: stop.lat, longitude: stop.lng }}
      anchor={{ x: 0.5, y: 0.5 }}
      zIndex={selected ? 2 : 1}
      tracksViewChanges={tracking}
      onPress={(e) => {
        e.stopPropagation();
        onPress(stop.id);
      }}>
      <View
        style={[
          styles.marker,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: selected ? theme.text : theme.primary,
            borderColor: theme.onImage,
          },
        ]}>
        <Text
          allowFontScaling={false}
          style={[styles.markerText, { color: selected ? theme.background : theme.onPrimary }]}>
          {stop.number}
        </Text>
      </View>
    </Marker>
  );
}

export const TripMap = forwardRef<TripMapHandle, TripMapProps>(function TripMap(
  { stops, selectedStopId = null, onSelectStop, height },
  ref,
) {
  const theme = useTheme();
  const scheme = useColorScheme();
  const dark = scheme === 'dark';
  const { height: windowHeight } = useWindowDimensions();
  const boxHeight = height ?? Math.max(220, Math.min(320, windowHeight * 0.4));

  const mapRef = useRef<MapView>(null);
  const deltaRef = useRef(NEIGHBOURHOOD_DELTA);
  const [ready, setReady] = useState(false);
  const [laidOut, setLaidOut] = useState(false);

  const coordinates = useMemo(
    () => stops.map((s) => ({ latitude: s.lat, longitude: s.lng })),
    [stops],
  );
  const distinct = useMemo(() => new Set(stops.map(coordKey)).size, [stops]);
  // Changes only when the set/order of points changes (not on every parent render).
  const stopsKey = useMemo(() => stops.map(coordKey).join('|'), [stops]);

  const initialRegion = useMemo<Region | undefined>(() => {
    const first = stops[0];
    if (!first) return undefined;
    return {
      latitude: first.lat,
      longitude: first.lng,
      latitudeDelta: NEIGHBOURHOOD_DELTA,
      longitudeDelta: NEIGHBOURHOOD_DELTA,
    };
    // Only the very first camera matters; later changes are handled by the fit effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fitAll = useCallback(() => {
    const map = mapRef.current;
    if (!map || stops.length === 0) return;
    if (distinct < 2) {
      map.animateToRegion(
        {
          latitude: stops[0].lat,
          longitude: stops[0].lng,
          latitudeDelta: NEIGHBOURHOOD_DELTA,
          longitudeDelta: NEIGHBOURHOOD_DELTA,
        },
        300,
      );
      return;
    }
    map.fitToCoordinates(coordinates, { edgePadding: FIT_PADDING, animated: true });
  }, [stops, distinct, coordinates]);

  // Fit once the map is ready AND laid out (Android ignores earlier calls); refit on changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !laidOut || !map || stops.length === 0) return;
    if (distinct < 2) {
      map.animateToRegion(
        {
          latitude: stops[0].lat,
          longitude: stops[0].lng,
          latitudeDelta: NEIGHBOURHOOD_DELTA,
          longitudeDelta: NEIGHBOURHOOD_DELTA,
        },
        0,
      );
    } else {
      map.fitToCoordinates(coordinates, { edgePadding: FIT_PADDING, animated: false });
    }
    // stopsKey stands in for stops/coordinates/distinct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, laidOut, stopsKey]);

  useImperativeHandle(
    ref,
    () => ({
      focusStop: (id: string) => {
        const stop = stops.find((s) => s.id === id);
        const map = mapRef.current;
        if (!stop || !map) return;
        const delta = Math.min(deltaRef.current, NEIGHBOURHOOD_DELTA);
        map.animateToRegion(
          { latitude: stop.lat, longitude: stop.lng, latitudeDelta: delta, longitudeDelta: delta },
          400,
        );
      },
      fitAll,
    }),
    [stops, fitAll],
  );

  const handleMarker = useCallback((id: string) => onSelectStop?.(id), [onSelectStop]);

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Map of the trip route with ${stops.length} stops. The stop list below has the same information.`}
      style={[styles.wrapper, { height: boxHeight, backgroundColor: theme.surface }]}>
      <View
        style={StyleSheet.absoluteFill}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden>
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFill}
          initialRegion={initialRegion}
          rotateEnabled={false}
          pitchEnabled={false}
          toolbarEnabled={false}
          userInterfaceStyle={dark ? 'dark' : 'light'}
          customMapStyle={dark ? mapStyleDark : undefined}
          onLayout={() => setLaidOut(true)}
          onMapReady={() => setReady(true)}
          onRegionChangeComplete={(region) => {
            deltaRef.current = region.latitudeDelta;
          }}
          onPress={() => onSelectStop?.(null)}>
          {stops.length >= 2 ? (
            <Polyline
              coordinates={coordinates}
              strokeColor={theme.primary}
              strokeWidth={4}
              lineJoin="round"
            />
          ) : null}
          {stops.map((stop) => (
            <StopMarker
              key={stop.id}
              stop={stop}
              selected={stop.id === selectedStopId}
              onPress={handleMarker}
            />
          ))}
        </MapView>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { borderRadius: Radius.lg, overflow: 'hidden' },
  marker: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  markerText: { fontSize: 14, fontWeight: '700' },
});
