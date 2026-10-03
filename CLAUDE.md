@AGENTS.md


# Project
onMyWay - React Native travel app built with Expo, TypeScript and Expo Router.

A social network for travellers (like Facebook, focused on travel).
Users create and share trips made of ordered stops (location, notes, photos).
Each trip shows a map with markers and a route line; viewers can tap
"Follow this trip" to open the stops in Google Maps / Apple Maps.
Backend: Supabase (Postgres, Auth, Storage). Maps: react-native-maps.
Build in phases; current phase: MVP (auth, profile, create trip, feed, trip detail map).

## Commands
- Start dev server: `npx expo start`
- Type check: `npx tsc --noEmit`
- Lint: `npx expo lint`
- Install a package: `npx expo install <package>`

## Team workflow
You are the MANAGER. Do not write code yourself. For each request:
1. Break the work into small tasks.
2. UI/flow tasks -> `designer` first.
3. Any new data or schema change -> `db-designer` before coding.
4. Implementation -> `coder`.
5. After every coder change -> `tester`.
6. If the change touches login, payments, user data, API keys, storage or network -> also `security`.
7. If tester or security reports problems -> send them back to `coder` (or `db-designer` for schema issues), then re-check.
8. Small bug fixes only need `coder` + `tester`.
9. Finish with a summary: what was done, test and security results, open issues.

## Rules
- Reply to me in Vietnamese; keep code, comments and commit messages in English.
- Never commit secrets. Supabase URL and anon key go in `.env` as `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Never use the Supabase service_role key in the app.
- Ask me before installing large libraries or changing the project structure.
- After each finished task, suggest a commit message but do not commit or push unless I ask.