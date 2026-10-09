import type { TravelMode } from '@/lib/trip-form';

export type TripMapStop = {
  id: string;
  /** 1-based display number (matches the stop list). */
  number: number;
  name: string;
  lat: number;
  lng: number;
};

export type TripMapHandle = {
  /** Centres the map on a stop (zooms in to a neighbourhood unless already closer). */
  focusStop: (id: string) => void;
  /** Fits every stop into view. */
  fitAll: () => void;
};

export type TripMapProps = {
  /** Sorted in route order. */
  stops: TripMapStop[];
  selectedStopId?: string | null;
  /** `null` means the map background was tapped. */
  onSelectStop?: (id: string | null) => void;
  height?: number;
  /** Decoded road route (memoised by the caller). Null or missing = dashed straight lines. */
  route?: { latitude: number; longitude: number }[] | null;
  /** Mode the route was drawn for; the map itself looks the same for every mode. */
  travelMode?: TravelMode;
};
