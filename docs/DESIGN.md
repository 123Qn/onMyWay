# onMyWay - Design system and screen redesign ("UI refresh")

Audience: coder, tester, manager. Branch: `ui-refresh`. Status: v2, owner decisions FINAL (no open questions remain).

## Owner decisions (final)

| # | Decision | Where it is specified |
|---|---|---|
| 1 | `#C73A10` (`primary`) for all text and for buttons that carry text. The tab-bar "+" is icon-only and uses bright coral `#F2592B` (3.6:1 with a white icon, meets the 3:1 non-text rule). Dark mode "+" = `#FF7A4D` fill with a `#240B02` icon | 2.2 (`fab`, `onFab`), 3.9 |
| 2 | Font: Plus Jakarta Sans | 2.3 |
| 3 | Custom floating tab bar approved (blur on iOS, solid on Android) | 3.9, 4 |
| 4 | "+" moves from the Feed header to the tab bar centre (supersedes PLAN decision #6) | 3.9, 4, 5.1 |
| 5 | Profile cover derived from the newest trip cover, gradient fallback | 5.2 |
| 6 | Profile stats via new RPC `get_profile_stats(p_user_id)` (migration 0003, SECURITY INVOKER; others see public trips' counts only, the owner sees all; returns trips, stops, photos). db-designer writes it | 5.2 |
| 7 | Own profile: single "Trips" tab; private trips show a lock badge | 3.7, 5.2 |
| 8 | Distance in km only | 5.3 |
| 9 | Time-of-day greeting "Good morning / Good afternoon / Good evening, {firstName}" | 5.1 |
| 10 | Temporary logo: wordmark "onMyWay" + map-pin mark (`assets/brand/logo.svg`, `assets/brand/mark.svg`). Auth tagline "Share the journey. Follow the way." | 3.13, 8.1 |
| 11 | Feed card 4:5; create/edit trip cover crop changes from 16:9 to 4:5 | 3.11, 5.6 |

References: `docs/design-refs/refs-social.png` ("ref-social": coral primary, pill buttons, full-bleed image cards with overlaid author, floating tab bar with a round centre "+", cover + overlapping avatar profile, underline tabs, 2-column grid) and `docs/design-refs/refs-travel.png` ("ref-travel": ivory background, white rounded cards, greeting header, info tiles, rounded cover image, photo strip, frosted floating tab bar and floating CTA).

## 0. Relationship to the MVP spec

`docs/DESIGN-mvp.md` is the unchanged previous `DESIGN.md` (steps 4-10). It STILL DEFINES behaviour, states, copy, validation, data flow, error handling, a11y behaviour and tester checklists. This document only changes the look, the layout of some screens and a few entry points. Where this document is silent, the MVP spec wins. Where they conflict, this document wins for the items below.

Explicit overrides of the MVP spec:

| MVP spec | Now |
|---|---|
| 1.2 teal palette, 1.3 radii, 1.4 system font | Sections 2.2, 2.5, 2.3 below |
| 3.1 Button radius `Radius.md` | Pill (`Radius.full`) |
| 8.1 Feed header "Feed" + "+" `IconButton` | Greeting header (5.1); the "+" lives in the tab bar (4). Empty-state CTAs unchanged. PLAN decision #6 ("+" in the Feed header) is replaced by "centre + in the tab bar" |
| 8.3 TripCard (author row above 16:9 cover, solid private badge in meta row) | Full-bleed 4:5 image card with overlay (3.11, 5.1). The private badge may now sit ON the image (dark pill, contrast guaranteed) |
| 7.1/7.2 ProfileHeader (centred avatar + one stat line) | Cover + overlapping avatar + 3 stats (RPC `get_profile_stats`) + single "Trips" underline header + 2-column grid (5.2) |
| 11.x trip form cover crop 16:9 | 4:5 (5.6) |
| 9.2 Trip detail order and sticky bar | New order, info tiles, floating Follow button (5.3). Map stays inline |
| PLAN 1.2 "NativeTabs" | JS tabs with a custom floating bar (4) |
| MVP 3.8 / 8.2 "compact" TripCard | Replaced by the `grid` variant on profiles (kept in code until unused) |

Nothing in this document changes: data fetching, hooks, validation rules, copy strings (unless stated), route tree, guards, accessibility behaviour (labels, roles, announcements).

---

## 1. Design principles

1. Warm, light, friendly: ivory canvas, white cards, one strong coral accent, photos are the hero.
2. Big radii, soft shadows, generous spacing. No hard borders on cards (inputs keep an accessible border).
3. One accent colour. Coral means "action or current location in the app", never decoration on text.
4. Text on photos always sits on a scrim that guarantees contrast (2.7).
5. Everything works in dark mode with the same layout; only surfaces, shadows and glass change.
6. Light motion; every animation has a reduce-motion fallback (2.9).

---

## 2. Design tokens (`src/constants/theme.ts`)

### 2.1 Compatibility rules (read first)

- All existing exports stay: `Colors`, `ThemeColor`, `Fonts`, `Spacing`, `BottomTabInset`, `MaxContentWidth`, `Radius`, `Layout`, `Duration`, `Typography`. Key NAMES never change; VALUES change (this is the refresh). New keys are added to BOTH `light` and `dark`.
- `useTheme()` still returns `Colors[scheme]`. `ThemedText` `type` union only grows. `ThemedView type` still takes any `ThemeColor`.
- Aliases keep working: `surface === backgroundElement`, `textMuted === textSecondary`, `border === backgroundSelected` (same value in each mode). New code uses the new names.
- Typography entries LOSE `fontWeight` and GAIN `fontFamily` (2.3). Every `fontWeight:` literal in `src/` must be migrated (list in 9, step 2).
- No hard-coded colours in components. The hex literals found today (`#FFFFFF` in cover-picker, stop-photo-strip, `[id].tsx`, profile/edit, photo-strip, trip-map, location-picker-map; `#000` shadow in pick-location; blue gradient in animated-icon) move to tokens (`onImage`, `Shadow`, brand gradient).

### 2.2 Colours

Rationale for the coral (owner decision 1): ref-social uses about `#F04E23` (white on it is only 3.6:1, fails AA for normal text). `primary` `#C73A10` is therefore a slightly deeper coral that passes 4.5:1 with white text and as text on ivory/white; it is used for ALL text and every button that carries text. The brighter brand coral `primaryBright` `#F2592B` is for DECORATIVE use and for the ICON-ONLY tab-bar "+" (white icon 3.6:1, meets the 3:1 non-text rule). Never for text and never as a text background.

| Token | Light | Dark | Use |
|---|---|---|---|
| `background` | `#FAF7F2` | `#14110F` | Screen canvas (ivory / warm near-black) |
| `backgroundElement` = `surface` | `#FFFFFF` | `#1E1A17` | Cards, sheets, tiles, input fill, tab-bar solid fallback |
| `surfaceMuted` (new) | `#F3EEE7` | `#26211D` | Secondary button fill, chips, input fill inside a card, skeleton container |
| `backgroundSelected` = `border` | `#EAE3DA` | `#332D28` | Decorative dividers, hairlines, pressed fill. NOT for input outlines |
| `borderStrong` | `#8C8279` | `#7A6F65` | Input outlines, dashed pickers, radio rings (>= 3:1 non-text) |
| `text` | `#1C1815` | `#F7F2EC` | Body and titles |
| `textSecondary` = `textMuted` | `#6B625A` | `#B9AEA3` | Secondary text |
| `primary` | `#C73A10` | `#FF7A4D` | Text buttons, links, active icons, focus ring (NOT the "+" fill, see `primaryBright`) |
| `primaryPressed` | `#A32C09` | `#FF9770` | Pressed state; ALSO the text/icon colour on `primarySoft` |
| `primaryBright` (new) = `fab` | `#F2592B` | `#FF7A4D` | Tab-bar "+" fill (icon-only) and decorative use: gradients, underline glow, seeded fallbacks. No text on it |
| `onFab` (new) | `#FFFFFF` | `#240B02` | "+" icon colour. Light 3.6:1 on `#F2592B` (>= 3:1 non-text); dark about 7.5:1 on `#FF7A4D` |
| `fabPressed` (new) | `#C73A10` | `#FF9770` | "+" pressed fill |
| `onPrimary` | `#FFFFFF` | `#240B02` | Text/icon on `primary` |
| `primarySoft` | `#FDE9E1` | `#3A1E14` | Selected chip, active tab capsule, icon circles, avatar fallback. Text on it: `text` or `primaryPressed` |
| `danger` | `#B3261E` | `#FF8F85` | Errors, destructive (deliberately crimson, distinct from the orange primary; error is always icon + text) |
| `onDanger` | `#FFFFFF` | `#2A0A07` | On solid danger |
| `dangerSoft` | `#FCEAE8` | `#3B1D1A` | Error banner fill |
| `success` | `#1B7F3B` | `#5FD38A` | Success text/icon |
| `skeleton` | `#EBE5DD` | `#2B2622` | Skeleton base |
| `skeletonHighlight` | `#F6F1EA` | `#38322C` | Pulse target |
| `overlay` | `rgba(20,12,8,0.5)` | `rgba(0,0,0,0.6)` | Modal scrims |
| `onImage` (new) | `#FFFFFF` | `#FFFFFF` | Text/icons on photo scrims |
| `onImageMuted` (new) | `#F2EDE6` | `#F2EDE6` | Secondary text on photo scrims |
| `scrimChip` (new) | `rgba(0,0,0,0.55)` | `rgba(0,0,0,0.55)` | Pill background on photos (private badge, stop count) |
| `glassFill` (new) | `rgba(255,255,255,0.90)` | `rgba(30,26,23,0.88)` | Tint laid over the blur on tab bar and glass buttons |
| `glassBorder` (new) | `rgba(255,255,255,0.65)` | `rgba(255,255,255,0.10)` | 1 px edge of glass surfaces |
| `glassSolid` (new) | `#FFFFFF` | `#26211D` | Fallback when blur is unavailable (Android) or Reduce Transparency is on |
| `backgroundTransparent` (new) | `rgba(250,247,242,0)` | `rgba(20,17,15,0)` | Start colour of bottom fades (same hue as `background`, avoids grey banding) |
| `shadow` (new) | `#2B1A10` | `#000000` | Shadow colour token (2.6) |

Contrast (WCAG relative luminance; the coral pairs in light mode were hand-computed, the other values are estimates, so the coder MUST re-check every pair with a script or tool and record the results in the PR; adjust a hex only if a pair falls below its target):

| Pair | Light | Dark |
|---|---|---|
| `text` on `background` / `surface` | 16.5 / 17.5 | 15.2 / 14.6 |
| `textMuted` on `background` / `surface` / `surfaceMuted` | 5.6 / 6.0 / 5.2 | 7.5 / 7.2 / 6.6 |
| `onPrimary` on `primary` | 5.2 | 7.3 |
| `primary` as text on `background` / `surface` | 4.9 / 5.2 | 7.3 / 6.8 |
| `primary` as text on `surfaceMuted` | 4.5 (limit) | 6.6 |
| `primaryPressed` on `primarySoft` | 6.1 | 7.4 |
| `primary` on `primarySoft` | 4.4 - NOT allowed for text (icons/non-text only, need 3:1) | 5.9 |
| `onFab` on `primaryBright` (icon-only, needs 3:1) | 3.6 | 7.5 |
| `danger` on `background` / `dangerSoft` | 6.1 / 5.6 | 8.5 / 7.0 |
| `borderStrong` on `background` / `surface` / `surfaceMuted` | 3.5 / 3.8 / 3.3 | 3.8 / 3.2 / 3.3 |
| `onImage` on scrim (worst case white photo, alpha >= 0.6) | 5.7+ | 5.7+ |

Rules:
- `primary` as TEXT is allowed on `background` and `surface` only. On `surfaceMuted`/`primarySoft` use `primaryPressed` (affects: ghost button on muted fills, avatar initials, chip text).
- Never put text on `primaryBright` (its only foreground is the icon-only "+", with `onFab`). White text on a gradient is allowed only on the brand hero (3.13) whose stops all pass 4.5:1.
- Error is never colour-only (icon + text), as in MVP.

### 2.3 Typography

Decision (owner, final): Plus Jakarta Sans (package `@expo-google-fonts/plus-jakarta-sans`). Why over Inter: its geometric, slightly rounded forms match the soft, friendly look of both references and give the app a recognisable personality, while Inter reads as neutral/"default". It covers Vietnamese (the owner and likely first audience) with full diacritic support, ships static weights, and has the same licence (OFL). Trade-off: it is a little wider than Inter, so scale sizes below were kept at MVP values and line heights are generous (1.4-1.5). Components never name a font (only `FontFamily` constants), so a future swap is a one-file change.

Weights to load (4 static files, about 100 KB each; no italics, no 800):

| Key (`FontFamily`) | Font name registered | Use |
|---|---|---|
| `regular` | `PlusJakartaSans_400Regular` | body |
| `medium` | `PlusJakartaSans_500Medium` | caption, `small` |
| `semibold` | `PlusJakartaSans_600SemiBold` | labels, buttons, subheading |
| `bold` | `PlusJakartaSans_700Bold` | display, title, heading, stats |

Loading (root `src/app/_layout.tsx`):
- Install with `npx expo install @expo-google-fonts/plus-jakarta-sans expo-font` (`expo-font` is already a dependency).
- `const [fontsLoaded, fontError] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold })` in `RootLayout` (import the font objects from the package; `useFonts` from `expo-font` or from the package, coder checks the SDK 57 `expo-font` docs).
- The splash screen is already held with `SplashScreen.preventAutoHideAsync()`. Change the hide condition to `!isLoading && (fontsLoaded || fontError)`. `RootStack` already returns `null` while loading; keep that, also return `null` until fonts are ready (the splash covers it). On `fontError` continue with system fonts (never block the app) and log in dev only.
- Optional later optimisation: the `expo-font` config plugin can embed the fonts at build time (no async load, no flash); not needed now and needs a rebuild.
- Never combine `fontFamily: PlusJakartaSans_*` with `fontWeight` (Android synthesises bold on top of a bold file; iOS may pick a wrong face). Weight is chosen only through the family.
- `Fonts` (system) stays for `code` (mono) only. Add `FontFamily` export.

Scale (`Typography`, sizes px; sizes equal the MVP so layouts hold; `letterSpacing` in px):

| Variant | Family | size / lineHeight | letterSpacing | Use |
|---|---|---|---|---|
| `display` | bold | 34 / 42 | -0.4 | Auth hero wordmark |
| `title` | bold | 28 / 34 | -0.3 | Screen titles, greeting, profile name, trip title |
| `heading` | bold | 22 / 28 | -0.2 | Section headers, feed card title |
| `subheading` | semibold | 18 / 24 | 0 | Card titles, stop names |
| `body` | regular | 16 / 24 | 0 | Default |
| `bodyStrong` | semibold | 16 / 24 | 0 | Buttons (md/lg), emphasis |
| `label` | semibold | 14 / 20 | 0 | Field labels, small buttons, tab labels, grid titles |
| `caption` | medium | 12 / 16 | 0.1 | Metadata, helper, counters |
| `statValue` (new) | bold | 22 / 28 | -0.2 | Profile stats; add `fontVariant: ['tabular-nums']` |
| `code` | system mono | 12 / 16 | 0 | Existing |

`ThemedText` mapping (all existing keys kept): `default` -> body; `title` -> title; `subtitle` -> heading; `small` -> label with family `medium`; `smallBold` -> label with family `bold`; `link`/`linkPrimary` -> 14/20 semibold, colour `primary`; `code` -> code; `display`, `subheading`, `bodyStrong`, `caption` as above; NEW keys `heading`, `statValue`. Replace each `fontWeight: 'x'` override by a `fontFamily`.

Dynamic Type / font scaling: `allowFontScaling` stays on everywhere. `maxFontSizeMultiplier` defaults (set in `ThemedText`, overridable): `display`/`title`/`statValue` 1.6; `heading` 1.8; others 2.0 (never unbounded); text laid over photos, tab-bar labels, chips and info-tile values 1.3. No fixed heights on text containers, only `minHeight`.

### 2.4 Spacing and layout

`Spacing` unchanged (`half 2, one 4, two 8, three 16, four 24, five 32, six 64`). Rhythm: screen padding 16, gap between feed cards 16, grid gap 12, section gap 24, card inner padding 16, auth padding 24.

```ts
Layout = {
  minTouchTarget: 44,
  controlHeight: { sm: 36, md: 48, lg: 56 },   // unchanged; sm keeps hitSlop
  inputHeight: 52,                             // new
  screenPadding: 16,
  gridGap: 12,                                 // new
  iconSize: { sm: 16, md: 20, lg: 24, xl: 32 } // unchanged
}
TabBar = { height: 64, margin: 16, maxWidth: 420, fab: 56, fabLift: 20, bottomMin: 12 }   // new
```

Tab-screen bottom inset = `TabBar.height + bottomOffset + TabBar.fabLift + Spacing.two`, where `bottomOffset = max(insets.bottom - 8, TabBar.bottomMin)`. Expose it as `useTabBarInset()` (hook, `src/hooks/use-tab-bar-inset.ts`). `Screen tabBarInset` uses the hook; the `BottomTabInset` export stays (deprecated, value 100) until nothing imports it.

### 2.5 Radii

`Radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, xxl: 36, full: 9999 }` (xs and xxl new; values of sm/md/lg/xl change).

| Element | Radius |
|---|---|
| Buttons, chips, badges, tab bar, search pill, avatars | `full` |
| Inputs | `md` |
| Cards, info tiles, grid tiles, stop cards, banners, photo tiles in strips | `lg` |
| Feed cards, trip cover, profile cover, map card, modals' content cards | `xl` |
| Auth hero bottom corners, bottom sheets | `xxl` |
| Thumbnails, small photo tiles | `md` |

### 2.6 Shadows and elevation

Token `Shadow` (function `shadow(theme, level)` returning a style object). iOS uses `shadow*`; Android uses `elevation` (shadow colour via `shadowColor` works on Android 9+; below that it is black, acceptable).

| Level | iOS (light): offset / opacity / radius | Android elevation | Use |
|---|---|---|---|
| `sm` | (0,2) / 0.06 / 6 | 2 | Tiles, grid tiles, stop cards |
| `md` | (0,6) / 0.10 / 16 | 4 | Feed cards, trip cover, map card, input focus |
| `lg` | (0,10) / 0.14 / 24 | 8 | Floating tab bar, floating buttons, pick-location search/confirm cards |
| `fab` | (0,8) / 0.35 / 14, colour `primaryBright` for the "+", `primary` for the floating Follow button | 8 | Centre "+" and the floating Follow button |

Dark mode: shadows are nearly invisible on dark surfaces, so use opacity x2 (black) AND separate surfaces by value (`surface` `#1E1A17` on `background` `#14110F`) plus a 1 px `border` on cards. Light mode cards have no border.

Implementation rules (both are common bugs):
- iOS clips shadows when `overflow: 'hidden'` is on the same view. Cards with clipped images use two layers: OUTER view (bg colour, radius, shadow) and INNER view (`overflow: 'hidden'`, same radius) holding the image/gradient.
- Android elevation needs an OPAQUE `backgroundColor` on the shadowed view; a translucent glass bar therefore uses `glassSolid` on Android.

### 2.7 Gradients

A single wrapper component `Gradient` (`src/components/ui/gradient.tsx`) takes `colors`, `locations`, `start`, `end`, and renders `expo-linear-gradient` (7). All gradients are tokens in `Gradients`:

| Token | Colours and locations | Use |
|---|---|---|
| `imageScrim` | `rgba(16,10,6,0)` @0, `rgba(16,10,6,0.62)` @0.25, `rgba(16,10,6,0.90)` @1; vertical; covers the bottom 65% of a feed card | Feed card overlay |
| `tileScrim` | same stops; bottom 60% | Grid tile overlay |
| `fadeToBackground` | `backgroundTransparent` -> `background`; vertical; height = floating button area + 24 | Under the floating Follow button |
| `brand` | `#D6420F`, `#C73A10`, `#A32C09`; diagonal top-left -> bottom-right | Auth hero (white text allowed: every stop >= 4.5:1) |
| `coverFallbacks` (5) | coral `#FF9A6B -> #F2592B`; apricot `#FFC48A -> #F2592B`; dusk `#F2592B -> #8E3B6B`; sea `#2AA59B -> #1E6F8C`; sand `#E9C99B -> #D98A4E` | Profile cover with no photo, trip card with no cover. Seed index = (sum of UTF-16 codes of `username` or trip `id`) mod 5. No text sits on the lighter ones |

Scrim contrast rule (this is what makes white text legal): text on a photo must lie where scrim alpha >= 0.6. A feed card's text block is anchored to the bottom and limited to 40% of the card height (title 2 lines, `maxFontSizeMultiplier` 1.3): at 60% from the top the scrim alpha is already about 0.67. Worst case (pure white photo at 0.6 alpha) gives white-on-grey 5.7:1. Grid tile text block <= 36% of the tile height.

### 2.8 Blur and glass

- `GlassSurface` component (`src/components/ui/glass-surface.tsx`): props `intensity` (default 70), `radius`, `children`, `style`. iOS: `expo-blur` `BlurView` (`tint` = `light`/`dark` per scheme; check the SDK 57 docs for the exact tint names) with `glassFill` over it and a 1 px `glassBorder`. iOS 26+: may use `GlassView` from `expo-glass-effect` (already installed; `isLiquidGlassAvailable()` guards it; it renders a plain `View` elsewhere). Android and web: no blur, `glassSolid` + elevation (Android blur is experimental and costs frames; not worth it). If `AccessibilityInfo.isReduceTransparencyEnabled()` (iOS) is true: also `glassSolid`.
- Used by: floating tab bar, circular glass icon buttons over photos (`IconButton variant="glass"`).
- Text/icons on glass use `text`/`textMuted`. The 0.90 / 0.88 `glassFill` alpha is deliberate: it keeps `textMuted` >= 4.5:1 even above a black photo. If the owner wants airier glass, labels must be re-checked.

### 2.9 Motion

`Duration = { fast: 150, normal: 250, slow: 400, pulse: 900 }` (`slow` new). Easing: `Easing.out(Easing.cubic)` for entrances, `Easing.inOut(Easing.cubic)` for state changes. Use `react-native-reanimated` (installed 4.5.1).

| Where | Motion |
|---|---|
| Press feedback | Style change only, no animation: cards/tiles scale 0.98 and opacity 0.95; buttons colour change; FAB scale 0.94 |
| First feed page | Cards `FadeInDown` 250 ms, delay 60 ms x index, only the first 4 items and only on the initial load (not on pagination or refresh) |
| Underline tabs | Indicator slides 150 ms |
| Tab bar | Active capsule cross-fades 150 ms; no bounce |
| Images | `expo-image` `transition={200}` cross-fade |
| Skeleton | Existing pulse (unchanged) |
| Floating Follow button | Fade in 150 ms once the trip loaded |

Reduce Motion (`useReducedMotion()` from reanimated, or `AccessibilityInfo.isReduceMotionEnabled()` outside reanimated): no entrance animations, indicator jumps, image `transition={0}`, skeleton static (as MVP). Never use parallax, shared-element or looping animations.

### 2.10 Icons

Unchanged: `SymbolView` wrapper; sizes follow `Layout.iconSize`. New `IconName`s for this refresh: `route` (iOS `point.topleft.down.curvedto.point.bottomright.up`, Android `route`) for the Distance tile; `calendar` (`calendar` / `calendar_today`) for Published; `camera` (`camera` / `photo_camera`) for the Edit profile avatar badge. Existing `home`, `person`, `plus`, `pin`, `lock`, `map` cover the tab bar and cards. The wrapper has no filled variants, so the active tab is shown by the capsule plus colour, not by a filled glyph. The coder verifies every iOS and Material name against the installed types (TypeScript flags wrong names).

---

## 3. Components

All components keep the MVP prop contracts (additive changes only), read tokens through `useTheme()` and the scales, accept `style` and `testID`, and keep MVP accessibility behaviour. Sizes in px.

### 3.1 Button (`ui/button.tsx`)

- Shape: pill (`Radius.full`). Heights `Layout.controlHeight` 36/48/56 (min heights), horizontal padding 16 (sm) / 20 (md) / 24 (lg), icon gap 8, label `bodyStrong` (md, lg) or `label` (sm).
- `primary`: fill `primary`, text/icon `onPrimary`, pressed `primaryPressed`. `size="lg"` + `fullWidth` gets `Shadow.fab` ONLY when floating (prop `floating`, new, default false).
- `secondary` (restyled): fill `surfaceMuted`, no border, text `text`, pressed fill `backgroundSelected`. (ref-social "Message".) Its boundary is identified by its label so no 3:1 outline is required.
- `destructive`: fill `danger`, text `onDanger`, pressed opacity 0.85.
- `ghost`: transparent, text `primary` on `background`/`surface`; when placed on `surfaceMuted`/`primarySoft`, caller passes `tone="onSoft"` (new optional prop) which uses `primaryPressed`. Pressed fill `primarySoft`.
- States, loading, disabled (opacity 0.4), hitSlop for `sm`, roles and labels: as MVP 3.1.

### 3.2 TextField (`ui/text-field.tsx`)

API unchanged. Visual: label `label` above; input `minHeight 52`, radius `md`, fill `surface` (on the ivory canvas) or `surfaceMuted` when `variant="onCard"` (new optional prop, used inside white cards), border 1.5 `borderStrong`; focused: border 2 `primary` plus `Shadow.sm`-like soft ring (iOS only, `primary` at 0.15) ; error: border `danger`; disabled: opacity 0.5. Text `body`, placeholder `textMuted`, selection `primary`. Counter, helper, error, password toggle and a11y: MVP 3.2. Fix: replace `Typography.body.fontWeight` (text-field.tsx line 182) with `fontFamily: Typography.body.fontFamily`.

### 3.3 Card (new, `ui/card.tsx`)

| Prop | Type | Default |
|---|---|---|
| `children` | `ReactNode` | required |
| `variant` | `'elevated' \| 'flat'` | `'elevated'` |
| `padding` | `number` | `Spacing.three` (0 allowed for image cards) |
| `radius` | `keyof typeof Radius` | `'lg'` |
| `onPress` | `() => void` | none (when set: `Pressable`, role button, scale 0.98 pressed; caller supplies `accessibilityLabel`) |

`elevated`: fill `surface`, `Shadow.md` (two-layer clip pattern from 2.6), dark mode adds 1 px `border`. `flat`: fill `surfaceMuted`, no shadow. Used by: stop cards, form sections, stats, info tiles (as `Shadow.sm`), empty/progress dialogs.

### 3.4 InfoTile and Chip (new)

`InfoTile` (`ui/info-tile.tsx`): props `icon: IconName`, `value: string`, `label: string`, `accessibilityLabel?: string`. Layout: `Card` (radius `lg`, `Shadow.sm`, padding 12), centred column, gap 6: 32 px circle `primarySoft` holding the icon (18 px, `primaryPressed`), value `bodyStrong` (1 line, `adjustsFontSizeToFit`, `minimumFontScale 0.75`, `maxFontSizeMultiplier 1.3`), label `caption` `textMuted`. `minHeight 104`. Three tiles share a row with gap 12 and `flex: 1`. Not interactive: the row is one accessible element with a combined label ("5 stops. About 12.4 kilometres in a straight line. Published 12 March 2026").

`Chip` (`ui/chip.tsx`): props `label`, `icon?`, `tone: 'neutral' | 'primary' | 'onImage'`, `selected?`, `onPress?`. Height 32 (hitSlop to 44 when pressable), padding 12, radius `full`. `neutral`: `surfaceMuted` fill, `text`; `primary`/selected: `primarySoft` fill, `primaryPressed` text, icon `primary`; `onImage`: `scrimChip` fill, `onImage` text (stop count and private badge on photos). Text `label` or `caption`, `maxFontSizeMultiplier 1.3`.

### 3.5 Avatar (`ui/avatar.tsx`)

Sizes: sm 32, md 40, lg 64, xl 96, NEW `xxl` 112; `size` still accepts a number. New optional `ring?: 'none' | 'surface' | 'image'` (width 2, or 4 for xl/xxl): `surface` = ring in `background` colour (profile avatar overlapping the cover), `image` = ring in `onImage` (author on photo cards). Fallback: fill `primarySoft`, initials `primaryPressed` (changed from `primary`), family `bold`. Everything else as MVP 3.3.

### 3.6 IconButton (`ui/icon-button.tsx`)

Adds `variant="glass"`: 44x44 circle, `GlassSurface` fill, glyph `text`; used over photos and as floating controls. `filled` becomes `surfaceMuted`. Hit boxes stay >= 44. Everything else as MVP 3.8.

### 3.7 UnderlineTabs (new, `ui/underline-tabs.tsx`)

Props: `tabs: { key: string; label: string }[]`, `value: string`, `onChange(key)`, `style`. Row, full width, bottom hairline `border`. Each item `flex: 1`, height 48, label `label` (active `text`, inactive `textMuted`), role `tab`, `accessibilityState={{ selected }}`; container role `tablist`. Indicator: 3 px high pill, `primary`, width 40% of the item, centred under the active item, slides over `Duration.fast` (instant when reduce motion). With ONE tab (the profile "Trips" tab on both own and other profiles, owner decision 7): render the same visual as a non-interactive section header (role `header`, indicator shown) and no `tab` roles. Phase 2 adds items to the array without layout changes.

### 3.8 StatsRow (new, `profile/stats-row.tsx`)

Props `stats: { key: string; label: string; value: number | null }[]` (value `null` -> skeleton 32x22). Row with equal-width items separated by 1 px vertical dividers (`border`, height 28). Value `statValue`, label `caption` `textMuted` (singular/plural by value: "Trip"/"Trips"). Each item is one accessible element: "{n} trips". Row padding 16 vertical. Supports 3 to 5 items (phase 2: Followers, Following) without a redesign.

### 3.9 FloatingTabBar (new, `src/components/floating-tab-bar.tsx`) - see section 4 for the decision

Anatomy (centred, `maxWidth 420`, side margin 16, `bottom = max(insets.bottom - 8, 12)`, `position: absolute`):
- Pill: height 64, radius `full`, `GlassSurface` (iOS blur) or `glassSolid` (Android), `Shadow.lg`.
- Three slots: left tab (flex 1), centre spacer (width 72), right tab (flex 1). Routes are split in half around the centre; with 2 routes today it is [Feed][+][Profile]; phase 2 with 4 routes becomes [Feed][Explore][+][Alerts][Profile] with no redesign.
- Tab item: min hit 64 high x flex width (>= 80), column: icon 24 over label `label` 12 (use `caption`-size, `semibold`, `maxFontSizeMultiplier 1.3`). Active: a capsule (height 32, width 56, `primarySoft`) behind the icon, icon `primary`, label `text`. Inactive: icon and label `textMuted`. Role `tab`, `accessibilityState.selected`, label = tab title.
- Centre "+" (FAB, owner decisions 1 and 4): 56 px circle, fill `primaryBright` (light `#F2592B`, dark `#FF7A4D`), glyph `plus` 28 px `onFab` (light `#FFFFFF`, dark `#240B02`), `Shadow.fab`, 4 px ring in `background` colour (looks cut into the bar), centred horizontally, top at -20 (protrudes 20 px above the pill). Icon-only: no label text is ever drawn on it. Role `button`, label "Create trip", hint "Opens the new trip form". Pressed: scale 0.94, fill `fabPressed`. It is NOT a route: `onPress` runs `router.push('/trip/new')` (the `fullScreenModal` already registered in `(app)/_layout.tsx` covers the bar).
- Hidden automatically on pushed screens (they sit above the tabs in the Stack).
- Tapping the active tab: scroll the screen's list to top (nice-to-have, step 4b).

### 3.10 Headers

- Tab screens (Feed, Profile) have no native header (`headerShown: false` already): they render their own header content (5.1, 5.2).
- Stack and modal screens keep native headers, restyled via one shared helper `useStackScreenOptions()` applied in `(app)/_layout.tsx` `screenOptions`: `headerShadowVisible: false`, `headerStyle: { backgroundColor: theme.background }`, `headerTintColor: theme.text`, `headerTitleStyle: { fontFamily: FontFamily.bold, fontSize: 17 }`, `contentStyle: { backgroundColor: theme.background }`, iOS `headerBackButtonDisplayMode: 'minimal'`. Header text buttons (Cancel/Save/Publish): `FontFamily.semibold`, colour `text` for Cancel and `primary` for the action, min hit 44.
- The root `ThemeProvider` receives a custom navigation theme built from the tokens (`background`, `card`, `text`, `border`, `primary`) so transitions never flash white/black. Also call `SystemUI.setBackgroundColorAsync(theme.background)` (`expo-system-ui` is installed).

### 3.11 TripCard variants (`trip/trip-card.tsx`)

`TripCardData` and callbacks unchanged. `variant: 'feed' | 'grid' | 'compact'`.

Feed variant ("hero card"):
- Outer: width 100%, aspect ratio 4:5 (owner decision 11), i.e. height `H = min(cardWidth * 1.25, 0.65 * windowHeight)` (the cap only applies on very wide/short windows), radius `xl`, `Shadow.md`, bg `primarySoft`. Inner clip: image `absoluteFill` (`contentFit="cover"`, `transition 200`, `cacheKey` as MVP 8.2), then `imageScrim` gradient anchored bottom (65% of H). No cover: seeded `coverFallbacks[trip.id]` gradient plus a centred white `map` icon (xl, 0.9 opacity) instead of the flat placeholder.
- Top-left (16, 16): private badge `Chip tone="onImage" icon="lock"` "Private" (only when `isPrivate`). Top-right: reserved (phase 2 save/bookmark), not rendered.
- Bottom block (padding 16, gap 8, max height 40% of H; `onImage` text; all `maxFontSizeMultiplier 1.3`):
  1. Author row (a separate `Pressable`, min height 44): `Avatar` 32 with `ring="image"` + display name `label` `onImage` (1 line) + " · " + relative date `caption` `onImageMuted`. Rendered only when `showAuthor` and `author` exist.
  2. Title `heading` `onImage`, `numberOfLines={2}`.
  3. Meta: `Chip tone="onImage" icon="pin"` with "{n} stops" (uses existing `formatStopCount`).
  4. Phase 2 slot: a right-aligned action rail (like, comment, share) occupies a 48 px column at the right of the bottom block; the text column gets `paddingRight: 64` only when the rail exists. Do not render it in MVP.
- Touch/a11y structure (the MVP "two sibling buttons" rule still holds): `<View card> <Pressable main style={absoluteFill} accessibilityRole="button" label=MVP main label hint="Opens trip details"> image + gradient </Pressable> <View overlay pointerEvents="box-none" style={bottom block}> <Pressable author .../> <View pointerEvents="none" accessible={false} importantForAccessibility="no-hide-descendants"> title + meta </View> </View> </View>`. Taps on the title fall through to the main button; the title/meta are hidden from the screen reader because the main label already contains them; the author button is its own focus target.
- Large-text fallback: if `PixelRatio.getFontScale() >= 1.5`, render the "stacked" layout instead: image on top (aspect 4:3, radius `xl` top), text block below on `surface` with the same content in normal colours (no overlay). Same sibling-button structure.
- Skeleton: same box (height `H`, radius `xl`, `skeleton` fill) with two text bars and a 32 px circle near the bottom.

Grid variant (profile 2-column grid):
- Tile width `(contentWidth - 12) / 2`, aspect 3:4, radius `lg`, `Shadow.sm`, same two-layer clip, `tileScrim`. Bottom block padding 12, gap 4: title `label` `onImage` (2 lines, cap 1.3) and meta line `caption` `onImageMuted` with `pin` icon 12 + "{n} stops". Private: 28 px circle `scrimChip` top-left with a `lock` icon (a11y info is in the label "Private trip."). One `Pressable`, label per MVP 8.3 compact. No author.

`compact` stays until the profile screens migrate, then is deleted.

### 3.12 EmptyState, ErrorBanner, Skeleton (restyled, same APIs)

- EmptyState: icon in an 88 px circle `primarySoft` (icon 32 `primary`), title `heading`, message `body` `textMuted`, CTA pill `Button`. Optional soft ring: a second 120 px circle at 40% `primarySoft`. Spacing 16; max width 320.
- ErrorBanner: radius `lg`, fill `dangerSoft`, 1 px border `danger` at 40% opacity (icon + text carry the meaning), padding 16; retry is a `ghost` `sm` Button with `tone="onSoft"` (text `primaryPressed`, which has more than 5:1 on `dangerSoft`).
- Skeleton: new colours; radii follow the real element (cards `xl`/`lg`, buttons `full`, text `sm`); pulse unchanged.

### 3.13 Auth hero (`auth/auth-hero.tsx`, new)

Block at the top of sign-in / sign-up / choose-username: `Gradients.brand`, bottom corners `xxl`, extends under the status bar (the screen uses `edges` without `top` for the hero and adds `insets.top` padding inside). Content: the temporary logo (owner decision 10): the map-pin mark (`assets/brand/mark.svg`, drawn as a 56 px image or an inline component; on the brand gradient use a white version of the pin, `onPrimary`, hole transparent) next to or above the wordmark "onMyWay" set as text in `display` `onPrimary` (large text, so it follows the font, not the SVG), and below it the tagline `bodyStrong` `onPrimary`: "Share the journey. Follow the way." (same tagline on sign-in, sign-up and choose-username). Keep decorative shapes (white at 10%) away from text because they lower contrast. Heights: sign-in 240 + inset, sign-up and choose-username 180 + inset. Status bar style `light` on these screens (`<StatusBar style="light" />`; dark mode uses the same hero).

### 3.14 Gradient and GlassSurface

Spec in 2.7 and 2.8. Both decorative: `accessible={false}`, `pointerEvents="none"` where overlaying content.

---

## 4. Tab bar decision (approved by the owner, decisions 3 and 4)

Problem: `NativeTabs` (`expo-router/unstable-native-tabs`) renders the platform tab bar (UITabBar / Material navigation bar). It cannot host a custom centre button, a floating pill, or custom blur.

| Option | Verdict |
|---|---|
| A. Keep `NativeTabs`, add "+" elsewhere | Fails the requirement (no centre "+", no floating frosted bar). |
| B. `NativeTabs` with a dummy third trigger intercepting presses | Hacky: cannot restyle the item as a raised circle, cannot float; interception is not a supported API. Reject. |
| C. `expo-router` `Tabs` (JS tabs, built on the bundled React Navigation bottom tabs; `expo-router/build/layouts/Tabs` is present in `node_modules`) with a custom `tabBar` component | RECOMMENDED. No new dependency for the structure, full control of layout, state, a11y, and the centre button; screens stay lazy and frozen; works the same on iOS and Android. |
| D. `expo-router/ui` headless `Tabs`/`TabList`/`TabTrigger` | Also feasible (already used by `app-tabs.web.tsx`), but it is a less mature API and gives fewer navigator features (screen freezing, lazy mount). Keep it only for web. |

Recommendation: C. Trade-offs the owner has accepted: we lose the automatic native/iOS 26 "liquid glass" tab bar and native tab behaviours (long-press, re-tap-to-top are re-implemented by hand); in exchange the bar is identical on both platforms and exactly like the references. Where iOS 26 liquid glass is available `GlassSurface` can use `expo-glass-effect` inside our bar, which gives most of the native look.

Wiring:
- `src/components/app-tabs.tsx` (native file) becomes: `<Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: theme.background } }}>` with `<Tabs.Screen name="index" options={{ title: 'Feed' }} />` and `<Tabs.Screen name="profile" options={{ title: 'Profile' }} />`. `(tabs)/_layout.tsx` is unchanged (`<AppTabs />`). `app-tabs.web.tsx` keeps the headless implementation, restyled with tokens only (web is not a target; optionally remove the Expo "Docs" link as suggested in MVP section 4).
- If React Navigation reserves layout space for the custom bar, add `tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopWidth: 0, elevation: 0 }` in `screenOptions`; screens then use `useTabBarInset()` (2.4). Coder verifies on both platforms and records the result.
- The "+" is a button inside `FloatingTabBar`, not a route: `router.push('/trip/new')`. The Feed no longer has its own "+"; empty-state CTAs ("Create your first trip", "Create a trip") stay.
- Types: `BottomTabBarProps` is re-exported by `expo-router` (`Tabs.d.ts` does `export * from '../react-navigation/bottom-tabs'`); coder confirms the import path against SDK 57.
- `Screen tabBarInset` keeps its prop; internally it uses `useTabBarInset()`.

---

## 5. Screens

General: canvas `background`; screen padding 16; section gap 24; all lists use `useTabBarInset()` for bottom padding on tab screens; safe areas via `Screen`; status bar `auto` (`light` over the auth hero).

### 5.1 Feed (`(tabs)/index`)

- `Screen tabBarInset padded={false}` with one `FlatList`. The greeting header is `ListHeaderComponent` (scrolls away) so the first card can use the full height.
- Greeting header (padding 16, bottom 8): row, `alignItems: center`, gap 12:
  - Left: `Avatar` 48 (own avatar, tap -> `router.navigate('/profile')`, label "Open your profile", hit 48).
  - Middle (flex 1): `{greeting}, {firstName}` in `title` (1 line, `adjustsFontSizeToFit`, min scale 0.8; `firstName` = first whitespace-separated word of `display_name`, fallback `username`; truncated after 20 chars) and below it `body` `textMuted` "Where to next?". Greeting by DEVICE LOCAL hour `h` (0-23): `05 <= h < 12` "Good morning"; `12 <= h < 18` "Good afternoon"; otherwise (`18 <= h < 24` and `0 <= h < 5`) "Good evening". Pure helper `getGreeting(date: Date): string` in `src/lib/greeting.ts` (tester vectors: 04:59 evening, 05:00 morning, 11:59 morning, 12:00 afternoon, 17:59 afternoon, 18:00 evening). Re-evaluation: computed on mount of the Feed screen, whenever the app returns to the foreground (`AppState` change to `active`) and on pull-to-refresh; NOT on a timer (a greeting that flips while the user is reading would be jarring). The heading a11y label is the full greeting text.
  - Right: reserved slot (`minWidth 44`), NOT rendered in MVP. Phase 2: notifications bell / search `IconButton`.
- Phase 2 band below the header (not rendered now): stories row (ref-social "Discover") or category chips (ref-travel). Insert as a sibling after the header inside `ListHeaderComponent`, spacing 16.
- Cards: `TripCard variant="feed"`, separator 16, list horizontal padding 16, `maxWidth` content 600 centred on wide screens.
- States (copy from MVP 8.1): first load -> 2 feed skeleton cards in `SkeletonGroup` (the cards are tall); empty -> `EmptyState`; errors -> `ErrorBanner` under the greeting; footer rows unchanged but use `caption` and `textMuted`; pull-to-refresh tint `primary`.
- The `IconButton` "+" in the header (MVP 8.1) is removed; creating a trip is the centre "+" in the tab bar (3.9).

### 5.2 Profile (`(tabs)/profile` and `user/[username]`)

Structure (one `FlatList`, `numColumns={2}`, `columnWrapperStyle { gap: 12 }`, `ItemSeparator` 12; `ListHeaderComponent` = `ProfileHeader`):
1. Cover: inset card, margin 16 horizontal, height 168, radius `xl`, `Shadow.sm`. Content: image of the latest trip cover (below) with a subtle bottom scrim `tileScrim`-like (alpha 0.25) OR a `coverFallbacks` gradient. Decorative (`accessible={false}`). For `user/[username]` the cover sits below the native stack header (back button native); for the own tab it is the first element under the safe area top inset (no status-bar overlap, because the cover is inset).
2. Avatar `xxl` (112) with `ring="surface"` (4 px `background`), centred, overlapping the cover bottom edge by 56 (`marginTop: -56`).
3. Display name `title` (centred, 1-2 lines, header role), `@username` `body` `textMuted`, bio `body` centred (max width 480, max 3 lines + "more" not needed).
4. `StatsRow`: Trips, Stops, Photos (3.8).
5. Actions row (centred, gap 8, each button `flex: 1`, `maxWidth 168`): own profile -> `Button primary md` "Edit profile" and `Button secondary md` "Sign out" (loading while signing out; failure `ErrorBanner` as MVP 7.2). Other profile -> no buttons in MVP. Phase 2: other profile shows `Button primary` "Follow" + `Button secondary` "Message" in the same slot.
6. `UnderlineTabs` with ONE tab "Trips" (single-tab header mode) on both own and other profiles (owner decision 7: no Public/Private split). Phase 2: add "Saved" / "Liked" without layout changes.
7. Grid of `TripCard variant="grid"`. On the own profile, private trips show the lock badge (28 px `scrimChip` circle, top-left, label "Private trip."); other users' profiles only ever contain public trips, so no badge.

Cover without a schema change (owner decision 5, final): the cover image is the first `coverUrl` in the already-loaded trips list, i.e. the newest trip that has a cover (for other users, public trips only; for the own profile, public or private since only the owner sees it). No extra request. Until the list resolves, or if no trip has a cover, show `coverFallbacks[seed(username)]`. The image cross-fades in (200 ms). It changes when a newer trip with a cover is posted - accepted and documented. Note: the list is paginated, so use the newest loaded trip with a cover (page 1 is enough; do not fetch more pages for it).

DB change needed later for a real cover upload (phase 2, NOT in this refresh; the only schema change in this refresh is migration 0003 `get_profile_stats`): a user-chosen cover requires `profiles.cover_path text null` plus storage policy and a Storage bucket path (e.g. in the public `avatars` bucket under `{uid}/cover-{uuid}.jpg`, same policy pattern as avatars), and an Edit profile control to pick it.

Stats data (owner decision 6, final): ONE RPC `get_profile_stats(p_user_id uuid)` (migration `0003`, written by db-designer, `SECURITY INVOKER` so RLS applies). Called as `supabase.rpc('get_profile_stats', { p_user_id: profileId })`; returns one row `{ trips, stops, photos }` (integers). Semantics: counts respect what the CALLER may see. Other users' profiles show counts of PUBLIC trips (and their stops and stop photos) only; the owner viewing their own profile sees all (public and private). Counts cover stop photos only (not trip cover photos). Hook `useProfileStats(profileId)` returns `{ stats: { trips, stops, photos } | null, isLoading, error, refetch }`; show skeleton while `null`; on error show "-" values plus no banner (stats are non-critical; the trips list keeps its own banner); refetch on pull-to-refresh and after the screen regains focus following a trip create/edit/delete. The coder does not write the SQL and does not start step 6 until migration 0003 is applied; the tab-bar trip count in the grid header uses `stats.trips` (the paginated list count is no longer the source). Because this touches user data and network, step 6 also goes to `security`.

States (copy from MVP 7.x): loading -> header skeleton (cover rect, circle 112, 2 text lines, stats placeholders) + 4 grid skeleton tiles; empty / not found / error as MVP with the restyled components; pull-to-refresh refetches counts, page 1 and `refreshProfile()`.

### 5.3 Trip detail (`trip/[id]`)

Stack header: restyled native header (3.10), title "Trip", back; owner actions (`edit`, `more`) stay as `IconButton`s in `headerRight`. Scroll content, top to bottom (padding 16, section gap 24):

1. Cover: inset, radius `xl`, `Shadow.md`, aspect 4:3 (max height `0.45 * windowHeight`), signed URL as MVP; no-cover -> seeded gradient + white `map` icon. Private owner badge: `Chip tone="onImage" icon="lock"` "Private" top-left on the cover (the full sentence "Private. Only you can see this trip." stays as a visible `caption` line under the title for sighted clarity and a11y).
2. Title `title` (header role, no truncation).
3. Author row (Pressable >= 56): `Avatar` 40, name `label`, "@username" `caption` `textMuted`, trailing `chevron-right` 16 `textMuted`. Label as MVP 9.2.
4. Info tiles row (`InfoTile` x3, gap 12):
   - Stops: icon `pin`, value "{n}", label "Stops" ("Stop" for 1).
   - Distance: icon `route`, value "~12.4 km" (or "-" with fewer than 2 stops), label "Distance". A11y label "About 12.4 kilometres in a straight line". Computed (below).
   - Published: icon `calendar`, value `formatRelativeShort`-style date ("12 Mar", or "12 Mar 2025" for older years; add `formatDateShort(iso)` in `lib/format-date.ts`), label "Published". A11y: long date.
5. Description: heading "About this trip" (`heading`) + `CollapsibleText` (MVP 240-char collapse, "Read more"/"Show less"). Omitted when empty.
6. Photos (only when the trip has >= 1 stop photo): heading "Photos" + caption count; horizontal `FlatList` (`contentContainerPadding 16`, gap 12) of tiles 120x150, radius `lg`, `expo-image`, `cacheKey` per photo; max 12 tiles, a 13th tile "+N" (`scrimChip` overlay, `bodyStrong` white) opens the viewer at that index. Tap opens the existing full-screen viewer (extract `PhotoViewer` from `photo-strip.tsx` so both strips share it); photos are ordered by stop then position. Tile label: "Photo {i} of {m} from {stop name}". Per-stop strips inside stop cards stay as in MVP.
7. Route (only >= 1 stop): heading "Route", `TripMap` inside a rounded card (radius `xl`, `Shadow.md`, clip) full content width, height as MVP 9.3 (`min(320, 0.4*H)`, min 220), caption "Lines connect the stops in order. They are not a driving route." Map placement DECISION: inline below photos and above stops. Why: it keeps every MVP behaviour (marker tap scrolls to the stop card, card tap focuses the marker); a map-first hero would fight the cover image and make the screen heavy to scroll; a bottom sheet or separate map screen would need new navigation and break the "list is the source of truth for screen readers" pairing. Rejected alternatives noted for the owner.
8. Stops: heading "Stops" + caption count; `StopListItem` restyled: `Card` (radius `lg`, `Shadow.sm`), number badge 32 px (`primary`, `onPrimary` `bold`), name `subheading`, address `caption` `textMuted`, notes `body`; selected = 2 px `primary` border + `primarySoft` fill (transparent 2 px border otherwise); behaviour as MVP 9.2.
9. Floating "Follow this trip" (`FollowTripButton`): absolute, left/right 16, bottom `max(insets.bottom, 12)`, `Button primary lg fullWidth floating icon="directions"`, over a `fadeToBackground` gradient (height = button + inset + 24, `pointerEvents="none"`). Replaces the MVP bar with a top border. Scroll bottom padding = measured area height + 16 (existing `onLayout` mechanism). No tab bar here.

Distance (`src/lib/geo.ts`, pure, no deps): `haversineKm(a, b)` with Earth radius 6371.0088 km; `routeDistanceKm(stops)` = sum over consecutive stops in sorted order (identical consecutive points contribute 0); needs >= 2 stops else `null`. Formatting `formatDistance(km)`: `< 1` -> metres rounded to the nearest 10 ("850 m"); `< 100` -> one decimal without a trailing ".0" ("12.4 km", "5 km"); `>= 100` -> rounded integer with a "," thousands separator via regex, no `Intl` ("1,138 km"). Unit is km only (owner decision 8: no miles, no locale switching). It is a straight-line sum, so the tile shows "~" and the a11y text says "in a straight line". Test vectors for the tester: (0,0)->(0,1) = 111.2 km; Hanoi (21.0285, 105.8542) -> Ho Chi Minh City (10.8231, 106.6297) about 1,138 km (+/- 5); same point twice = 0 -> "0 m" is never shown: display "-" when the total is under 10 m.

States: loading skeleton mirrors the new layout (cover 4:3, title bar, author row, 3 tile skeletons, text lines, photo tiles, map block, 2 stop cards); unavailable / error / no stops as MVP 9.6 with the restyled components (for no stops the Follow button is disabled and tiles show Distance "-").

### 5.4 Auth: sign in, sign up, choose username

- Layout: `AuthHero` (3.13) on top, then a content sheet: `surface` fill, top corners `xxl`, overlapping the hero by 32 (`marginTop: -32`), padding 24, scrollable with the keyboard (`Screen scroll`, hero inside the scroll content so small phones lose the hero first; hero hidden when the keyboard is open on screens under 700 px high is NOT required).
- Sheet content per MVP 6.3 / 6.4 / 6.5 (title `title`, subtitle `body` `textMuted`, `ErrorBanner`, `TextField`s, `Button primary lg fullWidth`, link row with `ThemedText type="link"` min 44 high). Titles and copy unchanged.
- Choose username: no back control, hero short (180); success/info tones follow `success`/`danger` tokens.
- Profile load error screen (`profile-load-error`): centred `EmptyState`-style card on `background`, same components.

### 5.5 Edit profile (modal)

Native modal header (3.10). Content on `background`: avatar block centred: `Avatar xl` with a 36 px circular `primary` badge (`camera` glyph, `onPrimary`) at its bottom-right as a visual affordance (the avatar itself is the button, label "Change profile photo"), ghost `sm` "Change photo" / "Remove photo" below. Fields grouped in a `Card` (`elevated`, padding 16, gap 16) using `TextField variant="onCard"`. Banner, validation, discard guard, saving behaviour: MVP 7.4.

### 5.6 Create / edit trip (modals)

Same behaviour as MVP 11. Visual changes plus ONE functional change, the cover crop ratio (owner decision 11):
- Cover crop changes from 16:9 to 4:5 (portrait), so the crop matches the 4:5 feed card and avoids cropping at display time. `expo-image-picker` `launchImageLibraryAsync` option `aspect: [4, 5]` (with `allowsEditing: true`; note that Android honours `aspect` in its crop UI while iOS shows a fixed-ratio crop only when `allowsEditing` is on, coder checks the SDK 57 docs). Resize/compress target after picking: 1280 x 1600 px (width 1280, height 1600, via `expo-image-manipulator` in `src/lib/trip-images.ts`, which today uses `aspect: [16, 9]` at line 88 and a matching cover resize constant; update both together), JPEG, same quality as MVP. The cover picker preview box in the form uses aspect ratio 4:5 (width = content width, max height `0.6 * windowHeight`). Trip detail still shows the cover at 4:3 (5.3, `cover` contentFit crops the 4:5 image centred); grid tiles are 3:4; those crops are acceptable. Existing trips with 16:9 covers still render (cover fit); no migration. Edit trip: when the stored cover is 16:9 and the user picks a new one, the new crop is 4:5. Stop photos keep their existing ratio (only the COVER changes).
- Form sections are `Card`s on `background`: (1) cover + title + description, (2) visibility, (3) stops. Section gap 24, card padding 16, `TextField variant="onCard"`.
- Cover picker: radius `xl`, empty state dashed 2 px `borderStrong` on `primarySoft` with `image` icon `primary` and label `label`; set state shows the image with ghost buttons below.
- Visibility rows: radius `lg`, selected = 2 px `primary` border + `primarySoft` fill, 24 px check circle `primary`/`onPrimary`.
- Stop editor card: `Card elevated`, number badge 32 px, icon buttons as MVP; photo tiles radius `md`, add tile dashed `borderStrong` radius `md`.
- Bottom "Publish trip" `Button primary lg fullWidth` (no `floating`), "Save draft and close" ghost sm.
- `PublishProgress` card: radius `xl`, `Shadow.lg`, steps as MVP; determinate bar 6 px, radius `full`, `primary` on `border`.

### 5.7 Pick location (modal)

Same behaviour as MVP 10. Visual changes: search bar becomes a floating pill (height 52, radius `full`, `surface`, `Shadow.lg`, margin 16 from the edges); results list card radius `lg`, `Shadow.lg`; "Use my location" is an `IconButton lg variant="glass"` (48 px); the confirm bar becomes a floating card (radius `xl`, `surface`, `Shadow.lg`, margin 16 from the sides and `max(insets.bottom, 12)` from the bottom) holding the label block and a `Button primary lg fullWidth` "Use this location"; attribution pill radius `full` as MVP. The pin stays `primary` with a `onImage` halo (replace the literal `#FFFFFF`). The dark map style is unchanged.

### 5.8 Empty, error and skeleton states

Use the restyled `EmptyState`, `ErrorBanner`, `Skeleton` (3.12). Rules: skeleton shapes mirror the real layout including radii and heights (feed card `H`, grid tile 3:4, tiles row, cover 4:3); every skeleton group keeps `role=progressbar`, "Loading"; empty states always offer the primary action when the user can act; error banners keep Retry. Copy is unchanged from MVP.

---

## 6. Phase 2 slots (reserve space, render nothing)

| Feature | Where it goes | What exists now to make it painless |
|---|---|---|
| Notifications / search | Right slot of the Feed greeting header; extra tab in the tab bar (outer positions) | Reserved `rightSlot` prop on `FeedHeader`; tab bar splits routes around the centre button |
| Stories / categories | Band under the greeting header (`ListHeaderComponent` sibling) | Header is a component list; spacing 16 |
| Like / comment / share | Action rail, 48 px column on the right of the feed card bottom block (ref-social) | Text column `paddingRight` toggles only when the rail exists; top-right corner reserved for save |
| Followers / Following | `StatsRow` items 4-5 | `StatsRow` takes an array (3-5 items) |
| Follow / Message | Profile actions row on other users' profiles | Same slot as Edit profile / Sign out |
| Saved / Liked tabs | `UnderlineTabs` items | Component supports N tabs; one tab renders as a header |
| User cover photo | Profile cover | Component already reads a `coverUrl` prop; DB change described in 5.2 |

Rule: no empty placeholders, no disabled buttons, no "coming soon" in the MVP UI.

---

## 7. Accessibility (additions; MVP behaviour rules still apply)

- Contrast >= 4.5:1 for text, >= 3:1 for non-text (icons, borders, focus). Table in 2.2; the scrim rule in 2.7 guarantees text on photos. The coder runs a contrast check on every token pair in both modes and attaches the output.
- Touch targets >= 44x44: tab items 64 high, FAB 56, glass icon buttons 44, chips with `onPress` get hitSlop, grid tiles and cards are large. Author row on feed cards min height 44.
- Dynamic Type: caps per 2.3; the feed card switches to the stacked layout at font scale >= 1.5; tab labels cap 1.3 and the bar uses `minHeight` 64 (bar grows if needed); info-tile values shrink to 0.75 before wrapping.
- Screen reader: tab bar = `tablist` with `tab` items and one `button` ("Create trip"); feed card structure per 3.11 (main button, author button, overlay text hidden); stats row items read as "{n} trips"; info tile row reads as one sentence; decorative gradients, covers on profile and glass are `accessible={false}`; headings keep `accessibilityRole="header"` (greeting "Good morning, {name}", section headings, profile name).
- Reduce Motion and Reduce Transparency honoured (2.8, 2.9). Increase Contrast / high-contrast: borders switch to `borderStrong` on cards when the OS flag is on (optional step 10).
- Focus order on the trip detail: header actions, cover (image), title, author, tiles (one element), description, photos, map (skipped, one label), stops, Follow button.
- Never rely on colour alone: private = lock icon + text, errors = icon + text, selected tab = capsule + colour + `selected` state, selected stop = border + fill + state.

---

## 8. Libraries

Checked against `package.json` (SDK 57, RN 0.86, React 19.2). Already installed and reused: `expo-image` (all photos), `expo-glass-effect` (optional iOS 26 glass), `react-native-reanimated` 4.5.1 (skeleton, entrances, indicator), `expo-symbols` (icons), `expo-font`, `expo-system-ui`, `react-native-safe-area-context`, `expo-splash-screen`. Not needed: `@expo/vector-icons`, `react-native-svg`, haptics, any UI kit.

| Package | Install | Why | Expo Go / dev build impact |
|---|---|---|---|
| `@expo-google-fonts/plus-jakarta-sans` | `npx expo install @expo-google-fonts/plus-jakarta-sans` | Typeface (2.3) | JS + font assets only. Works in Expo Go and existing dev builds. No native rebuild |
| `expo-linear-gradient` | `npx expo install expo-linear-gradient` | Photo scrims, brand hero, bottom fades (2.7). Alternative with no dependency: RN `experimental_backgroundImage: 'linear-gradient(...)'` (the template already uses it in `animated-icon.tsx`), but the prop is prefixed experimental; the `Gradient` wrapper makes switching a one-file change | Native module. Included in Expo Go; the project's dev build must be REBUILT once (`npx expo run:android`, EAS iOS dev build) |
| `expo-blur` | `npx expo install expo-blur` | iOS frosted tab bar and glass buttons (2.8). Android uses a solid fallback | Native module. Included in Expo Go; dev build REBUILD (same rebuild as above) |

So: two small Expo modules, one rebuild, no large libraries (no owner approval needed per CLAUDE.md "large libraries", but flagged). Before coding the coder reads the SDK 57 docs for: `expo-blur` `tint`/`intensity`, `expo-linear-gradient` props, `expo-glass-effect` `GlassView`, `expo-font`/`useFonts`, `expo-router` `Tabs` custom `tabBar` types, `expo-splash-screen` dark config. This document was written without network access to those docs; every API name above marked "check" is unverified.

### 8.1 Temporary brand assets and `app.config.ts` (step 10; owner decision 10)

Source files (already created, vector, palette `#F2592B` -> `#C73A10` pin, `#1C1815` ink, `#FAF7F2` ivory):
- `assets/brand/mark.svg`: 1024 x 1024, transparent background, map pin with a transparent hole and a dotted "way" under the tip. All content lies inside the central 676 px (adaptive-icon safe zone).
- `assets/brand/logo.svg`: 1200 x 360, mark + wordmark "onMyWay" (the "My" in `#C73A10`). The wordmark is live `<text>` in Plus Jakarta Sans Bold: install the font before exporting or convert text to outlines. The logo is for docs, store listing and web; the app screens render the wordmark as themed text (3.13), and the app icon and splash use ONLY the mark.

PNG export (one-off in the polish step; do not add a dependency to `package.json`; use `npx --yes sharp-cli` or Inkscape / `resvg`, whichever is available; commit the PNGs, not the tool). All exports are sRGB PNG:

| Output | Spec | Config |
|---|---|---|
| `assets/images/icon.png` (app icon, 1024 x 1024) | Opaque, NO alpha. Canvas filled `#FAF7F2`, `mark.svg` centred at 100% (iOS masks corners itself). Remove `ios.icon: './assets/expo.icon'` from `app.config.ts` so iOS uses this PNG, or keep it only if the `.icon` bundle is rebuilt with the mark (coder decides, prefers removal) | `icon: './assets/images/icon.png'` (unchanged path) |
| `assets/images/android-icon-foreground.png` (1024 x 1024) | Transparent background, `mark.svg` exported as is (already inside the safe zone) | `android.adaptiveIcon.foregroundImage` |
| `assets/images/android-icon-monochrome.png` (1024 x 1024) | Transparent background, same shape as the foreground but a single colour: replace the gradient fill and the dots stroke with solid `#000000` (hole stays transparent) | `android.adaptiveIcon.monochromeImage` |
| Adaptive background | No image: a solid colour. Delete `android-icon-background.png` and the `backgroundImage` key | `android.adaptiveIcon.backgroundColor: '#FAF7F2'` (replaces `#E6F4FE`) |
| `assets/images/splash-icon.png` (1024 x 1024) | Transparent background, `mark.svg` as is (works on both the ivory and the dark splash because the pin is coral) | `expo-splash-screen` plugin `image` (unchanged path), `imageWidth: 200` (replaces 76) |
| `assets/images/favicon.png` (48 x 48) | `mark.svg` on transparent | `web.favicon` |
| `assets/images/mark-white.png` (new, 256 x 256) | Transparent, pin and dots solid `#FFFFFF` (hole transparent). Shown with `expo-image` at 56 px in the auth hero, so `react-native-svg` is not needed | none (imported with `require`) |

Splash colours for the `expo-splash-screen` plugin entry (replaces `#208AEF`): `backgroundColor: '#FAF7F2'` and `dark: { backgroundColor: '#14110F', image: './assets/images/splash-icon.png' }` (coder verifies the `dark` option shape in the SDK 57 plugin docs). `userInterfaceStyle` stays `automatic`. `AnimatedSplashOverlay` (Expo logo on `#208AEF` blue) is replaced by a plain `background`-coloured overlay that fades out over `Duration.normal`, or removed, so that the hand-off from the native splash is seamless. Splash and icon changes need a native rebuild.

---

## 9. Migration plan (for the coder)

CHECKPOINT: the owner will STOP after step 4 (tab bar) to rebuild the dev build (`expo-blur` and `expo-linear-gradient` are native) and test on a device. Steps 1-4 must therefore each end with the app fully working end to end (sign in, feed, create trip via the "+", trip detail, profile, sign out) on both platforms, in light and dark, with old screens still using old layouts where their step has not run yet. Do not start step 5 until the owner confirms. Dependent items: migration 0003 (`get_profile_stats`, db-designer) must exist before step 6.

Each step is one commit, ends green (`npx tsc --noEmit`, `npx expo lint`), is followed by `tester` (light + dark, iOS + Android, Dynamic Type 100% and 200%) and, where stated, `security`. Keep old APIs working in every step so the app is shippable between steps.

| # | Step | Work | Agents |
|---|---|---|---|
| 1 | Tokens | Update `Colors` values and add new keys to both modes; `Radius`, `Layout` (inputHeight, gridGap), `TabBar`, `Duration.slow`, `Shadow` + `shadow()` helper, `Gradients`, `FontFamily` constants (names only), custom navigation theme in root `ThemeProvider`, `SystemUI` background. No component code changes except literals -> tokens (`#FFFFFF` -> `onImage`, pick-location shadow). Visual result: new colours everywhere, old layout | coder, tester |
| 2 | Fonts | Install the font package; `useFonts` + splash gating in `_layout.tsx`; `Typography` gains `fontFamily` and loses `fontWeight`; `ThemedText` mapping + new `heading`/`statValue`; remove every `fontWeight` literal (text-field.tsx x2, themed-text.tsx x5, avatar.tsx, trip-map.tsx, trip-card.tsx, profile-header.tsx, visibility-picker.tsx, place-result-list.tsx, cover-picker.tsx, stop-editor-card.tsx) and the `fontWeight` reads. Test with "Hà Nội, Đà Nẵng, Phở bò" for Vietnamese diacritics, Android bold not doubled, font error path (rename a font to force it) | coder, tester |
| 3 | Primitives | Install `expo-linear-gradient` + `expo-blur` (rebuild dev build). Restyle `Button`, `TextField`, `Avatar` (+ `xxl`, `ring`), `IconButton` (+ `glass`), `EmptyState`, `ErrorBanner`, `Skeleton`, `Screen` (bg only). New: `Card`, `InfoTile`, `Chip`, `UnderlineTabs`, `Gradient`, `GlassSurface`, `StatsRow`, `useStackScreenOptions`. Add a temporary dev-only gallery route (not committed to main nav) or use Storybook-free manual screens to eyeball them | coder, tester |
| 4 | Tab bar (OWNER CHECKPOINT: dev-build rebuild and device test after this step) | `Tabs` + `FloatingTabBar` + FAB (`primaryBright` fill, `onFab` icon) + `useTabBarInset`; `Screen tabBarInset` uses it; the Feed header "+" is REMOVED in this step too (the FAB replaces it, so there is never a second or missing create entry point); verify absolute positioning on both platforms; "+" opens `/trip/new`; a11y roles; reduce-transparency fallback; web file untouched except tokens | coder, tester |
| 5 | Feed | Time-of-day greeting header (`getGreeting`, 5.1),  `TripCard variant="feed"` hero (two-layer clip, scrim, sibling-button structure, large-text stacked fallback, no-cover gradient), skeletons, entrance animation | coder, tester |
| 6 | Profile | `TripCard variant="grid"`, `ProfileHeader` v2 (cover fallback logic, avatar ring, `StatsRow`, `UnderlineTabs`), `useProfileStats` calling RPC `get_profile_stats` (needs migration 0003) for own and other profile, grid list with lock badge on own private trips; keep `tripCount` prop working until both screens migrate | coder, tester, security (user data, network) |
| 7 | Trip detail | `lib/geo.ts` + `formatDateShort`, info tiles, new order, trip-level photo strip with shared `PhotoViewer`, inline rounded map card, restyled stop cards, floating Follow button + fade, new skeleton | coder, tester |
| 8 | Auth | `AuthHero`, sheet layout, restyled fields/buttons for sign-in, sign-up, choose-username, profile-load-error | coder, tester |
| 9 | Remaining screens | Stack header options; Edit profile; trip form (cards, cover picker, visibility, stop cards, progress card); pick-location floating cards; cover crop 4:5 in `trip-images.ts` and the cover picker preview (5.6); remove `compact` variant and `BottomTabInset` when unused | coder, tester |
| 10 | Polish | Export the PNGs from `assets/brand/*.svg` and update `app.config.ts` splash/icon/adaptive colours (8.1), replace `AnimatedSplashOverlay`, contrast audit script output, high-contrast borders, tab re-tap-to-top, final dark/reduce-motion/Dynamic Type pass | coder, tester |

Compatibility checklist for the coder:
- `ThemedText` types, `themeColor` prop, `ThemedView type`, `useTheme()` return shape, `Colors` key names, `ThemeColor`, `Spacing` keys, `Radius` keys, `Typography` keys, `Layout.controlHeight`, `Screen` props, `Button`/`TextField`/`Avatar`/`IconButton`/`EmptyState`/`ErrorBanner`/`Skeleton` props: all remain valid. New props are optional.
- Migrate, do not keep: `Typography.*.fontWeight` and every `fontWeight` literal; `BottomTabInset` (-> `useTabBarInset`); hard-coded `#FFFFFF`/`#000`; teal-specific assumptions (`primary` text on `primarySoft`, avatar initials colour); `TripCard variant="compact"` (-> `grid`); the Feed header "+" `IconButton`.
- Behaviour that must not change: all MVP copy, hooks, validation, routing, guards, signed-URL handling, pagination, drafts, publish pipeline, Follow flow, maps, picker.
