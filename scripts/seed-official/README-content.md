# Official showcase trips: content notes

`trips.json` holds 10 public showcase trips for the official `@onmyway` account.

## Mix
- Sydney and NSW (4): Bondi to Coogee (walking), Harbour icons (walking), Blue Mountains (driving), Royal National Park to Kiama (driving).
- Elsewhere in Australia (3): Great Ocean Road (driving), Melbourne laneways (walking), Gold Coast to Byron Bay (driving).
- Vietnam (3): Hội An old town (walking), Hải Vân Pass loop (driving), Hà Nội Old Quarter food walk (walking). Vietnamese trips are written in Vietnamese with a short English tip.

## Limits respected (from src/lib/trip-form.ts)
Title at most 120 characters, stop name at most 120, description and notes at most 5000, 1 to 20 stops (here 5 to 6).

## Choices
- Notes are evergreen: no prices, opening hours or tickets.
- Coordinates are well-known landmark or car park locations, rounded to 4 to 5 decimals. No stops are placed in the sea.
- Distances stay within realistic limits for each mode.
- `cover_query` is a search phrase for a royalty-free photo (Unsplash or Pexels). Check the licence before use.

## Verify before seeding
Coordinates were written from memory, not checked against a map. Spot-check these on a map first:
- Hội An: Quan Công, Tấn Ký, Phúc Kiến (could be off by about 100 m).
- Hà Nội: Mã Mây, Tạ Hiện, Ô Quan Chưởng.
- Wentworth Falls Lookout, Wattamolla, Garie Beach, and the Burleigh Heads headland.

The Hải Vân route may be routed through the tunnel by ORS. The notes mention the old pass road.
