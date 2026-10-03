export type PickerRegion = {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
};

export type LocationPickerMapHandle = {
  /** Moves the camera so the pin sits on the given point. */
  animateTo: (lat: number, lng: number, delta: number) => void;
};

export type LocationPickerMapProps = {
  initialRegion: PickerRegion;
  showsUserLocation: boolean;
  /** Called when the user starts moving the map by hand. */
  onUserPan: () => void;
  /** Called with the map centre (the pin tip) after each camera move. */
  onCenterChange: (center: { lat: number; lng: number }) => void;
  /** Called when the user touches the map (used to close the results list). */
  onMapTouch?: () => void;
};
