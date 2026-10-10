# onMyWay - Road routes (design spec)

Audience: coder, tester, db-designer (data needs only). Branch: `ui-refresh`. Status: v1.
Why a separate file: DESIGN.md is already long and this feature crosses the trip form, the publish pipeline, the trip detail and the maps hand-off. It extends `DESIGN.md` (tokens, components) and `DESIGN-mvp.md` (11.4 form, 11.9 publish, 11.10 save, 9.3 map, 9.4 follow). Where this file conflicts with them, this file wins for the items below. All other behaviour, copy and tokens are unchanged.

## 0. Owner decisions (final) and UI data needs

- ORS called only from a Supabase Edge Function (no key in the app). Route is computed at publish and at edit-save and stored; viewing a trip never calls routing.
- ONE travel mode per trip: Driving (`driving-car`), Walking (`foot-walking`), Cycling (`cycling-regular`).
- Routing failure NEVER blocks publish or save. Fallback is the straight dashed line; the owner can retry.

UI data needs (db-designer owns the shape):

| Need | Notes |
|---|---|
| `travel_mode`: `'driving' \| 'walking' \| 'cycling'` | NOT NULL, default `'driving'` (old trips get it for free) |
| Route geometry | Ordered lat/lng list for ONE polyline (encoded polyline string or array, server-simplified to about 2,000 points max). `null` when no route |
| `route_distance_m`, `route_duration_s` | Integers, `null` when no route |
| `route_status` | `'ok'` (geometry present) / `'none'` (ORS answered: no route, too far, unroutable) / `'error'` (transient: ORS down, quota, timeout) / `null` (never computed, old trips, or fewer than 2 stops) |
| Staleness guarantee | The UI must never draw a road route that no longer matches the stops. Preferred: the stop-saving RPC clears the route (status `null`) whenever stop coordinates, stop order or mode change. Alternative: a `route_signature` the client compares with the loaded stops |
| Owner "recompute" call | An Edge Function that takes only the trip id, reads the stops from the DB, checks ownership and writes the result. Used by publish, edit-save and the detail "Try again". Returns `{ status, reason? }` where `reason` is `'no_route' \| 'too_far' \| 'unavailable'` |

Final shape (db-designer, migration 0004; details in `docs/ROUTING-DB.md`): `trips.travel_mode`; table `trip_routes` (one row per trip) persists the LAST attempt: `status` `'ok' | 'none' | 'error'` plus `reason` `'no_route' | 'too_far' | 'unavailable'` (null when ok), encoded-polyline `polyline` (<= 2,000 points), `distance_m`, `duration_s` (all null unless ok). Read with RPC `get_trip_route(trip_id)` -> `route_status, reason, polyline, distance_m, duration_s, travel_mode, is_fresh`. Staleness is enforced in the DB, not by clearing in `save_trip_stops`: if stops (coords/order) or mode changed since the attempt, `get_trip_route` returns `route_status = null` and no geometry, so a stale line cannot be drawn and `needsRoute` = (2+ stops) and (`route_status` is null or `'error'`). A `'none'` result with the same stops/mode is cached and never recomputed. The Edge Function returns HTTP 200 `{ status, reason? }` for every routing outcome (including rate limit and ORS outage = `error/unavailable`).

Client rules: the whole routing call has a 20 s client timeout; a timeout, a network error or any non-OK answer is mapped to `'error'`/`'none'` and the flow continues.

---

## 1. Trip form: travel-mode control

Applies to create and edit (DESIGN.md 5.6 form cards).

**Placement.** Inside card (2), directly under "Who can see this trip", separated by 16 gap. Card (2) title stays implicit (labels carry meaning). Reason: it is a trip-level setting, set before the stops, and does not need its own card.

**Label and copy.**
- Label (`label`, `text`): "Travel mode".
- Helper (`caption`, `textMuted`, under the control): "Used to draw your route along roads and paths between stops."
- Options: "Driving", "Walking", "Cycling".
- Default on create: Driving. Edit: the stored value. Old drafts without the field load as Driving. The value is stored in the draft like every other field.

**Component.** New small primitive `SegmentedControl` (`src/components/ui/segmented-control.tsx`), built from existing tokens (it is the Chip look scaled to a touch target; `Chip` itself is 32 px high so it is not reused as is):
- Props: `options: { value: string; label: string; icon: IconName }[]`, `value`, `onChange`, `accessibilityLabel`, `disabled?`, `style`.
- Container: row, gap 8, `flex: 1` segments. Each segment: min height 48, radius `full`, horizontal padding 12, icon 20 + label `label` (semibold), centred, gap 6.
- Unselected: fill `surfaceMuted`, 2 px transparent border (no layout shift), icon and text `text`.
- Selected: fill `primarySoft`, 2 px `primary` border, text `primaryPressed`, icon `primary` (same selected recipe as the visibility rows, 5.6). Selection is never colour only: border thickness, weight and `selected` state differ.
- Press: fill `backgroundSelected`. Disabled: opacity 0.4.
- Large text (`PixelRatio.getFontScale() >= 1.5`): render the options as stacked full-width rows (icon left, label, min height 56), same as the visibility rows, so labels never truncate. Label `maxFontSizeMultiplier` 1.3 in the row layout.
- New `IconName`s (coder verifies the SF and Material names against the installed types): `car` (`car` / `directions_car`), `walk` (`figure.walk` / `directions_walk`), `bike` (`bicycle` / `directions_bike`). The same three icons are reused in 3.

**Accessibility.** Container `accessibilityRole="radiogroup"`, label "Travel mode". Each segment `accessibilityRole="radio"`, `accessibilityState={{ selected }}`, label "Driving" / "Walking" / "Cycling", hint on the group only: "Used to draw your route between stops". Touch target at least 48 high, full flex width. Changing the value does not announce anything extra (the state change is announced by the screen reader).

**Behaviour.** Always enabled, also with 0 or 1 stop (the mode still drives Follow-in-Maps). Disabled only while the publish/save overlay is up. Changing it on edit makes the route stale (section 4) and nothing else happens until Save.

---

## 2. Publish and save pipeline

### 2.1 Position

Add a step `'route'` to `PublishStep`: `'trip' | 'photos' | 'stops' | 'route' | 'finish'`. Order: create trip, upload photos, save stops, **calculate route**, set visibility and finish. The route step runs BEFORE visibility is applied so a trip never becomes public without its route attempt having finished. It needs the stops in the DB, hence after `save_trip_stops`.

`PublishProgress` rows (DESIGN-mvp 11.9) become:

1. "Creating your trip"
2. "Uploading photos" (as before)
3. "Saving stops"
4. "Calculating route" (new)
5. "Finishing up"

- Row 4 is hidden when the trip has fewer than 2 stops (no routing call).
- Active: `ActivityIndicator`, no determinate bar (duration unknown). Step-change live-region text: "Calculating route".
- Done: `check` in `success`, as the other rows.
- **Skipped after a routing failure: not a failure.** The row ends with the `alert` icon in `textMuted` (NOT `danger`), label unchanged, trailing detail (`caption`, `textMuted`): "Straight lines used". The rest of the pipeline continues; no Retry / Back / Discard buttons appear for this. Row detail is part of the row's accessible label ("Calculating route. Straight lines used.").
- Expected duration: the row may flash by in under a second; do not add an artificial minimum time.

### 2.2 Edit save (lighter overlay)

Keep the lighter overlay of 11.10. After the stops step, while the route runs, the overlay text changes from "Saving changes..." to "Calculating route...". No step list. If routing fails, the overlay closes normally and the screen goes back to the trip (the save succeeded); the notice in 2.4 appears there.

The route step runs on Save only when `needsRoute` is true: at least 2 stops AND (the stored route is missing/stale OR `route_status` is `'error'` or `null` OR the mode or stops changed). If `route_status` is `'none'` and nothing relevant changed, do NOT call again (it would fail again and waste quota). Edits to title, description, notes, photos, names or visibility never trigger routing.

### 2.3 Failure behaviour (all cases are non-blocking)

| Cause | Stored status | Reason shown to the owner |
|---|---|---|
| ORS down, 5xx, timeout, quota or rate limit, our Edge Function unreachable, network drop | `error` | `unavailable` |
| ORS says no route (across sea, unroutable point) | `none` | `no_route` |
| Too far or too many waypoints for the mode (walking across a country) | `none` | `too_far` |

On any of these: the trip is saved/published normally, geometry stays `null`, the pipeline continues, the draft is cleared, the user lands on the trip detail. The user is never asked to choose anything in the overlay. Because the failure is not an error state, there is no "Retry" in the overlay (retry lives on the trip, 2.4, and implicitly in every later edit-save).

A failed publish for another reason (photo upload, stops) still uses the existing failure card. If the route step already finished on an earlier attempt it is skipped on retry; if it failed, it is attempted again on retry.

### 2.4 What the owner sees afterwards (trip detail, owner only)

Directly above the Route section map, a flat `Card` (`variant="flat"`, padding 16, leading `alert` icon in `textMuted` 20, text `body` `text`). It is information, not an error: no `danger` colours, not a live-region alert (plain `accessibilityRole="text"`; the map caption already states the fallback).

| `route_status` | Copy | Action |
|---|---|---|
| `error` | "We couldn't reach the route service, so lines connect your stops in a straight line for now." | `Button secondary sm` "Try again" (loading while running; calls the owner recompute function; on success refetch the trip and the card disappears) |
| `none`, reason `no_route` | "There's no road route between some of your stops, so lines connect them in a straight line." | `Button ghost sm` "Edit trip" (opens edit; user can change mode or stops) |
| `none`, reason `too_far` | "These stops are too far apart for a {walking/cycling} route, so lines connect them in a straight line." | `Button ghost sm` "Edit trip" |

If "Try again" fails: keep the card, replace the button text with the helper line "Still can't reach the route service. Try again later." (`caption`, `textMuted`, announced politely once). A stale `error` is also fixed implicitly by any later edit-save (2.2). Non-owners never see this card, only the straight dashed line and its caption (3.1). If `route_status` is `null` with 2+ stops (old trip), the owner sees no card (see section 4).

---

## 3. Trip detail

### 3.1 Map rendering (`TripMap`)

New optional props: `route?: { latitude: number; longitude: number }[] | null` (decoded once with `useMemo`, not per render) and `travelMode`. All existing props, markers, camera, interaction and a11y stay.

| Mode | Drawing | Tokens |
|---|---|---|
| Road route (status `ok`, geometry present, not stale) | Two polylines: a casing underneath, then the route | Casing: `strokeColor = theme.surface`, width 8. Route: `strokeColor = theme.primary`, width 5. Both `lineJoin="round"`, `lineCap="round"`, route `zIndex` above casing, markers above both |
| Fallback (no usable route) | One straight polyline through the stops in order, DASHED | `strokeColor = theme.primary`, width 3, `lineDashPattern=[10, 8]`, `lineCap="butt"`, no casing, no transparency |

- Light/dark: all values are theme tokens, so dark mode switches automatically (`primary` `#FF7A4D` over the dark map style). The `surface` casing makes the coral line readable on top of orange/yellow highways on Apple Maps in light mode and over dark roads in dark mode. Coder checks both platforms and both schemes and records a screenshot note; adjust width, not the token, if a pair is weak.
- Dashed = "not a real route" is the only visual difference between the modes, so a sighted user can tell them apart without reading. The caption below also says it (never colour only).
- Camera: unchanged (`fitToCoordinates` on the STOPS, padding 48). If the route bulges outside, that is acceptable; do not fit to all route points.
- Performance: one `Polyline` per layer, coordinates memoised; do not render per-leg polylines.
- Map a11y label: "Map of the trip route with {n} stops{, following roads}. The stop list below has the same information." (append the phrase only for a road route).
- `trip-map.web.tsx`: ignores the new props.

### 3.2 Caption under the map (Route section)

| State | Caption (`caption`, `textMuted`) |
|---|---|
| Road route, Driving | "Route along roads for driving." |
| Road route, Walking | "Route along paths and roads for walking." |
| Road route, Cycling | "Route along roads and bike paths for cycling." |
| Fallback | "Lines connect the stops in order. They do not follow roads." (replaces the MVP sentence that said "not a driving route", which is wrong for walking and cycling) |

### 3.3 Info tiles and mode indicator

Keep three tiles. Only the Distance tile changes:

| State | Icon | Value | Label | A11y label (tile row sentence part) |
|---|---|---|---|---|
| Road route | the mode icon (`car`/`walk`/`bike`) | "12.4 km" (no "~") | "Distance" | "12.4 kilometres by road, driving" (walking/cycling: "by path and road, walking"/"..., cycling") |
| No route | `route` | "~12.4 km" (as today) | "Distance" | "About 12.4 kilometres in a straight line" |
| Fewer than 2 stops | `route` | "-" | "Distance" | as today |

Use `formatDistance(route_distance_m / 1000)`; the "~" prefix and the straight-line wording remain ONLY for the haversine value.

Duration is shown once, not in a tile: in the Route section header row, right-aligned `caption` `textMuted` with the mode icon (14 px): "~3 h 20 min". Shown only for a road route. Add `formatDuration(seconds)` in `src/lib/format-duration.ts` (pure, tested): under 60 s -> "1 min"; under 60 min -> whole minutes ("45 min"); under 24 h -> "3 h 20 min" (drop " 0 min": "3 h"; round minutes to 5 once above 1 h); 24 h or more -> "1 d 4 h". Tester vectors: 30 s -> "1 min"; 2,700 s -> "45 min"; 7,200 s -> "2 h"; 12,100 s -> "3 h 20 min"; 100,000 s -> "1 d 4 h". Prefix "~" because ORS durations ignore traffic. A11y: "About 3 hours 20 minutes".

### 3.4 Follow this trip

The stored `travel_mode` is passed to the maps apps (also when no road route exists, and for old trips: default `driving`, identical to today).

| Mode | Google Maps `travelmode` | Apple Maps `dirflg` |
|---|---|---|
| Driving | `driving` | `d` |
| Walking | `walking` | `w` |
| Cycling | `bicycling` | omit the parameter (Apple's URL scheme has no documented cycling flag; Apple chooses its default) |

Coder: verify both against the current Google Maps URLs and Apple Maps URL scheme docs before coding, and note the result. Everything else in DESIGN-mvp 9.4 is unchanged (origin = first stop, waypoints, legs of 11 points, iOS app sheet). The apps compute their own route, so it may differ from the stored line; no copy is needed for that. Apple Maps sheet label for cycling: unchanged "Apple Maps (start and end only)".

---

## 4. Edge cases

| Case | Behaviour |
|---|---|
| 0 stops | No Route section, no routing call (as MVP) |
| 1 stop | No routing call, `route_status = null`, no polyline (marker only), Distance "-", no duration, no owner notice, caption as MVP for a single stop (the Route caption is hidden when only one stop). Follow uses the single-stop URL with the stored mode |
| 2+ stops, all at one point (distance under 10 m) | No call needed; treat like 1 stop |
| Edit: stops reordered, added, deleted, moved, or mode changed | Route is stale. Save recomputes (2.2). If routing fails there, the old geometry must NOT be drawn: status becomes `error`/`none` and the detail shows the dashed fallback |
| Edit: only text/photos/visibility changed | No routing call; route kept |
| Edit down to 1 stop | Stored route cleared (status `null`) |
| Old trips (no route, status `null`, 2+ stops) | Dashed straight line + fallback caption, `travel_mode` = driving. No owner notice (it would nag about something never attempted). The next edit-save computes the route (`needsRoute` true because status is `null`). Optional later: backfill job |
| Partial failure: stops saved but route step crashed before writing | Status stays `null`/`error`; same as old trips or failure; never a stale line |
| Offline while viewing | Trip detail loads like today (existing error/retry states). The route comes with the trip payload, so a loaded trip shows it fully offline; nothing extra to fetch |
| Offline while publishing/saving | Earlier steps hit the existing `network` error card with Retry. If connectivity drops only at the route step, it is treated as a routing failure (2.3) and the following steps then surface the normal network error if they fail; on Retry the route step runs again if not `ok` |
| Offline when tapping "Try again" | Same inline "Still can't reach the route service. Try again later." |
| Slow ORS | 20 s client timeout, then fallback; the spinner never blocks longer |
| Mode changed back to its original value before saving | Counts as unchanged; no call |
| Draft restored from an older app version | `travelMode` missing -> Driving |
| Private trip | Same route data and rules; only the owner can ever trigger recompute (server-side ownership check, per-user rate limit; the UI treats rate limiting as `unavailable`) |
| Very long routes | Server simplifies geometry; UI draws what it is given |

---

## 5. Copy (single source)

"Travel mode", "Driving", "Walking", "Cycling", "Used to draw your route along roads and paths between stops.", "Used to draw your route between stops" (a11y hint), "Calculating route", "Calculating route...", "Straight lines used", "Calculating route. Straight lines used." (a11y), "We couldn't reach the route service, so lines connect your stops in a straight line for now.", "There's no road route between some of your stops, so lines connect them in a straight line.", "These stops are too far apart for a walking route, so lines connect them in a straight line." (cycling: "cycling route"), "Try again", "Edit trip", "Still can't reach the route service. Try again later.", "Route along roads for driving.", "Route along paths and roads for walking.", "Route along roads and bike paths for cycling.", "Lines connect the stops in order. They do not follow roads."

---

## 6. Coder checklist (files, additive)

- `ui/segmented-control.tsx`, `IconName` + `car`/`walk`/`bike`.
- Trip form: field `travelMode` in `TripFormValues`, draft, `lib/trip-form.ts` default and diff helper `needsRoute(initial, form, storedStatus)`.
- `lib/trip-publish.ts` and `lib/trip-save.ts`: `route` step, 20 s timeout, never throws into the pipeline, returns `{ status, reason }`; `PublishProgress` row with skipped state.
- `components/trip/trip-map.tsx`: `route`, `travelMode`, casing + dashed fallback; `lib/format-duration.ts`; Distance tile branch; caption branch; owner notice card; Follow `travelmode`/`dirflg`.
- No hard-coded colours; reduce-motion unaffected (no new animation).

## 7. Tester checklist

- Form: default Driving on create; value persists in draft and in edit; radiogroup/radio roles read "Driving, selected"; 48 px targets; font scale 200% switches to stacked rows without clipping; dark mode selected state visible without colour.
- Publish with 2+ stops: row "Calculating route" appears between "Saving stops" and "Finishing up"; trip lands on detail with a solid casing + coral line along roads; distance and duration tiles match the stored values; mode icon matches.
- Force failures (kill the Edge Function URL, return 429, two stops across sea, walking Hanoi to Ho Chi Minh City): publish still completes; row shows "Straight lines used"; detail shows dashed line, fallback caption, and the owner notice with the correct copy; non-owner sees no notice.
- "Try again" succeeds after the service is restored and the notice disappears; fails with the inline helper while down.
- Edit: reorder, move a location, change mode each recompute; changing only the title does not call the function (check network log); `none` status with no relevant change does not call again.
- Reduce to 1 stop: route cleared, no line. Old trip without route: dashed line, no notice, mode driving, Follow identical to before; after an edit-save it gets a route.
- Follow: Google `travelmode` and Apple `dirflg` per mode for 1, 5 and 20 stops; cycling on Apple has no `dirflg`.
- Airplane mode: loaded trip still renders the stored route; publish offline gives the existing network card; dropping offline only at the route step still completes or shows the normal network retry for later steps.
- Light/dark on iOS and Android: line readable over highways and parks, markers above the line, dashed pattern visible.
