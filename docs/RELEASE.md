# Release guide (EAS Build)

Project: `onMyWay`, Android package `com.quanh.onmyway`, EAS account `quanh`.
Build profiles live in `eas.json` (no secrets in it).

| Profile       | Use                                   | Output | Environment   |
| ------------- | ------------------------------------- | ------ | ------------- |
| `development` | Dev client (replaces Expo Go)         | APK    | `development` |
| `preview`     | Internal testing of a release build   | APK    | `preview`     |
| `production`  | Play Store                            | AAB    | `production`  |

`appVersionSource` is `remote`: EAS owns the Android `versionCode`; `production` uses
`autoIncrement`. Do not edit `versionCode` by hand.

## 1. Link the project (once)

```bash
npx eas-cli@latest login          # or: npx eas-cli whoami
npx eas-cli@latest init           # creates the EAS project, writes extra.eas.projectId / owner
```

`init` adds the project ID to the app config. `app.config.ts` is dynamic, so if the CLI cannot
write it, add the printed `extra.eas.projectId` (and `owner: 'quanh'`) manually and commit it.
The project ID is not a secret.

## 2. Environment variables

`app.config.ts` reads `GOOGLE_MAPS_ANDROID_API_KEY` and `NOMINATIM_CONTACT_EMAIL` at config time,
and the app bundle reads `EXPO_PUBLIC_*` at bundle time. On EAS Build these must exist as EAS
environment variables, because `.env` is git-ignored and not uploaded.

Create them for each environment (`development`, `preview`, `production`), via the
expo.dev dashboard (Project -> Environment variables) or CLI:

| Name                              | Visibility  | Why                                                                 |
| --------------------------------- | ----------- | ------------------------------------------------------------------- |
| `EXPO_PUBLIC_SUPABASE_URL`        | Plain text  | Inlined into the JS bundle (public by design)                       |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY`   | Sensitive   | Public anon key; `EXPO_PUBLIC_*` cannot be "secret". RLS protects data |
| `GOOGLE_MAPS_ANDROID_API_KEY`     | Sensitive   | Config-time only; ends up in the native manifest. Restrict it in Google Cloud |
| `NOMINATIM_CONTACT_EMAIL`         | Sensitive   | Config-time only; sent in the Nominatim User-Agent                  |
| `EXPO_PUBLIC_WEB_BASE_URL`        | Plain text  | Optional. Base URL for https share links (`src/lib/share.ts`); unset = `onmyway://` scheme |

Visibility notes:

- Both "Plain text" and "Sensitive" values are available to the build and to `app.config.ts`
  (`process.env`). Sensitive values are hidden in logs/dashboard and cannot be pulled back.
- "Secret" is also readable during the build, but cannot be used for `EXPO_PUBLIC_*` and cannot be
  pulled locally; prefer Sensitive so you can still verify with `eas env:pull`.
- Never create the Supabase `service_role` key as an env var for this app.

Example (run by the owner, values typed locally, not committed):

```bash
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_URL --visibility plaintext
npx eas-cli env:create --environment preview --name EXPO_PUBLIC_SUPABASE_ANON_KEY --visibility sensitive
npx eas-cli env:create --environment preview --name GOOGLE_MAPS_ANDROID_API_KEY --visibility sensitive
npx eas-cli env:create --environment preview --name NOMINATIM_CONTACT_EMAIL --visibility sensitive
# repeat with --environment development and --environment production
npx eas-cli env:list --environment preview
```

(`env:create` prompts for the value if `--value` is omitted. Check `eas env:create --help` if flags differ in your CLI version.)

## 3. First builds (Android)

`expo-dev-client` is installed (required by the `development` profile's `developmentClient: true`).
After any native dependency change, rebuild the local dev build with `npx expo run:android`
(or a new `development` EAS build) before testing.

```bash
npx eas-cli build --profile development --platform android   # dev client APK
npx eas-cli build --profile preview --platform android       # release-like APK
```

On the first Android build, let EAS generate a keystore when asked. Install the APK from the build
page (QR code / link). `development` builds need `npx expo start --dev-client`.
Rebuild a dev client whenever a dependency with native code changes (see `package.json` bumps).

## 4. Google Maps key: add the EAS keystore SHA-1

The map is blank in EAS builds until the key accepts the EAS signing certificate.

1. `npx eas-cli credentials -p android`, choose the build profile, then
   "Keystore: Manage everything needed to build your project" and view the keystore
   details. Copy the **SHA-1** fingerprint.
2. Google Cloud Console -> APIs & Services -> Credentials -> your Android Maps key ->
   Application restrictions: "Android apps" -> Add:
   - Package name: `com.quanh.onmyway`
   - SHA-1: the value from step 1
3. API restrictions: keep only "Maps SDK for Android".
4. For Play Store builds, also add the **Play App Signing** SHA-1 (Play Console -> App integrity ->
   App signing key certificate), since Google re-signs the uploaded AAB.
5. Keep any debug-keystore SHA-1 you use locally as a separate entry.

## 5. Production build and submit

```bash
npx eas-cli build --profile production --platform android    # AAB, versionCode auto-incremented
npx eas-cli submit --profile production --platform android   # uploads to Google Play
```

`submit.production` in `eas.json` is a stub: internal track, draft release. Before the first submit:

- Create the app in Google Play Console (package `com.quanh.onmyway`) and upload the first AAB
  manually once (Play requirement).
- Create a Google Service Account key with Play Console access, then either upload it through
  `eas submit` when prompted or set `submit.production.android.serviceAccountKeyPath` to a
  path outside the repo. Never commit the JSON key.
- Promote the track (`internal` -> `production`) in Play Console or change `track` in `eas.json`.

## 6. Pre-release checklist

- `npx expo install --check`, `npx expo-doctor`, `npx tsc --noEmit`, `npx expo lint` pass.
- All four env vars exist in the target EAS environment.
- Supabase migrations are applied to the target project; redirect URLs include scheme `onmyway://`.
- Maps key restricted to package + SHA-1 (section 4).
