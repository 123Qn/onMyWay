# Official showcase trips: seed tool

Seeds the 10 trips in `trips.json` into Supabase as the official account, through the same data path the app uses
(`trips` insert, cover upload to bucket `trip-photos` at `{uid}/{tripId}/{id}.jpg`, `save_trip_stops` RPC,
`compute-trip-route` Edge Function, visibility set last). It only uses the anon key and a normal user sign-in; never the service_role key.

Requirements: Node 20+, `npm install` already run in the repo. No extra dependencies.

## Owner steps

1. **Create the account in the app.** Sign up with a real email and password, set the username to `onmyway` and the display name to `onMyWay`
   (see `account` in `trips.json`). Confirm the email if Supabase asks.
2. **Fill the env files.**
   - Root `.env` must have `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` and `NOMINATIM_CONTACT_EMAIL` (a project email, used in the Nominatim User-Agent).
   - `cp scripts/seed-official/.env.example scripts/seed-official/.env` and fill `SEED_EMAIL` and `SEED_PASSWORD`. This file is git-ignored.
3. **Verify coordinates.** `node scripts/seed-official/seed.mjs verify`
   - Checks the JSON against the app limits (title/stop name 120 chars, texts 5000, 1-20 stops, lat/lng range) and geocodes every stop with Nominatim (1 request/s, about 1 minute for 54 stops).
   - Prints the distance between the geocoded point and our coordinates; `FLAG >300m` and `NOT FOUND` rows need a look.
     Nominatim often returns the centroid of a large feature (a beach, a park) or cannot find a Vietnamese or very specific name, so a flag is a hint, not proof.
     Check flagged stops on a map and edit `trips.json` by hand. The tool never modifies `trips.json`.
   - Writes `verify-report.json` (git-ignored) with the geocoded suggestions.
4. **Download cover candidates.** `node scripts/seed-official/seed.mjs fetch-covers`
   - Queries Openverse (commercial-use licences only) with each trip's `cover_query`, shortening the query if it finds too few results,
     and saves up to 3 candidates to `scripts/seed-official/covers/<slug>/1.jpg, 2.jpg, 3.jpg` plus `credits.json`
     (title, creator, license, license_url, source_url).
   - Open the folders, look at the images (and the source pages for licence terms), then **copy** the best one to `cover.jpg` in the same folder
     (`cp covers/<slug>/2.jpg covers/<slug>/cover.jpg`). Copy, do not rename: the seed matches `cover.jpg` to a candidate by file hash to find the credit.
   - Image size: the tool downloads the original file and falls back to Openverse's thumbnail (about 600 px wide) if the original fails or is over 8 MB.
     The app normally stores covers as 1280x1600 (4:5) JPEG. There is no resizer here (no `sharp`), so the seed uploads the file as is. The app displays it cropped,
     so landscape images work. If you want a tight 4:5 crop or a smaller file, edit the chosen candidate (`N.jpg`) in place first, then copy it to `cover.jpg`
     (editing `cover.jpg` alone breaks the hash match).
5. **Dry run.** `node scripts/seed-official/seed.mjs seed --dry-run` lists which trips are ready (validates JSON and covers, no network, no sign-in).
6. **Seed.** `node scripts/seed-official/seed.mjs seed`
   - Signs in, then for each trip: skips it if a trip with the same title already exists for the account, otherwise inserts it as `private`, uploads the cover,
     saves the stops, computes the route and finally sets the visibility from the JSON. The description gets `Cover photo: <title> by <creator>, <license>` appended.
   - Routing is limited to 5 calls per 10 minutes per user, so the tool waits automatically after every 5th trip (expect about 10 minutes of waiting for 10 trips).
     Leave it running.
   - Prints a summary table (trip id, route status, distance).

## Flags and re-runs

- `--only <slug>` works with all subcommands (for example `seed --only hoi-an-ancient-town-walk`).
- `--dry-run` (seed only): validate without touching Supabase.
- `--routes-only` (seed only): do not create anything, just call `compute-trip-route` again for existing trips (use it when the summary shows route `error`).
- Re-running `seed` is safe: existing titles are skipped. If a run dies after the private trip row was created but before it finished (the tool prints the trip id),
  delete that private trip in the app, then re-run.
- To update a trip that already exists, edit or delete it in the app; the seed never overwrites.
