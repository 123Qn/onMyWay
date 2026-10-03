import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import MapView, { type Region } from 'react-native-maps';

import type { LocationPickerMapHandle, LocationPickerMapProps } from './location-picker-map.types';

import { Icon } from '@/components/ui/icon';
import { mapStyleDark } from '@/constants/map-style-dark';
import { Duration } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';

export type { LocationPickerMapHandle, LocationPickerMapProps } from './location-picker-map.types';

const PIN_SIZE = 40;
const HALO = 2;
const LIFT = 8;

export const LocationPickerMap = forwardRef<LocationPickerMapHandle, LocationPickerMapProps>(
  function LocationPickerMap(
    { initialRegion, showsUserLocation, onUserPan, onCenterChange, onMapTouch },
    ref,
  ) {
    const theme = useTheme();
    const dark = useColorScheme() === 'dark';
    const mapRef = useRef<MapView>(null);
    const lift = useRef(new Animated.Value(0)).current;
    const lifted = useRef(false);

    const setLifted = useCallback(
      (value: boolean) => {
        if (lifted.current === value) return;
        lifted.current = value;
        Animated.timing(lift, {
          toValue: value ? -LIFT : 0,
          duration: Duration.fast,
          useNativeDriver: true,
        }).start();
      },
      [lift],
    );

    useEffect(() => {
      onCenterChange({ lat: initialRegion.latitude, lng: initialRegion.longitude });
      // Report the starting centre once.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        animateTo: (lat, lng, delta) =>
          mapRef.current?.animateToRegion(
            { latitude: lat, longitude: lng, latitudeDelta: delta, longitudeDelta: delta },
            400,
          ),
      }),
      [],
    );

    const handleComplete = useCallback(
      (region: Region) => {
        setLifted(false);
        onCenterChange({ lat: region.latitude, lng: region.longitude });
      },
      [onCenterChange, setLifted],
    );

    return (
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Map. The pin marks the chosen place. Use the search field or Use my location to choose without dragging the map."
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.surface }]}>
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
            showsMyLocationButton={false}
            showsUserLocation={showsUserLocation}
            userInterfaceStyle={dark ? 'dark' : 'light'}
            customMapStyle={dark ? mapStyleDark : undefined}
            onPanDrag={() => {
              setLifted(true);
              onUserPan();
            }}
            onPress={onMapTouch}
            onRegionChangeComplete={handleComplete}
          />
          <View pointerEvents="none" style={styles.pinLayer}>
            <View style={[styles.shadow, { backgroundColor: theme.overlay }]} />
            <Animated.View style={[styles.pin, { transform: [{ translateY: lift }] }]}>
              <Icon name="pin" size={PIN_SIZE + HALO * 2} color="#FFFFFF" style={styles.halo} />
              <Icon name="pin" size={PIN_SIZE} color="primary" />
            </Animated.View>
          </View>
        </View>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  pinLayer: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  // The glyph tip is its bottom edge: raise it by the glyph height so the tip is at the centre.
  pin: {
    position: 'absolute',
    width: PIN_SIZE,
    height: PIN_SIZE,
    top: '50%',
    marginTop: -PIN_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: { position: 'absolute' },
  shadow: { width: 10, height: 4, borderRadius: 5 },
});
