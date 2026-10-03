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
};
