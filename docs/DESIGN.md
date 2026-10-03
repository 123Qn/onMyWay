# onMyWay - Design spec for step 4 (shared UI + theme tokens)

Audience: coder. Scope: theme tokens, `src/components/ui/*`, icon approach, template cleanup, how placeholder screens adopt it (step 5 builds real forms). No trip/profile feature components here.

Rules for everything below:
- Never hard-code colours, spacing, radii or font sizes in components; read them from `src/constants/theme.ts` via `useTheme()` and the exported scales.
- Every interactive element: min 44x44 hit area, `accessibilityRole`, `accessibilityLabel` (or visible text), `accessibilityState` for disabled/busy/selected.
- Support light + dark, iOS + Android (+ web must not crash; `react-native-web` is installed, but web is not a target).
- Before writing code that touches Expo/RN APIs (`expo-image`, `expo-symbols`, reanimated), check the SDK 57 docs (AGENTS.md).

---

## 1. Theme tokens (`src/constants/theme.ts`)

### 1.1 Compatibility (do not break)

Existing exports stay: `Colors` (keys `text, background, backgroundElement, backgroundSelected, textSecondary`), `ThemeColor`, `Fonts`, `Spacing` (`half, one, two, three, four, five, six`), `BottomTabInset`, `MaxContentWidth`. Existing values of the five existing colour keys are unchanged. New keys are added to BOTH `light` and `dark` (so `ThemeColor` stays valid). Keep `as const` and `useTheme()` as is.

New aliases (documented, not duplicated logic): `surface` == `backgroundElement` value, `textMuted` == `textSecondary` value, `border` == `backgroundSelected` value. Components use the NEW names; old names remain for existing code (`app-tabs`).

### 1.2 Colours

Primary: "Ocean teal" - travel/outdoors feel, distinct from the default iOS blue, accessible in both modes.

| Token | Light | Dark | Use / contrast (WCAG AA) |
|---|---|---|---|
| `text` (existing) | `#000000` | `#FFFFFF` | Body. 21:1 |
| `textSecondary` / `textMuted` (existing) | `#60646C` | `#B0B4BA` | Secondary text. Light 6.0:1 on white, 5.3:1 on surface; dark 7.6:1 on surface (all >= 4.5) |
| `background` (existing) | `#FFFFFF` | `#000000` | Screen bg |
| `backgroundElement` / `surface` (existing) | `#F0F0F3` | `#212225` | Cards, inputs fill, banners |
| `backgroundSelected` / `border` (existing) | `#E0E1E6` | `#2E3135` | Decorative dividers, pressed fill. NOT for input outlines |
| `borderStrong` | `#8A8E96` | `#6B6F76` | Input/outline-button borders (needs 3:1 non-text): light 3.4:1 on white, dark 4.2:1 on bg, 3.2:1 on surface |
| `primary` | `#0B7A75` | `#2DD4BF` | Buttons, links, focus ring. Light 5.2:1 on white (usable as text); dark 10:1 on black |
| `primaryPressed` | `#095F5B` | `#5EEAD4` | Pressed state of primary |
| `onPrimary` | `#FFFFFF` | `#04211F` | Text/icon on primary. Light 5.2:1; dark ~9:1 |
| `primarySoft` | `#E0F2F1` | `#0F2E2C` | Subtle tinted bg (secondary button pressed, selected chips). Text on it: use `text` |
| `danger` | `#C62828` | `#FF6B6B` | Errors, destructive. Light 5.6:1 on white, 4.9:1 on surface; dark 7.5:1 on black, 5.7:1 on surface |
| `onDanger` | `#FFFFFF` | `#000000` | On solid danger. 5.6:1 / 7.5:1 |
| `dangerSoft` | `#FDECEC` | `#3A1B1D` | Error banner bg; text on it uses `text`, icon/border use `danger` (4.9:1 / 5.8:1) |
| `success` | `#1B7F3B` | `#4ADE80` | Success text/icon. 5.1:1 on white; 12:1 on black |
| `skeleton` | `#E4E5E9` | `#2A2D31` | Skeleton base (decorative, no contrast requirement) |
| `skeletonHighlight` | `#F0F0F3` | `#363A3F` | Pulse target colour |
| `overlay` | `rgba(0,0,0,0.5)` | `rgba(0,0,0,0.6)` | Scrims, text-over-photo gradients |

Rules:
- Text on photos (cover/trip cards later) must sit on `overlay`.
- Do not convey error by colour alone: always icon and/or text.
- Replace the hard-coded `#3c87f7` in `ThemedText` `linkPrimary` with `theme.primary` (old colour is only 3.5:1 on white = AA fail).

### 1.3 Spacing, radius, layout

Spacing: keep the existing named scale unchanged (`half 2, one 4, two 8, three 16, four 24, five 32, six 64`); no new keys. Screen padding = `Spacing.three` (16) on phones, `Spacing.four` (24) for auth screens.

```ts
export const Radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;

export const Layout = {
  minTouchTarget: 44,
  controlHeight: { sm: 36, md: 48, lg: 56 }, // sm gets hitSlop to reach 44
  screenPadding: Spacing.three,
  iconSize: { sm: 16, md: 20, lg: 24, xl: 32 },
} as const;

export const Duration = { fast: 150, normal: 250, pulse: 900 } as const;
```

Use: inputs/buttons `Radius.md`, cards `Radius.lg`, banners `Radius.md`, avatars/pills `Radius.full`.

### 1.4 Typography

Add `Typography` (sizes in px; weights as strings; `fontFamily` stays system via `Fonts.sans`, do not add custom fonts). All text must allow Dynamic Type / font scaling (default `allowFontScaling`); never fix heights on text containers.

| Variant | size / lineHeight | weight | Use |
|---|---|---|---|
| `display` | 34 / 40 | `700` | Auth hero, rare |
| `title` | 28 / 34 | `700` | Screen titles |
| `heading` | 22 / 28 | `600` | Section headers, empty-state title |
| `subheading` | 18 / 24 | `600` | Card titles |
| `body` | 16 / 24 | `400` | Default text |
| `bodyStrong` | 16 / 24 | `600` | Emphasis, button label (md/lg) |
| `label` | 14 / 20 | `600` | Field labels, small buttons, helper emphasis |
| `caption` | 12 / 16 | `500` | Counters, metadata, helper/error text |
| `code` | 12 / 16 | mono | Existing |

`ThemedText` `type` mapping (keep every existing key working; values now come from `Typography`):

| `type` | Maps to | Note |
|---|---|---|
| `default` | `body` | was 16/24/500 |
| `title` | `title` | was 48/52 - too large for mobile; unused today |
| `subtitle` | `heading` | was 32/44; placeholder screens use it |
| `small` | `label` weight 500 | unchanged 14/20 |
| `smallBold` | `label` weight 700 | unchanged |
| `link` | 14/20 weight 600, colour `primary` | add `lineHeight 20`, not 30 |
| `linkPrimary` | same as `link` | keep key; colour `theme.primary` |
| `code` | `code` | unchanged |
| NEW `display`, `subheading`, `bodyStrong`, `caption` | as table | add to the union type |

`ThemedText` also: pass `maxFontSizeMultiplier` default 1.6 on `title`/`display` so layouts do not explode.

---

## 2. Icons

- `@expo/vector-icons` is NOT installed (not in `package.json`, not in `node_modules`). Do not add it.
- Use `SymbolView` from `expo-symbols` (installed, `~57.0.3`). Its `name` prop accepts `{ ios: SFSymbol, android: AndroidSymbol, web: AndroidSymbol }`, i.e. SF Symbols on iOS and Material Symbols on Android/web, plus `fallback`, `size`, `tintColor`, `weight`. Coder: read the SDK 57 `expo-symbols` docs for the Android/web setup (weight imports from `expo-symbols/androidWeights/{weight}`, `AndroidSymbol` type).
- Create one thin wrapper `src/components/ui/icon.tsx` (supporting file, not a listed component) so names are defined once:

```ts
export type IconName = 'eye' | 'eye-off' | 'plus' | 'close' | 'chevron-right' | 'alert' | 'refresh'
  | 'map' | 'home' | 'person' | 'lock' | 'image';
// map: IconName -> { ios: 'eye', android: 'visibility', web: 'visibility' } etc.
export function Icon(props: { name: IconName; size?: number; color?: ThemeColor | string; style?: StyleProp<ViewStyle> }): JSX.Element
```
  - Default size `Layout.iconSize.lg`; default colour `text` theme key; `accessible={false}` / `importantForAccessibility="no-hide-descendants"` (icons are decorative; the parent carries the label).
  - Suggested mapping: eye `eye`/`visibility`, eye-off `eye.slash`/`visibility_off`, plus `plus`/`add`, close `xmark`/`close`, chevron-right `chevron.right`/`chevron_right`, alert `exclamationmark.triangle`/`warning`, refresh `arrow.clockwise`/`refresh`, map `map`/`map`, home `house`/`home`, person `person`/`person`, lock `lock`/`lock`, image `photo`/`image`. Coder must verify each Material name exists in `AndroidSymbol`; TypeScript will flag wrong names.
  - Provide a text fallback via the `fallback` prop (a small `View` of the same size) so a missing glyph never crashes or leaves a hole.
- Tab icons already use `NativeTabs.Trigger.Icon sf=... md=...`; leave as is.

---

## 3. Components (`src/components/ui/`)

All named exports, TypeScript props types exported, styles via `StyleSheet.create` + theme values at render. All accept a `style` prop for the outer element (layout tweaks only) and `testID`.

### 3.1 `button.tsx`

Wrapper over `Pressable`.

| Prop | Type | Default |
|---|---|---|
| `title` | `string` | required |
| `onPress` | `() => void` | required |
| `variant` | `'primary' \| 'secondary' \| 'destructive' \| 'ghost'` | `'primary'` |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` |
| `loading` | `boolean` | `false` |
| `disabled` | `boolean` | `false` |
| `fullWidth` | `boolean` | `false` (when false: `alignSelf: 'flex-start'`, min width 88) |
| `icon` | `IconName` | none |
| `iconPosition` | `'left' \| 'right'` | `'left'` |
| `accessibilityLabel` | `string` | `title` |
| `accessibilityHint` | `string` | none |

Visuals:
- Height `Layout.controlHeight[size]` (36/48/56), horizontal padding `Spacing.three` for all sizes, radius `Radius.md`, label `label` (sm) or `bodyStrong`, icon gap `Spacing.two`.
- primary: bg `primary`, text/icon `onPrimary`, pressed bg `primaryPressed`.
- secondary: bg transparent, 1.5 px border `borderStrong`, text `text`, pressed bg `primarySoft`.
- destructive: bg `danger`, text `onDanger`, pressed opacity 0.85.
- ghost: no bg/border, text `primary`, pressed bg `primarySoft`.

States:
- `loading`: replace label+icon with `ActivityIndicator` (colour = text colour of the variant), keep the same width (render label with `opacity: 0` underneath or fix minWidth) to avoid layout jump; `onPress` ignored; `accessibilityState={{ busy: true, disabled: true }}`.
- `disabled`: opacity 0.4, `onPress` ignored, `accessibilityState={{ disabled: true }}`.
- pressed: see variants; add `android_ripple` (colour `overlay` at low opacity) only if it does not fight the pressed style; iOS uses the pressed style.

Accessibility: `accessibilityRole="button"`; `sm` size gets `hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}` so effective target >= 44; md/lg are already >= 48. Label is read from `title` unless overridden.

```tsx
<Button title="Sign in" onPress={onSubmit} loading={submitting} fullWidth />
<Button title="Delete trip" variant="destructive" icon="close" onPress={confirmDelete} />
```

### 3.2 `text-field.tsx`

`forwardRef<TextInput, TextFieldProps>`; extends `Omit<TextInputProps, 'style'>`, so `autoComplete`, `textContentType`, `keyboardType`, `autoCapitalize`, `returnKeyType`, `onSubmitEditing`, `blurOnSubmit`, `inputMode`, `enterKeyHint` all pass through untouched.

| Prop | Type | Default |
|---|---|---|
| `label` | `string` | required (visible label above the input) |
| `value` | `string` | required |
| `onChangeText` | `(text: string) => void` | required |
| `error` | `string \| null` | none |
| `helperText` | `string` | none (hidden when `error` is set) |
| `secureTextEntry` | `boolean` | `false` (when true, shows the show/hide toggle) |
| `maxLength` | `number` | none |
| `showCounter` | `boolean` | `false` (renders `n/max`, needs `maxLength`) |
| `multiline` | `boolean` | `false` (min height 96, `textAlignVertical: 'top'`) |
| `editable` | `boolean` | `true` |
| `containerStyle` | `StyleProp<ViewStyle>` | none |
| `...TextInputProps` | | passthrough |

Layout: `label` (type `label`, colour `text`) -> input row -> bottom row (helper/error left, counter right, both `caption`). Gaps `Spacing.one` / `Spacing.two`.
Input: min height `Layout.controlHeight.md` (48), padding `Spacing.three`, radius `Radius.md`, bg `surface`, border 1.5 px, text `body` colour `text`, `placeholderTextColor = textMuted`, `selectionColor = primary`.

States:
- default: border `borderStrong`. focused: border `primary` (2 px visible change; do not rely on colour alone, thicken to 2). error: border `danger`, error text in `danger` with an `alert` icon (16 px) before it. disabled (`editable=false`): opacity 0.5, bg `border`.
- Password toggle: `IconButton` (eye / eye-off) inside the right of the input row; label `"Show password"` / `"Hide password"`; toggles `secureTextEntry` locally. Never disable autofill: keep `autoComplete="password"` / `"new-password"` from the caller.
- Counter turns `danger` when `value.length >= maxLength`.

Accessibility:
- Input gets `accessibilityLabel={label}`; `accessibilityHint` = helper text when present; error exposed via `accessibilityState` is not available for inputs, so set `accessibilityHint={error ?? helperText}` and render the error `Text` with `accessibilityLiveRegion="polite"` and `accessibilityRole="alert"`.
- Tapping the label focuses the input (wrap label in `Pressable` with `accessible={false}`, calls `inputRef.current?.focus()`).
- Forward ref: merge internal ref and forwarded ref (callback ref) so parents can chain `onSubmitEditing={() => passwordRef.current?.focus()}`.
- Use `returnKeyType` `next`/`done` as supplied by the caller.

```tsx
const pwRef = useRef<TextInput>(null);
<TextField label="Email" value={email} onChangeText={setEmail} keyboardType="email-address"
  autoCapitalize="none" autoComplete="email" textContentType="emailAddress"
  returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()} error={errors.email} />
<TextField ref={pwRef} label="Password" value={pw} onChangeText={setPw} secureTextEntry
  autoComplete="current-password" textContentType="password" returnKeyType="done" />
```

### 3.3 `avatar.tsx`

Uses `Image` from `expo-image` (not RN `Image`).

| Prop | Type | Default |
|---|---|---|
| `uri` | `string \| null` | none |
| `name` | `string` | none (used for initials + label) |
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| number` | `'md'` |
| `accessibilityLabel` | `string` | `name` ? `"${name}'s avatar"` : `"Avatar"` |
| `onPress` | `() => void` | none (when set, wraps in `Pressable`) |

Sizes: sm 32, md 40, lg 64, xl 96 (px). Circle (`Radius.full`), `overflow: 'hidden'`.
- Image: `contentFit="cover"`, `transition={150}`, `cachePolicy="memory-disk"`, `recyclingKey={uri}`; `accessible` with label.
- Fallback (no `uri`, or `onError`): bg `primarySoft`, initials in `primary` colour, bold; initials = first letter of first and last word of `name`, uppercase, max 2 chars; `'?'` when no name. Font size = size * 0.4.
- If `onPress` and size < 44: add `hitSlop` to reach 44, `accessibilityRole="button"`; otherwise `accessibilityRole="image"`.
- Avatar URLs come from `getPublicUrl` (public bucket), so no signing needed.

```tsx
<Avatar uri={profile.avatarUrl} name={profile.display_name} size="lg" />
```

### 3.4 `screen.tsx`

Replaces the `ThemedView` + `SafeAreaView` boilerplate in every screen.

| Prop | Type | Default |
|---|---|---|
| `children` | `ReactNode` | required |
| `scroll` | `boolean` | `false` |
| `padded` | `boolean \| 'auth'` | `true` (`Layout.screenPadding`; `'auth'` = `Spacing.four`) |
| `edges` | `Edge[]` | `['top','left','right','bottom']` |
| `keyboardAvoiding` | `boolean` | `true` when `scroll` or contains inputs; set explicitly by caller |
| `tabBarInset` | `boolean` | `false` (adds `BottomTabInset` to bottom padding - set `true` on tab screens) |
| `centered` | `boolean` | `false` (vertically centres content, for auth/empty screens) |
| `maxWidth` | `number` | `MaxContentWidth` (centres content on wide/web) |
| `contentContainerStyle` | `StyleProp<ViewStyle>` | none |
| `refreshControl` | `ReactElement<RefreshControlProps>` | none (only when `scroll`) |

Behaviour:
- Root `View` bg `theme.background`, wrapped with `SafeAreaView` from `react-native-safe-area-context` using `edges`. On screens under a native header (modals/stack with header) callers pass `edges={['left','right','bottom']}`.
- `scroll`: `ScrollView` with `contentContainerStyle={{ flexGrow: 1, padding, paddingBottom }}`, `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}`, `automaticallyAdjustKeyboardInsets` (iOS), `showsVerticalScrollIndicator={false}`.
- Non-scroll with `keyboardAvoiding`: wrap in `KeyboardAvoidingView` (`behavior="padding"` on iOS; on Android with edge-to-edge default use `behavior="height"` only if testing shows the field is covered - coder verifies on device and notes the result).
- Do NOT use `FlatList` inside `Screen scroll` (nested virtualized lists); list screens (Feed) use `Screen` non-scroll with `FlatList` inside and pass their own content padding.
- Status bar: rely on `expo-status-bar` `style="auto"` (already set at root if present; add it in root layout if missing).

```tsx
<Screen scroll padded="auth" centered>
  <ThemedText type="title" accessibilityRole="header">Sign in</ThemedText>
  ...
</Screen>
```

### 3.5 `skeleton.tsx`

| Prop | Type | Default |
|---|---|---|
| `width` | `DimensionValue` | `'100%'` |
| `height` | `number` | `16` |
| `shape` | `'rect' \| 'circle' \| 'text'` | `'rect'` |
| `radius` | `number` | `Radius.sm` (`circle`: `Radius.full`; `text`: `Radius.sm`, height 16) |
| `style` | `StyleProp<ViewStyle>` | none |

- `circle`: `width` and `height` both = `height` prop.
- Animation: `react-native-reanimated` `Animated.View`, `useSharedValue` + `withRepeat(withSequence(withTiming(1,{duration: Duration.pulse}), withTiming(0,{duration: Duration.pulse})), -1)`, interpolating bg from `skeleton` to `skeletonHighlight` with `interpolateColor` (or opacity 1 -> 0.6). Pulse is subtle (no shimmer sweep).
- Reduce motion: `useReducedMotion()` from reanimated; when true, render static `skeleton` colour and do not start the loop. Cancel animation on unmount (`cancelAnimation`).
- Accessibility: individual skeletons `accessible={false}` + `importantForAccessibility="no-hide-descendants"`. The CONTAINER that composes skeletons sets `accessibilityRole="progressbar"`, `accessibilityLabel="Loading"`, `accessibilityState={{ busy: true }}`. Provide small helper `SkeletonGroup` (a `View` with those props) exported from the same file.

```tsx
<SkeletonGroup style={{ gap: Spacing.two }}>
  <Skeleton height={180} radius={Radius.lg} />
  <Skeleton shape="text" width="60%" />
</SkeletonGroup>
```

### 3.6 `empty-state.tsx`

| Prop | Type | Default |
|---|---|---|
| `icon` | `IconName` | none |
| `title` | `string` | required |
| `message` | `string` | none |
| `actionLabel` | `string` | none |
| `onAction` | `() => void` | none (CTA rendered only when both are set) |
| `style` | `StyleProp<ViewStyle>` | none |

Layout: centred column, gap `Spacing.three`, padding `Spacing.four`, max width 320. Icon in a 64 px circle `primarySoft` with `primary` glyph (size `xl`), title `heading` (`accessibilityRole="header"`), message `body` colour `textMuted` centred, CTA is `Button` (`variant="primary"`, `size="md"`, not full width). Wrapper `accessible={false}` (children are individually focusable; icon is decorative). Works inside `FlatList` `ListEmptyComponent` (use `flexGrow: 1` + centring on the list contentContainer).

```tsx
<EmptyState icon="map" title="No trips yet" message="Be the first to share a journey."
  actionLabel="Create your first trip" onAction={() => router.push('/trip/new')} />
```

### 3.7 `error-banner.tsx`

| Prop | Type | Default |
|---|---|---|
| `message` | `string` | required |
| `onRetry` | `() => void` | none (retry button hidden when absent) |
| `retryLabel` | `string` | `'Retry'` |
| `retrying` | `boolean` | `false` (shows spinner in retry button, ignores presses) |
| `onDismiss` | `() => void` | none (shows close `IconButton` with label `"Dismiss error"`) |
| `style` | `StyleProp<ViewStyle>` | none |

Layout: row, bg `dangerSoft`, 1 px border `danger`, radius `Radius.md`, padding `Spacing.three`, gap `Spacing.two`; leading `alert` icon in `danger`; message `body` colour `text` (flex 1); actions at the end (`Button variant="ghost" size="sm"` for retry; `primary` text is AA on `dangerSoft` in both modes).
Accessibility: container `accessibilityRole="alert"` and `accessibilityLiveRegion="polite"` so screen readers announce it when it appears; message is the label; retry button label `retryLabel`. Never auto-dismiss.

```tsx
{error ? <ErrorBanner message="Could not load the feed." onRetry={refetch} retrying={isFetching} /> : null}
```

### 3.8 `icon-button.tsx`

| Prop | Type | Default |
|---|---|---|
| `icon` | `IconName` | required |
| `onPress` | `() => void` | required |
| `accessibilityLabel` | `string` | required (TypeScript-required; no default) |
| `size` | `'md' \| 'lg'` | `'md'` (visual glyph 20 / 24 px) |
| `variant` | `'plain' \| 'filled'` | `'plain'` (`filled` = `surface` circle) |
| `color` | `ThemeColor` | `'text'` |
| `disabled` | `boolean` | `false` |
| `loading` | `boolean` | `false` |
| `accessibilityHint` | `string` | none |

- Touch box always >= `Layout.minTouchTarget` (44x44): `md` = 44x44, `lg` = 48x48; glyph centred. If the caller puts it in a dense row, still do not shrink the box; use negative margin on the parent if the visual needs to be tighter.
- States: pressed -> bg `border` (circle) ; disabled -> opacity 0.4 + `accessibilityState.disabled`; loading -> `ActivityIndicator` in place of glyph, `busy`.
- Role `button`. No `hitSlop` needed since the box is already >= 44.

```tsx
<IconButton icon="plus" accessibilityLabel="Create trip" onPress={() => router.push('/trip/new')} />
```

---

## 4. Template cleanup (verified with grep on `src/`)

| File | Importers | Recommendation |
|---|---|---|
| `src/components/hint-row.tsx` | none | DELETE |
| `src/components/web-badge.tsx` | none | DELETE |
| `src/components/ui/collapsible.tsx` | none | DELETE |
| `src/components/animated-icon.tsx` (+ `animated-icon.web.tsx` + its `animated-icon.module.css`) | `src/app/_layout.tsx` (`AnimatedSplashOverlay`) | KEEP for now - it is imported. It animates the Expo logo (`assets/images/expo-logo.png`), which is off-brand. Open issue: replace with an onMyWay splash later, then delete these three files and the unused assets (`expo-logo.png`, `react-logo*.png`, `tutorial-web.png`, `expo-badge*.png`). Not part of step 4 |
| `src/components/external-link.tsx` | `src/components/app-tabs.web.tsx` (the "Docs" link) | KEEP unless the coder also strips the Expo "Docs" link from `app-tabs.web.tsx` (web is not a target; a one-line removal). If removed, DELETE `external-link.tsx` too. Coder's call; either is fine |

After deleting, run `npx tsc --noEmit` and `npx expo lint`.

---

## 5. Placeholder screens (step 4 wiring, step 5 builds the real forms)

Replace the `ThemedView`+`SafeAreaView` boilerplate (and the manual `BottomTabInset` padding) with `Screen`. Keep route paths and headings. Screens remain placeholders.

| Screen | Use |
|---|---|
| `(auth)/sign-in.tsx` | `<Screen scroll padded="auth" centered>`; `ThemedText type="title" accessibilityRole="header"` "Sign in"; placeholder `TextField` email + password (secure, with `ref` chaining) and `Button title="Sign in" fullWidth` (no-op / disabled until step 5); `Link` "Create an account" using `ThemedText type="link"`. Step 5 adds validation, `ErrorBanner` above the form for "Invalid credentials", `loading` on the button |
| `(auth)/sign-up.tsx` | Same shell; fields email, password (`autoComplete="new-password"`), username (`maxLength={30}`, `autoCapitalize="none"`, helper "3-30 chars: a-z, 0-9, _"), display name (`maxLength={50}`, `showCounter`); `Button` "Create account"; link back to sign in |
| `(app)/(tabs)/index.tsx` (Feed) | `<Screen tabBarInset centered>`; `title` header; `EmptyState icon="map" title="No trips yet" message="Be the first to share a journey." actionLabel="Create your first trip"` (no-op until step 8-10); keep a `Skeleton` demo out of the screen (loading comes in step 7). The "+" header action is added with the Feed in step 7 as `IconButton icon="plus" accessibilityLabel="Create trip"` |
| `(app)/(tabs)/profile.tsx` | `<Screen tabBarInset>`; `Avatar` (`size="xl"`, no uri -> initials fallback), name/handle placeholder text, and a `Button variant="secondary" title="Sign out"` wired to the existing session sign-out if it already exists (else leave to step 5). No other content |

Quality checks for the tester:
- Light and dark mode: no unreadable text; AA colours as above.
- Dynamic Type at 200%: no clipped labels (buttons grow; height tokens are minimums, use `minHeight`).
- Screen reader: every button/icon button announced with a label; text field announces label + error; skeleton group announced once as "Loading".
- Reduce Motion on: skeleton static.
- Keyboard: no field hidden on small phones; `Return` chains email -> password -> submit.
- Safe areas: nothing under notch/home indicator; tab screens clear the bar.

---

## 6. Step 5 - Auth screens

Supersedes section 5 where it mentions a username field on sign-up (removed). All screens use `Screen` (scroll, `padded="auth"`, `centered`), `TextField`, `Button`, `ErrorBanner`. Form layout: title -> optional subtitle -> `ErrorBanner` (only when set) -> fields -> primary `Button fullWidth` -> link. Vertical gap `Spacing.three` (Screen provides it).

### 6.1 Route guard and flow

Three mutually exclusive states in the root layout (`Stack.Protected`): no session -> `(auth)`; session and username matches `/^user_[0-9a-f]{12}$/` -> `(onboarding)`; session and real username -> `(app)`. Keep the splash visible until both session AND profile have loaded. If the profile fetch fails, do not let the user into `(app)`: show a full-screen `EmptyState icon="alert"`-style screen with `ErrorBanner message="Could not load your profile." onRetry` and a "Sign out" ghost button.
After a successful username save the session provider must refetch the profile so the guard flips and the user lands on Feed with no manual navigation.

### 6.2 Validation and error principles (all forms)

- Validate on submit first. After the first submit attempt, re-validate live as the user types and show inline errors. Before that, validate a field on blur only if it is non-empty. Focus the first invalid field after a failed submit.
- Field-specific problems -> inline `TextField error`. Problems about the request as a whole (credentials, network, rate limit, unknown) -> `ErrorBanner` above the form. Clear the banner when the user edits any field or resubmits.
- Trim and lowercase email before sending. Never trim passwords.
- While submitting: button `loading`, all fields `editable={false}`, ignore repeated submits.
- Map Supabase auth errors by `error.code` (not by message text); fall back to the generic copy. Network = `AuthRetryableFetchError`, `status === 0`, or a thrown fetch failure.
- Never log or display passwords. Sign-in uses one generic message for wrong email or password (no account enumeration).

### 6.3 Sign in (`(auth)/sign-in`)

| Field | Props | Validation |
|---|---|---|
| Email | `keyboardType="email-address"`, `autoCapitalize="none"`, `autoCorrect={false}`, `autoComplete="email"`, `textContentType="emailAddress"`, `returnKeyType="next"` | non-empty; format `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| Password | `secureTextEntry`, `autoComplete="current-password"`, `textContentType="password"`, `returnKeyType="go"`, `onSubmitEditing` submits | non-empty only (no length rule) |

Keyboard flow: email Next -> password Go = submit. Button "Sign in" `fullWidth`, `loading` while submitting. Below: "New here?" muted text + `Link` "Create an account" (>= 44 px tall, as today).

| Case | Where | Copy |
|---|---|---|
| Empty email | inline | "Enter your email address." |
| Bad email format | inline | "Enter a valid email address." |
| Empty password | inline | "Enter your password." |
| `invalid_credentials` | banner | "Incorrect email or password." |
| `email_not_confirmed` | banner | "Please confirm your email before signing in." |
| Rate limit (`over_request_rate_limit`, HTTP 429) | banner | "Too many attempts. Please wait a minute and try again." |
| Network | banner + Retry (`onRetry` resubmits) | "No connection. Check your internet and try again." |
| Anything else | banner | "Something went wrong. Please try again." |

### 6.4 Sign up (`(auth)/sign-up`)

Fields in order: Email, Password, Display name. No username field.

| Field | Props | Validation / copy |
|---|---|---|
| Email | same as sign-in, `returnKeyType="next"` | same messages as sign-in |
| Password | `secureTextEntry`, `autoComplete="new-password"`, `textContentType="newPassword"`, `returnKeyType="next"`, `helperText="At least 8 characters."` | length >= 8. Error: "Password must be at least 8 characters." (replaces helper while invalid) |
| Display name | `maxLength={50}`, `showCounter`, `autoCapitalize="words"`, `autoComplete="name"`, `textContentType="name"`, `returnKeyType="go"`, submits | trimmed length 1-50. Error: "Enter your name." |

Title "Create your account"; subtitle (`textMuted`) "Share your trips with fellow travellers." Button "Create account". Link row: "Already have an account?" + `Link` "Sign in".

| Case | Where | Copy |
|---|---|---|
| `user_already_exists` / `email_exists` | inline on Email | "An account with this email already exists." (MVP accepts the enumeration trade-off) |
| `weak_password` | inline on Password | "That password is too easy to guess. Try a longer or more unusual one." |
| Rate limit | banner | "Too many attempts. Please wait a minute and try again." |
| Network | banner + Retry | "No connection. Check your internet and try again." |
| Anything else | banner | "Something went wrong. Please try again." |

On success (session returned) do nothing manually: the guard routes to Choose username. Pass the trimmed display name as `options.data.display_name` (the DB trigger reads it, cap 50). If no session comes back (confirmation turned on later), show a success state "Check your email to confirm your account." with a "Back to sign in" button.

### 6.5 Choose username (`(onboarding)/choose-username`)

Purpose: replace the generated `user_xxxxxxxxxxxx`. Layout: `Screen scroll padded="auth" centered`, no header, no back control. Stack options for this screen: `headerShown: false`, `gestureEnabled: false`; because the guard makes `(auth)` unreachable, Android hardware back exits the app instead of returning to sign-up.

- Title (`title`, header role): "Choose your username"
- Explainer (`textMuted`): "This is how other travellers will find you. You can change it later in your profile."
- Field: label "Username", `value` lowercased, `maxLength={30}`, `autoCapitalize="none"`, `autoCorrect={false}`, `spellCheck={false}`, `autoComplete="username-new"`, `textContentType="username"`, `keyboardType="ascii-capable"` (iOS) / default on Android, `returnKeyType="done"` (submits if Save is enabled), `showCounter`.
- Input behaviour: in `onChangeText` apply `text.toLowerCase().replace(/\s/g, '')` so capitals and spaces never appear. Do NOT silently strip other characters; flag them via validation so the user understands why.
- Prefill: YES. Suggest a slug of the display name from the profile: lowercase, strip diacritics (`normalize('NFD')` + remove combining marks), replace runs of non `[a-z0-9]` with `_`, trim leading/trailing `_`, cut to 30. Use it only if the result is >= 3 chars and does not start with `user_`; otherwise leave empty. The field starts focused with the text selected so typing replaces it. The suggestion goes through the same validation and availability check as typed text; it is never saved without the user pressing Save.
- Save button: "Save and continue", `fullWidth`, disabled until status is `available` (or `check-failed`, see below), `loading` while saving.
- Escape: `Button variant="ghost"` "Sign out" below Save (no confirmation; nothing is lost). Disabled while saving. Signing out flips the guard to sign-in.

Validation order (first failing rule wins):
1. Empty: no message, status `idle` (helper shown).
2. Not matching `^[a-z0-9_]{3,30}$`: status `invalid`.
   - length < 3: "Use at least 3 characters."
   - disallowed characters: "Use only letters, numbers and underscores."
3. Starts with `user_`: status `invalid`, "Usernames can't start with \"user_\"."
4. Otherwise: debounce 400 ms after the last keystroke, then check availability.

Status display (below the field via `helperText` / `error`; add an optional `helperTone?: 'muted' | 'success'` prop to `TextField` so success text can use the `success` token, and add a `check` entry (`checkmark` / `check`) to `IconName`):

| Status | When | Copy | Visual |
|---|---|---|---|
| `idle` | empty | "3-30 characters: letters, numbers and underscores." | muted helper |
| `invalid` | rules 2-3 | messages above | inline error (danger + alert icon) |
| `checking` | request in flight | "Checking availability..." | muted helper, small `ActivityIndicator` |
| `available` | no row found | "@name is available." | success tone + check icon |
| `taken` | row found, or save hit 23505 | "@name is already taken. Try another." | inline error |
| `check-failed` | availability query errored | "Couldn't check availability. You can still try to save." | muted helper; Save stays enabled |

Availability query: `profiles` select `id` where `username = value`, `.maybeSingle()`. Ignore stale responses (track a request counter or the last queried value) and cancel the debounce on unmount. Treat the query as a hint only; the DB unique constraint is the source of truth.

Save: update `profiles` set `username` where `id = auth uid`.
- Success: refetch profile, guard routes to Feed.
- Error `23505`: set status `taken`, message "@name was just taken. Try another.", keep the text, refocus and select the field. Do not show a banner.
- Network or other error: `ErrorBanner` "Could not save your username. Please try again." with Retry (network: "No connection. Check your internet and try again.").
- Client-side validity is re-checked at Save time; never send a value that fails the regex or starts with `user_`.

Accessibility: the status line is a live region (`accessibilityLiveRegion="polite"`); announce "Checking availability", "Available", "Taken" through it, not by colour alone (icon + text always). Do not announce on every keystroke: only status changes.

### 6.6 Profile placeholder - Sign out

- Button: `variant="secondary"`, title "Sign out", `fullWidth`.
- Decision: NO confirmation dialog for MVP. Sign-out is cheap to undo (sign in again) and drafts are stored locally and survive (note for step 10: do NOT clear local drafts on sign-out unless keyed per user).
- Loading: button `loading` while `supabase.auth.signOut()` runs; the guard then navigates to sign-in. Disable while loading to prevent double taps.
- Failure (rare, network): `ErrorBanner` "Could not sign out. Please try again." with Retry. On a network failure also clear the local session (`signOut({ scope: 'local' })`) so the user is not stuck, then the guard redirects.
- Show the real display name and `@username` from the profile when available; keep the `Avatar` initials fallback.

### 6.7 Copy reference (single source)

Titles: "Sign in", "Create your account", "Choose your username". Buttons: "Sign in", "Create account", "Save and continue", "Sign out", "Retry". Links: "Create an account", "Sign in". Generic errors: "Something went wrong. Please try again." / "No connection. Check your internet and try again." / "Too many attempts. Please wait a minute and try again." All other strings are listed in the tables above and must be used verbatim.

Tester checks: wrong password shows the banner (not an inline error); Return chains all fields; sign-up with a taken email shows the inline error; username input cannot show capitals or spaces; typing quickly sends one availability request after 400 ms; Save is disabled for `invalid`/`checking`/`taken`; two accounts racing for one name produce the 23505 message; there is no way back to sign-up from Choose username; Sign out works from both Choose username and Profile; VoiceOver/TalkBack announce status changes once.

---

## 7. Step 6 - Profile

Existing code to reuse: `useSession()` gives `profile` (`id, username, display_name, avatar_path, bio`) and `refreshProfile()`; `lib/username.ts` (`normalizeUsernameInput`, `validateUsername`); `signOutUser`; `ui/*`. Avatar URL: `supabase.storage.from('avatars').getPublicUrl(avatar_path).data.publicUrl` through one helper `lib/avatar-url.ts` (`getAvatarUrl(path: string | null): string | null`). Filenames are unique per upload, so no cache busting is needed.

### 7.1 New shared pieces

| File | Purpose |
|---|---|
| `components/trip/trip-card.tsx` | `TripCard` + `TripCardSkeleton` (spec in 8.2; used by Feed and both profiles) |
| `components/profile/profile-header.tsx` | `ProfileHeader` (below) |
| `hooks/use-username-availability.ts` | Extract the debounce + status logic from `choose-username` so onboarding and Edit profile share it. Input `(value, currentUsername?)`; when `value === currentUsername` return status `unchanged` (valid, no query) |
| `lib/avatar-url.ts`, `lib/format-date.ts` | See 7.2 and 8.3 |

`ProfileHeader` props:

| Prop | Type | Default |
|---|---|---|
| `displayName` | `string` | required |
| `username` | `string` | required |
| `avatarUrl` | `string \| null` | none |
| `bio` | `string \| null` | none (hidden when empty) |
| `tripCount` | `number \| null` | `null` (shows a skeleton line while null) |
| `actions` | `ReactNode` | none (rendered in a row under the stats) |

Layout: centred column, gap `Spacing.two`, padding `Spacing.three`. `Avatar xl`, display name (`title` type, 1-2 lines, centred, header role), `@username` (`textMuted`), bio (`body`, centred, max width 480), stat line "5 trips" (`label`; "1 trip"), then `actions`.

### 7.2 My profile (`(tabs)/profile`)

- Screen: `Screen tabBarInset padded={false}` containing one `FlatList`; `ListHeaderComponent` = `ProfileHeader` with actions row: `Button "Edit profile"` (secondary, md) and `Button "Sign out"` (ghost, md, loading while signing out, failure `ErrorBanner` "Could not sign out. Please try again." as today). Both buttons `flex: 1` in a row, gap `Spacing.two`.
- No big "Profile" title: the name is the header. Keep an accessible header role on the display name.
- Trips: own trips INCLUDING private, `compact` `TripCard` (`showAuthor` off), newest first. Query `trips` where `owner_id = me`, order `created_at desc, id desc`, page 20 with the same keyset/pagination behaviour as Feed (8.1). Embed the stop count: select `id, title, cover_path, visibility, created_at, stops(count)`. Trip count: separate `select('id', { count: 'exact', head: true })` (own: all visibilities).
- Private trips show the lock badge (8.2). Tap -> `/trip/[id]`.
- States: loading -> header + 3 compact skeletons; empty -> `EmptyState icon="map" title="You haven't created a trip" message="Plan a route and share it with other travellers." actionLabel="Create a trip"` (CTA -> `/trip/new`); error -> `ErrorBanner "Could not load your trips." + Retry` under the header; pull-to-refresh refetches count, first page and `refreshProfile()`; footer spinner / "Could not load more trips." + Retry row as in Feed.
- Avatar in the header is NOT tappable here (editing happens in the modal).

### 7.3 Other user's profile (`(app)/user/[username].tsx`)

- Native stack header with back button, title `@username` (lowercase the param first). Registered in `(app)/_layout.tsx` as a normal push screen.
- Viewing myself: DECISION - redirect. If the param equals my own username, render `<Redirect href="/profile" />` (switches to my tab, which has Edit profile and private trips). No duplicate own-view screen.
- Fetch profile by username (`profiles` select `id, username, display_name, avatar_path, bio`, `.maybeSingle()`), then public trips: `trips` where `owner_id = profile.id` and `visibility = 'public'` (RLS enforces this; keep the filter explicit), count of public trips, same compact cards, pagination and states as 7.2. No actions row.
- States: loading -> `ProfileHeader` skeleton (circle `xl`, two text lines) plus 3 compact skeletons, wrapped in `SkeletonGroup`; not found -> `EmptyState icon="person" title="User not found" message="This profile doesn't exist or was removed." actionLabel="Go back" onAction={router.back}`; load error -> `ErrorBanner "Could not load this profile." + Retry`; no public trips -> `EmptyState icon="map" title="No public trips yet" message="@name hasn't shared a trip yet."` (no CTA).

### 7.4 Edit profile (`(app)/profile/edit.tsx`)

Registered in `(app)/_layout.tsx` with `presentation: 'modal'`, `title: 'Edit profile'`, header left "Cancel", header right "Save" (text buttons, min 44 px hit area via `hitSlop`/padding). `Screen scroll edges={['left','right','bottom']}` (native header handles the top).

Fields (all prefilled from `profile`, then local state):
1. Avatar block (centred): `Avatar xl` (`onPress` opens the picker, label "Change profile photo"), below it `Button variant="ghost" size="sm" title="Change photo"` and, only when a photo exists or one was picked, `Button variant="ghost" size="sm" title="Remove photo"`. While saving with a new photo an `ActivityIndicator` overlays the avatar.
2. Display name: `TextField`, `maxLength={50}`, `showCounter`, `autoCapitalize="words"`, `autoComplete="name"`, `returnKeyType="next"`; trimmed 1-50, error "Enter your name."
3. Username: same input rules as Choose username (lowercase, no spaces, `autoCapitalize="none"`, `autoCorrect={false}`, `maxLength={30}`, `showCounter`), statuses via `useUsernameAvailability(value, profile.username)`; unchanged value shows no status (helper "This is your current username."). Same copy as 6.5, taken -> "@name is already taken. Try another."
4. Bio: `TextField multiline`, `maxLength={160}`, `showCounter`, `autoCapitalize="sentences"`, helper "Tell travellers a bit about yourself." Optional; empty saves as `null`; trim, collapse 3+ newlines to 2.

Photo picking: `expo-image-picker` `launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 })` (square crop; verify option names in SDK 57 docs), then `expo-image-manipulator` resize to 512x512 JPEG, compress 0.8 (stays well under the 2 MB bucket limit; `image/jpeg` only). Preview the local uri immediately. Permission denied -> inline note under the avatar: "Allow photo access in Settings to choose a picture." Picker/manipulator error -> `ErrorBanner` "Could not open your photo. Please try another." No camera option in MVP.

Save (header "Save"): enabled only when the form is dirty AND valid AND username status is `available`/`unchanged`/`check-failed`; shows a spinner in place of the label while saving; Cancel and field editing are disabled while saving. Sequence:
1. If a new photo: upload to `avatars/{uid}/{uuid}.jpg` (`contentType: 'image/jpeg'`). supabase-js gives no upload progress, so progress = indeterminate (avatar overlay spinner + Save spinner).
2. One `update` on `profiles` with only changed columns (`display_name`, `username`, `bio`, `avatar_path`). Error `23505` -> username status `taken` ("@name was just taken. Try another."), refocus the username field, and delete the file uploaded in step 1 (best effort).
3. After success, delete the OLD avatar file (best effort, ignore errors), `await refreshProfile()`, then `router.back()`.
- Failures: upload error -> `ErrorBanner` "Could not upload your photo. Please try again." with Retry (re-runs Save; the form state is kept); other update/network error -> "Could not save your profile. Please try again." / "No connection. Check your internet and try again." with Retry. Banner sits at the top of the form and is announced.
- Remove photo: sets `avatar_path = null` on Save and deletes the old file.

Unsaved changes: `gestureEnabled: !dirty` on the modal (blocks iOS swipe-down) and a `beforeRemove` listener on the navigation object that, when dirty and not just saved, calls `e.preventDefault()` and shows React Native `Alert.alert("Discard changes?", "You have unsaved changes.", [{ text: "Keep editing", style: "cancel" }, { text: "Discard", style: "destructive", onPress: () => navigation.dispatch(e.data.action) }])`. This covers Cancel, Android hardware back and programmatic dismissals. Skip the check after a successful save.

### 7.5 Copy (step 6)

| Where | String |
|---|---|
| Stat | "1 trip" / "{n} trips" |
| Own empty | "You haven't created a trip" / "Plan a route and share it with other travellers." / "Create a trip" |
| Other empty | "No public trips yet" / "@name hasn't shared a trip yet." |
| Not found | "User not found" / "This profile doesn't exist or was removed." / "Go back" |
| Errors | "Could not load this profile." / "Could not load your trips." / "Could not load more trips." / "Could not sign out. Please try again." |
| Edit | "Edit profile", "Cancel", "Save", "Change photo", "Remove photo", "Change profile photo", "Display name", "Username", "Bio" |
| Edit errors | "Enter your name." / "Could not open your photo. Please try another." / "Allow photo access in Settings to choose a picture." / "Could not upload your photo. Please try again." / "Could not save your profile. Please try again." |
| Discard alert | "Discard changes?" / "You have unsaved changes." / "Keep editing" / "Discard" |

---

## 8. Step 7 - Feed

### 8.1 Feed screen (`(tabs)/index`)

Data: `supabase.rpc('get_feed', { p_before_created_at, p_before_id, p_limit: 20 })`. Row: `trip_id, owner_id, title, description, cover_path, created_at, stop_count, username, display_name, avatar_path` (no visibility: the feed is public trips only). Cursor = last row's `created_at` + `trip_id`. `hasMore = rows.length === 20`. Dedupe by `trip_id` when appending. Put the logic in `hooks/use-feed.ts` returning `{ items, status: 'loading' | 'ready' | 'error', refreshing, loadingMore, loadMoreError, hasMore, refresh, loadMore, retry }`; guard against stale responses with a request counter (a refresh invalidates in-flight page loads) and never run two loads at once.

Layout: `Screen tabBarInset padded={false}`. Fixed header row (padding `Spacing.three`): `ThemedText type="title" header` "Feed" on the left, `IconButton icon="plus" variant="filled" accessibilityLabel="Create trip"` on the right (-> `/trip/new`; the coder adds a placeholder route showing `EmptyState icon="map" title="Creating trips is coming soon"` until step 10). Under it a `FlatList`: `contentContainerStyle` padding `Spacing.three`, `ItemSeparator` gap `Spacing.three`, `onEndReachedThreshold={0.5}`, `onEndReached={loadMore}` (no-op when loading, no more, or after a load-more error), `refreshControl` (pull to refresh, tint `primary`), `keyExtractor` = `trip_id`, `initialNumToRender 4`, `windowSize 7`.

States:

| State | UI |
|---|---|
| First load | 3 `TripCardSkeleton variant="feed"` in a `SkeletonGroup` |
| Empty | `EmptyState icon="map" title="No trips yet" message="Be the first to share a journey." actionLabel="Create your first trip"` (CTA -> `/trip/new`); list stays pull-to-refreshable (`flexGrow: 1` content container) |
| First load error | `ErrorBanner message="Could not load the feed." onRetry={retry}` at the top of the list area |
| Refresh error with data | Same banner `"Could not refresh the feed."` above the list; keep showing existing items |
| Loading more | Footer: centred `ActivityIndicator` (padding `Spacing.three`), a11y label "Loading more trips" |
| Load-more error | Footer row: muted text "Could not load more trips." + `Button ghost sm "Retry"` |
| End of list (`!hasMore`, items >= 1) | Footer muted caption centred: "You're all caught up" (with `check` icon sm) |

Navigation: card -> `router.push('/trip/${trip_id}')` (step 8 placeholder); author row -> `router.push('/user/${username}')` (if the author is me, the profile screen redirects to my tab, see 7.3).

### 8.2 Cover images (private bucket)

`hooks/use-signed-urls.ts`: `useSignedUrls(paths: (string | null)[]) => Record<string, string>`. Rules: batch missing paths in ONE `storage.from('trip-photos').createSignedUrls(paths, 3600)` per page; module-level cache `Map<path, { url, expiresAt }>` with expiry 50 min (re-sign when expired or on image `onError`, once); never sign per card. While URLs are pending the cover shows the placeholder (no layout shift). Pass `source={{ uri, cacheKey: cover_path }}` to `expo-image` so the cache survives URL token changes (verify `cacheKey` in the SDK 57 docs), `cachePolicy="memory-disk"`, `contentFit="cover"`, `transition={150}`.

No-cover placeholder: same box as the cover, background `primarySoft`, centred `Icon name="map"` size `xl` in `primary` at 60% opacity. Decorative (`accessible={false}`).

### 8.3 `TripCard` (`components/trip/trip-card.tsx`)

```ts
type TripCardData = {
  id: string; title: string; coverUrl: string | null; coverPath: string | null;
  stopCount: number; createdAt: string; isPrivate?: boolean;
  author?: { username: string; displayName: string; avatarUrl: string | null };
};
```

| Prop | Type | Default |
|---|---|---|
| `trip` | `TripCardData` | required |
| `variant` | `'feed' \| 'compact'` | `'feed'` |
| `showAuthor` | `boolean` | `true` for feed, forced `false` for compact |
| `onPress` | `() => void` | required |
| `onPressAuthor` | `() => void` | none (author row is plain when absent) |

`TripCardSkeleton` takes `variant` and mirrors the layout exactly (same heights) to avoid jumps.

Feed variant: container bg `surface`, radius `Radius.lg`, `overflow: 'hidden'`.
1. Author row (only if `showAuthor`): `Pressable`, min height 56, padding `Spacing.three` horizontal and `Spacing.two` vertical, `Avatar md`, then display name (`label`, 1 line) over `@username` (`caption`, `textMuted`, 1 line).
2. Main area: `Pressable` containing the cover (16:9, full width, `Radius` none) and the body (padding `Spacing.three`, gap `Spacing.one`): title (`subheading`, max 2 lines), meta row (`caption`, `textMuted`): `Icon map sm` + "5 stops" + " · " + relative date; private badge right-aligned.

Compact variant: one `Pressable` row, padding `Spacing.two`, gap `Spacing.three`, bg `surface`, radius `Radius.lg`: 88x88 thumbnail (`Radius.md`, cover or placeholder) + column (title `subheading` 2 lines, meta row as above, badge under the meta row). Min height 104.

Private badge: pill (`Radius.full`, bg `background`, 1 px `border`, padding `Spacing.two` x `Spacing.half`) with `Icon lock sm` + `caption` "Private". Solid background so it needs no contrast-over-photo handling; in the feed variant it sits in the meta row, never over the cover.

Accessibility:
- The author row and the main area are TWO sibling buttons (a nested pressable inside a single accessible card is unreachable for screen readers). Both >= 44 px tall.
- Main: `accessibilityRole="button"`, label `"{title}. {n} stops. Posted {long date}."` + `" Private trip."` when private; hint "Opens trip details". Cover, icons and the badge are children of this single accessible element (not separately focusable).
- Author: role `button`, label `"{displayName}, @{username}. View profile"`.
- Compact variant: single main button, same label (no author).
- Pressed state: `opacity 0.9` on the card area; Android ripple optional.
- Respect Dynamic Type: titles wrap at 2 lines with `numberOfLines={2}`; card heights are minimums except the cover/thumbnail.

Stop count text: `0 -> "No stops"`, `1 -> "1 stop"`, else `"{n} stops"`.

Relative date helper `lib/format-date.ts` (pure, no new deps, no `Intl` reliance because `Intl.RelativeTimeFormat` support on Hermes varies): `formatRelativeShort(iso, now = new Date())`:
- under 60 s (or a future timestamp from clock skew): "now"
- under 60 min: "{m}m"; under 24 h: "{h}h"; under 7 d: "{d}d"
- same calendar year: "{day} {Mon}" e.g. "12 Mar"; other year: "{day} {Mon} {year}" e.g. "12 Mar 2025" (month names from a fixed English array, local time)
`formatDateLong(iso)` for screen readers: "12 March 2025" (also used if the card is older than 7 days) and `formatRelativeLong` for recent items: "2 hours ago", "3 days ago", "1 minute ago", "just now". Use the long forms only in `accessibilityLabel`. The feed does not live-update timestamps; they refresh on pull-to-refresh.

### 8.4 Copy (step 7)

| Where | String |
|---|---|
| Header | "Feed"; button label "Create trip" |
| Empty | "No trips yet" / "Be the first to share a journey." / "Create your first trip" |
| Errors | "Could not load the feed." / "Could not refresh the feed." / "Could not load more trips." / "Retry" |
| Footer | "Loading more trips" (a11y only) / "You're all caught up" |
| Card | "{n} stops", "1 stop", "No stops", "Private" |
| Placeholder route | "Creating trips is coming soon" |

Tester checks: first page shows 20 items, scrolling loads the next page once per threshold hit, no duplicate rows after refresh during a page load; airplane mode shows the right banner for first load vs refresh vs load-more; private trips appear only on my profile with a lock badge; covers load via ONE signed-URL request per page; tapping the author and the card go to different screens; opening my own username from the feed lands on my profile tab; Edit profile: dirty form + swipe/back/Cancel asks to discard, failed upload keeps the form, a race on a username shows the inline taken message; avatars show initials when `avatar_path` is null or the image fails; dark mode and 200% font scale keep cards readable.

---

## 9. Step 8 - Trip detail (`(app)/trip/[id].tsx`)

### 9.1 New files

| File | Purpose |
|---|---|
| `hooks/use-trip.ts` | Loads one trip with author and ordered stops/photos; returns `{ trip, status: 'loading' \| 'ready' \| 'unavailable' \| 'error', isOwner, refresh, retry, setVisibility, remove }` |
| `components/trip/trip-map.tsx` + `trip-map.web.tsx` | Map (spec 9.3). Props below |
| `components/trip/stop-list-item.tsx` | One stop card (9.2) |
| `components/trip/photo-strip.tsx` | Horizontal thumbnails + full-screen viewer (9.2) |
| `components/trip/follow-trip-button.tsx` | Sticky bar + sheets (9.4) |
| `lib/maps-links.ts` | Pure helpers: `splitIntoLegs`, `googleDirectionsUrl`, `appleDirectionsUrl` |
| `constants/map-style-dark.ts` | Google dark `customMapStyle` JSON for Android |
| `components/ui/icon.tsx` (edit) | Add `IconName`s `more` (`ellipsis` / `more_vert`) and `directions` (`arrow.triangle.turn.up.right.diamond` / `directions`) |

Data: one query `trips` `.select('id, owner_id, title, description, cover_path, visibility, created_at, profiles:owner_id(username, display_name, avatar_path), stops(id, position, name, lat, lng, address, notes, stop_photos(id, position, storage_path))').eq('id', id).maybeSingle()`, with `.order('position', { referencedTable: 'stops' })` and the same for `stop_photos`; also sort client-side. `null` data without an error means not found OR private-and-not-owner (RLS hides it): both map to `unavailable`. Display numbers are the 1-based index in the sorted list (DB positions may have gaps). Sign the cover and ALL stop photo paths with ONE `useSignedUrls` call (max 1 + 20x5 paths). `isOwner = trip.owner_id === profile.id`.

### 9.2 Screen layout

Stack header: title "Trip" (static), back button; owner only: `headerRight` = `IconButton icon="more" accessibilityLabel="Trip options"` (menu in 9.5). Body: `Screen edges={['left','right']}` containing a `ScrollView` (pull-to-refresh = refetch) with bottom padding = follow bar height + safe-area bottom. Order top to bottom:

1. Cover hero: full width, 16:9, signed URL (`cacheKey: cover_path`, `contentFit="cover"`), no-cover placeholder from 8.2. `accessibilityRole="image"`, label "Cover photo of {title}" (placeholder: `accessible={false}`).
2. Content block, padding `Spacing.three`, gap `Spacing.three`:
   - Title: `ThemedText type="title"`, header role, up to 3 lines then wraps freely (no truncation).
   - Private badge (only when `visibility === 'private'`, which only the owner can ever see): pill with lock icon + "Private. Only you can see this trip."
   - Author row: `Pressable` (>= 56 px): `Avatar md`, display name (`label`), caption "@username - 12 March 2025" (`formatDateLong`). Label "{displayName}, @{username}. View profile". -> `/user/[username]` (own trip redirects to my tab, as in 7.3).
   - Description (omit when empty): `body`; when longer than 240 characters or 5+ line breaks, collapse to 4 lines with a ghost `Button size="sm"` "Read more" / "Show less" (`accessibilityState.expanded`).
3. Route section (only with >= 1 stop): section header "Route" (`heading`), `TripMap` (9.3) with horizontal margin `Spacing.three`, then a `caption` `textMuted`: "Lines connect the stops in order. They are not a driving route." (only with >= 2 stops).
4. Stops section: header "Stops" (`heading`) + caption "{n} stops"; list of `StopListItem` (a plain `View` map, not a FlatList: max 20 items inside the ScrollView), gap `Spacing.three`.

`StopListItem` props: `index: number` (1-based), `stop: { id, name, address, notes, photos: { id, url }[] }`, `selected: boolean`, `onPress: () => void`, `onRetryPhoto?: (path) => void`, `onLayout` (parent records y for scroll-to). Layout: card bg `surface`, radius `Radius.lg`, padding `Spacing.three`, selected = 2 px `primary` border (unselected 2 px transparent, no layout shift) and `primarySoft` background. Header row (a `Pressable`, >= 44 px): number badge (28 px circle, `primary` bg, `onPrimary` bold text, same look as the map marker), name (`subheading`, wraps), then address (`caption`, `textMuted`, max 2 lines) under it. Notes: `body`, collapse like the description above (140 characters). `PhotoStrip` follows as a SIBLING of the header pressable (separate focus targets), only if the stop has photos.
- Header pressable: role `button`, label "Stop {n}: {name}", hint "Shows this stop on the map".
- `PhotoStrip`: horizontal `FlatList`, 120x120 tiles, `Radius.md`, gap `Spacing.two`, `expo-image` with `cacheKey: storage_path`; a missing/failed URL shows an `image` icon placeholder (retry signing once on error). Each tile: button, label "Photo {i} of {m} from {stop name}". Tap opens a full-screen `Modal` viewer: black background, horizontally paged `FlatList` (`pagingEnabled`, `contentFit="contain"`), close `IconButton icon="close" accessibilityLabel="Close photo viewer"` at the top (inside safe area), page text "{i} / {m}" in white `caption`, Android back closes (`onRequestClose`). No zoom gestures in MVP.

Sticky bar (`FollowTripButton`): absolute bottom, bg `background`, 1 px top border `border`, padding `Spacing.three` and bottom `max(insets.bottom, Spacing.three)`, a `Button` primary `lg` `fullWidth` `icon="directions"` "Follow this trip" (disabled with 0 stops; hidden while loading/error/unavailable).

### 9.3 `TripMap`

| Prop | Type | Default |
|---|---|---|
| `stops` | `{ id: string; number: number; name: string; lat: number; lng: number }[]` | required (sorted) |
| `selectedStopId` | `string \| null` | `null` |
| `onSelectStop` | `(id: string \| null) => void` | none (null = map background tapped) |
| `height` | `number` | `Math.min(320, windowHeight * 0.4)`, min 220 |
| ref | `TripMapHandle { focusStop(id): void; fitAll(): void }` via `forwardRef` | |

Behaviour (check prop names in the react-native-maps 1.27 docs):
- `MapView` with rounded corners (`Radius.lg`, `overflow: 'hidden'`), `rotateEnabled={false}`, `pitchEnabled={false}`, `toolbarEnabled={false}` (Android: hides the "open in Google Maps" buttons), no user-location layer (no permission needed). Android uses Google tiles (needs the API key from step 11; without it the map is blank but the list still works); iOS uses Apple Maps (no key).
- Initial camera: one DISTINCT coordinate (also when all stops share a point) -> `initialRegion` centred on it with `latitudeDelta = longitudeDelta = 0.02` (about a neighbourhood). Two or more -> after both `onMapReady` and the first layout, call `fitToCoordinates(coords, { edgePadding: { top: 48, right: 48, bottom: 48, left: 48 }, animated: false })` (Android needs the layout first; ignore a call before then). Refit when the stop set changes.
- Markers: one `Marker` per stop with a custom 32 px circle view (same style as the list badge: `primary` bg, `onPrimary` number, 2 px white ring so it reads on any tile). Selected: 40 px, `text` colour bg with `background` colour number, `zIndex` above others. `tracksViewChanges` true only on first render and when `selected` changes, then false (performance). Set `title` = stop name and `identifier` = stop id.
- Polyline from the stops in order (>= 2 stops): `strokeColor = theme.primary`, `strokeWidth 4`, `lineJoin="round"`, straight segments.
- Interactions: tap marker -> `onSelectStop(id)`; the screen scrolls the list to that card (scroll offset = recorded card y minus `Spacing.three`) and highlights it. Tap a list header -> `onSelectStop(id)` + `focusStop(id)` (animate to the stop at `latitudeDelta 0.02` unless already closer) + scroll the page so the map top is visible. Tap the map background -> `onSelectStop(null)`. A selected stop stays highlighted until another interaction.
- Dark mode: iOS `userInterfaceStyle={scheme}`; Android `customMapStyle={scheme === 'dark' ? darkStyle : undefined}` (`constants/map-style-dark.ts`, standard Google dark style).
- The map is inside a vertical ScrollView: keep the horizontal `Spacing.three` margins and the height cap so users can always start a page scroll beside or below the map.
- Accessibility: the wrapper has `accessible`, role `image`, label "Map of the trip route with {n} stops. The stop list below has the same information." and hides its children from the accessibility tree (`importantForAccessibility="no-hide-descendants"`, `accessibilityElementsHidden`). The list is the accessible source of truth.
- `trip-map.web.tsx`: same props/ref (no-ops); renders a bordered `surface` card of the same height with `Icon map xl`, text "The route map is available in the mobile app." The Follow button and list still work on web.

### 9.4 Follow this trip

Decisions:
- Origin = the FIRST STOP (not the viewer's location): the trip is a fixed itinerary, no location permission is needed, and it works for viewers anywhere. The user can still change the start inside the maps app. Points are `lat,lng` with 6 decimals (names are ambiguous to geocode, so Google shows coordinates instead of place names; accepted limitation). Skip consecutive points with identical coordinates when building URLs; if fewer than 2 distinct points remain, treat the trip as single-stop.
- Google Maps (full multi-stop): `https://www.google.com/maps/dir/?api=1&origin={o}&destination={d}&waypoints={w1|w2|...}&travelmode=driving`, each value through `encodeURIComponent` (so `|` becomes `%7C`). Google allows at most 9 waypoints, i.e. 11 points per URL (verify against the current Maps URLs docs); `travelmode=driving` is only the default, users can switch inside the app.
- Apple Maps cannot be relied on for multi-stop URLs, so it opens ONE route: from the first to the last stop of the chosen part (`https://maps.apple.com/?saddr={o}&daddr={d}&dirflg=d`), and the menu label says so ("Apple Maps (start and end only)"). Trying `+to:` chaining is a later experiment, out of scope.
- 1 stop: no origin; Google `...dir/?api=1&destination={d}`, Apple `https://maps.apple.com/?daddr={d}&dirflg=d`: navigate from the viewer's location to that stop (not "disabled").
- 0 stops: button disabled.

Legs (`splitIntoLegs(points, maxPoints = 11)`): a leg has up to 11 points and consecutive legs SHARE their boundary stop, so the route has no gap. Leg i covers stops `10*(i-1)+1 ... min(10*i+1, n)`; number of legs = `ceil((n-1)/10)`. With the 20-stop cap that is at most 2 legs: n <= 11 -> 1 leg; n = 12..20 -> 2 legs (for n = 20: stops 1-11 and 11-20).

Flow:
1. Tap "Follow this trip".
2. iOS: `ActionSheetIOS` title "Follow this trip", message "Open the route in:", options "Google Maps", "Apple Maps (start and end only)", "Cancel" (omit the Apple suffix text when n = 1 and call it "Apple Maps"). Android: skip this step (Google Maps only).
3. If more than 1 leg: second sheet (iOS `ActionSheetIOS`; Android `Alert.alert`, at most 3 buttons): title "Choose a part", message "Maps can show up to 11 stops at a time. Part 2 starts where part 1 ends.", options "Part 1: stops 1-11", "Part 2: stops 11-20", "Cancel".
4. `Linking.openURL(url)`. Rejection -> `Alert.alert("Could not open maps", "No maps app could open this route.")`.
No loading state is needed; guard against double taps for 500 ms.

### 9.5 Owner actions (header menu)

- Step 8 ships: "Make private" / "Make public" (label depends on state) and "Delete trip". "Edit trip" is DEFERRED to step 10 (do not show a disabled item).
- Menu: iOS `ActionSheetIOS` (options visibility toggle, "Delete trip" destructive, "Cancel"); Android `Alert.alert("Trip options", undefined, [toggle, delete, cancel])`.
- Visibility: making public asks first via `Alert`: "Make this trip public?" / "Everyone on onMyWay will be able to see it." [Cancel, "Make public"]. Making private has no confirm. Update `trips.visibility`; on success update local state (the badge appears or disappears); failure -> `Alert` "Could not update visibility. Please try again." Disable the menu button while the request runs.
- Delete: `Alert` "Delete this trip?" / "This permanently deletes the trip, its stops and photos." [Cancel, "Delete" destructive]. Then a blocking overlay (`overlay` colour scrim, spinner, "Deleting trip...", touches blocked). Order per PLAN 2.9: list and remove all Storage objects under `trip-photos/{user_id}/{trip_id}/`, then delete the `trips` row (cascade removes stops/photos rows). If storage removal fails, do NOT delete the row (so a retry still finds the files): show `Alert` "Could not delete the trip. Please try again." On success `router.back()` (the Feed/profile lists must drop the item: refetch on focus or remove it locally).

### 9.6 States

| State | UI |
|---|---|
| Loading | `SkeletonGroup`: hero 16:9, title line (70%), author row (circle md + two lines), two text lines, map block (rect, map height, `Radius.lg`), 3 stop card skeletons. No follow bar |
| Unavailable | `EmptyState icon="lock" title="Trip unavailable" message="This trip doesn't exist, was removed, or is private." actionLabel="Go back"` |
| Error | `ErrorBanner message="Could not load this trip." onRetry` at the top of the screen |
| No stops | Skip the Route and Stops sections; show a centred muted block `Icon map xl`, "No stops yet", "This trip doesn't have any stops." Follow button visible but disabled |
| Photo failed | Tile placeholder; one re-sign attempt |

### 9.7 Copy (step 8)

"Trip", "Route", "Stops", "{n} stops" / "1 stop", "Lines connect the stops in order. They are not a driving route.", "Private. Only you can see this trip.", "Read more", "Show less", "Follow this trip", "Open the route in:", "Google Maps", "Apple Maps (start and end only)", "Choose a part", "Part {i}: stops {a}-{b}", "Trip options", "Make public", "Make private", "Delete trip", "Make this trip public?", "Everyone on onMyWay will be able to see it.", "Delete this trip?", "This permanently deletes the trip, its stops and photos.", "Deleting trip...", "Trip unavailable", "This trip doesn't exist, was removed, or is private.", "No stops yet", "This trip doesn't have any stops.", "Could not load this trip.", "Could not update visibility. Please try again.", "Could not delete the trip. Please try again.", "Could not open maps", "No maps app could open this route.", "The route map is available in the mobile app.", "Close photo viewer".

### 9.8 Tester checklist

- Owner sees the lock badge and the options menu on a private trip; a non-owner opening a private trip id sees "Trip unavailable"; non-owners never see the menu.
- Markers are numbered 1..n and match the list numbers; the polyline follows list order; the map fits all stops with padding; a one-stop trip (and all stops at one point) opens at a street-level zoom.
- Marker tap scrolls to and highlights the card; card header tap centres the map on the stop and highlights the marker.
- Follow: 1 stop opens directions to it; 5 stops open one Google URL with 3 waypoints; 15 and 20 stops show the part picker with correct overlap (1-11, 11-15 / 11-20); iOS shows the app sheet, Android opens Google Maps directly; Apple Maps opens start to end only; 0 stops disables the button; the bar clears the home indicator.
- Delete removes the Storage files and the row, then returns; a forced storage failure keeps the row. Visibility toggle updates the badge; "Make public" asks for confirmation.
- Photo viewer opens, pages, closes with the button and the Android back key. Failed photos show a placeholder.
- Screen reader: the map is skipped (one label), every stop and photo is reachable in the list; Dynamic Type 200% keeps the follow bar usable; dark mode map style applies on both platforms.
- Web: the page renders, the map shows the notice, nothing crashes.

---

## 10. Step 9 - Pick location (`(app)/pick-location.tsx`)

Scope: a modal screen that returns one place `{ lat, lng, name, address }` to its caller, plus the Nominatim client. No stop form here (step 10 consumes the result). `expo-location` and `expo-constants` are already installed and the `expo-location` plugin/permission text is already in `app.config.ts`: no new libraries.

### 10.1 New and changed files

| File | Purpose |
|---|---|
| `app/(app)/pick-location.tsx` | The route (10.2, 10.3). Shared by native and web; imports the platform map component |
| `components/map/location-picker-map.tsx` + `.web.tsx` | Native: `MapView` + fixed pin overlay. Web: notice card (10.9). Same props/ref |
| `components/map/place-result-list.tsx` | Results overlay list (10.4) |
| `hooks/use-place-search.ts` | `{ status: 'idle' \| 'loading' \| 'ready' \| 'empty' \| 'error' \| 'rate_limited', results, error, search(q), clear() }`; owns the abort of the previous search |
| `lib/nominatim.ts` | Client (10.6) |
| `lib/pick-location-store.ts` | Pending-result store (10.2) |
| `app.config.ts` (edit) | Add `extra: { nominatimContactEmail: 'quanhuynhvt2004@gmail.com' }` |
| `components/ui/icon.tsx` (edit) | Add `IconName`s `search` (`magnifyingglass` / `search`), `locate` (`location` / `my_location`), `pin` (`mappin` / `location_on`), `check` (`checkmark` / `check`) |
| `app/(app)/_layout.tsx` (edit) | Register the screen (10.2) |

### 10.2 Route, registration and result hand-off

Registration (same pattern as `profile/edit`):

```tsx
<Stack.Screen name="pick-location" options={{ presentation: 'modal', title: 'Choose location' }} />
```

Native header kept (title + close). iOS modal gets the system close gesture; set `headerLeft` to `IconButton icon="close" accessibilityLabel="Cancel"` calling `router.back()` on both platforms (the default back arrow on Android modals reads as "back", not "cancel"). Android hardware back and iOS swipe-down both cancel without a result. `gestureEnabled` stays default (dragging the map is not a swipe-down on iOS because the sheet gesture only starts from the header).

Opening (caller, step 10):

```ts
const requestId = randomId();               // lib/random-id.ts
router.push({ pathname: '/pick-location', params: { requestId, lat, lng } }); // lat/lng optional, strings
```

Route params (all strings, validated with `Number()` + range check, invalid = ignored):

| Param | Required | Meaning |
|---|---|---|
| `requestId` | yes (missing = screen shows `EmptyState` "Something went wrong" + Close) | Key for the result |
| `lat`, `lng` | no | Initial pin position when editing an existing stop (zoom delta 0.01). Also `name`/`address` are NOT passed; the confirm bar reverse-geocodes lazily (10.7) |

Returning the result - DECISION: a tiny in-memory store keyed by `requestId` in `lib/pick-location-store.ts`:

```ts
export type PickedLocation = { lat: number; lng: number; name: string; address: string | null };
export function setPickResult(requestId: string, value: PickedLocation): void; // picker, on confirm
export function takePickResult(requestId: string): PickedLocation | null;     // caller, reads once and deletes
```

Module-level `Map`, max 10 entries (drop the oldest). The picker calls `setPickResult` then `router.back()`. The caller reads it in `useFocusEffect(() => { const r = takePickResult(requestId); if (r) addOrUpdateStop(r); })` (the caller keeps `requestId` in a ref/state per open; a new id per open).
Why not router params on dismiss: params are string-only (needs JSON round-trip and parsing), `router.dismissTo`/`setParams` back onto a form that holds a lot of local state can re-mount or merge params unexpectedly, and typed routes make the caller route's params awkward. A store is typed, has no serialisation, survives the modal unmount, and cancel is simply "no entry". Not persisted: a killed app has nothing to restore, which is correct. Cancel or back never writes an entry, so a stale result cannot appear.

### 10.3 Layout

Root: `Screen padded={false} edges={['left','right']}` (header owns the top; bottom handled by the confirm bar). Children are absolutely layered, bottom to top:

1. `LocationPickerMap` filling the screen (`StyleSheet.absoluteFill`).
2. Centred pin (inside the map component, `pointerEvents="none"`): 40 px `pin` icon, `primary` fill with a 2 px white halo; the TIP is at the exact map centre, so shift the glyph up by half its height. Under it a 10 px `overlay` ellipse shadow. While the user pans (`onPanDrag`), the pin lifts 8 px (`Duration.fast`); on `onRegionChangeComplete` it drops back. The pin never fires touch events.
3. Search bar (top): absolute, `top: Spacing.three`, horizontal `Spacing.three`, a `surface` card with `Radius.lg`, 1 px `border` and a small shadow (iOS shadow props, Android `elevation 3`). Row: `search` icon (decorative), `TextInput` (`body`, placeholder "Search for a place", `returnKeyType="search"`, `enterKeyHint="search"`, `autoCorrect={false}`, `autoCapitalize="none"`, `selectionColor = primary`, `onSubmitEditing={submit}`; NO `onChangeText` network calls), min height `Layout.controlHeight.md` 48, and a clear `IconButton icon="close" size="md" accessibilityLabel="Clear search"` shown only when text is non-empty. Input label: `accessibilityLabel="Search for a place"`, hint "Press search on the keyboard to see results".
4. Results overlay: directly under the search bar (`top = bar bottom + Spacing.two`), same width, `surface` card `Radius.lg`, `maxHeight = min(320, 40% of window height)`, `FlatList` (`keyboardShouldPersistTaps="handled"`). Shown only when status is `loading`, `ready`, `empty`, `error` or `rate_limited`; hidden by close (clear button), by selecting a result, or by tapping the map.
5. "Use my location" button: `IconButton icon="locate" size="lg" variant="filled"`, absolute, right `Spacing.three`, bottom = confirm bar height + `Spacing.three`; 48x48, a `surface` circle with the same shadow. Label "Use my location". Shows a spinner (`loading`) while locating. Hidden on web.
6. OSM attribution: caption `textMuted` "© OpenStreetMap contributors" in a `surface` pill (opacity 0.9, padding `Spacing.one`/`Spacing.two`, `Radius.full`), absolute left `Spacing.three`, bottom = confirm bar height + `Spacing.two`. Plain text, not a link in MVP (must stay readable on tiles: the pill guarantees contrast). `accessible`, role `text`. Map tiles on iOS/Android are Apple/Google; the attribution is for the Nominatim data, which is why it sits with the search UI and the confirm bar.
7. Confirm bar (bottom): absolute, bg `background`, 1 px top border `border`, padding `Spacing.three`, bottom padding `max(insets.bottom, Spacing.three)`. Content: a row with the `pin` icon (`primary`) and a text block: title `bodyStrong` (the label: selected result name, else coordinates "10.77690, 106.70090", else "Move the map to place the pin") and, when known, an address line `caption` `textMuted` (max 2 lines). Beneath it a full-width `Button size="lg"` "Use this location" (icon `check`, `loading` while reverse geocoding on confirm).

Pin-to-label rules (what the bar shows before confirm; NO network on pan):
- Initially or after panning: the bar shows the coordinates (6 decimals, `lat, lng`) and the helper caption "Address is looked up when you confirm". This keeps panning free of requests.
- After tapping a search result: the bar shows that result's name and address (already known, so confirm needs NO reverse request).
- After "Use my location": coordinates (reverse on confirm).
- Any pan after a result was selected clears the result label and falls back to coordinates (the pin moved: the old name would be wrong). Pan detection: `onRegionChangeComplete` with `isGesture === true` (check the 1.27 docs for the second argument; on Android it is reliable only with `onPanDrag`, so set a `userMoved` ref in `onPanDrag` as the fallback).

Keyboard and safe areas: header = system; map ignores keyboard (it is absolute and not resized: `Screen keyboardAvoiding={false}`); while the keyboard is visible (`Keyboard` show/hide events) the confirm bar, the locate button and the attribution pill are not rendered so they never float above the keyboard, and the results list keeps its max height (so it fits above the keyboard on a small phone: also clamp `maxHeight` to `windowHeight - keyboardHeight - barBottom - Spacing.four`). Submit dismisses the keyboard so the list and the confirm bar are visible together; the confirm bar returns when the keyboard closes. Android: `softwareKeyboardLayoutMode` stays default (resize), which also shrinks `windowHeight`; verify on device and note the result.

Camera: initial region = `lat/lng` params (delta 0.01); else, if foreground permission is ALREADY granted (`getForegroundPermissionsAsync`, no prompt on open), the last known position (`getLastKnownPositionAsync`, no GPS wait; delta 0.05); else a world-ish default `{ latitude: 20, longitude: 0, latitudeDelta: 80, longitudeDelta: 80 }`. The permission prompt appears only after tapping "Use my location". Selecting a result: `animateToRegion` with `latitudeDelta 0.01` (or fit the result `boundingbox` when present and larger, clamped to delta 0.5 max; if the box is tiny use 0.01). Disable `rotateEnabled`, `pitchEnabled`, `toolbarEnabled`; `showsUserLocation` only after permission granted; `showsMyLocationButton={false}` (we have our own); dark mode as in 9.3 (`userInterfaceStyle`, `customMapStyle={mapStyleDark}`); no markers (the pin is an overlay, which stays precise while panning).

Dark mode: all surfaces use theme tokens; the pin keeps `primary` with a white halo (readable on dark tiles); shadows are replaced by the 1 px `border` in dark mode.

Touch targets and accessibility:
- Every control >= 44 (48 for inputs/primary buttons). Result rows >= 56 px.
- The map is a gesture surface and not accessible by screen reader: wrapper `accessible`, `accessibilityRole="image"`, label "Map. The pin marks the chosen place. Use the search field or Use my location to choose without dragging the map.", children hidden (as in 9.3). Provide an accessible nudge alternative: none in MVP, the search + GPS buttons are the screen-reader path (stated in the label).
- Confirm bar text block: `accessibilityLiveRegion="polite"` so a changed label is announced after selecting a result; the button label is "Use this location", hint "Adds this place as a stop".
- After a search finishes, announce the count with `AccessibilityInfo.announceForAccessibility("{n} places found")` / "No places found".
- Results rows: role `button`, label "{name}, {address}", hint "Moves the pin to this place".

### 10.4 Results list (`PlaceResultList`)

Props: `status`, `results: PlaceResult[]`, `onSelect(r)`, `onRetry()`. Each row: `pin` icon (`textMuted`), name (`label`, 1 line) and address (`caption`, `textMuted`, 2 lines), padding `Spacing.three` vertical `Spacing.two`, 1 px `border` separators. `limit=5` results at most so no scrolling is usually needed. Status rows (inside the same card, not a separate screen):

| Status | Content |
|---|---|
| `loading` | One row with `ActivityIndicator` + "Searching..." (`accessibilityRole="progressbar"`) |
| `empty` | Icon `search` + "No places found" + caption "Try a different name, or move the map to place the pin yourself." |
| `error` | Icon `alert` (`danger`) + "Could not search. Check your connection." + ghost `Button sm` "Try again" |
| `rate_limited` | Icon `alert` + "Search is busy right now. Wait a moment and try again." + ghost `Button sm` "Try again" (button is disabled for 5 s with the countdown not shown, to avoid hammering) |

### 10.5 Screen states

| State | UI |
|---|---|
| Idle | Map + pin + confirm bar with coordinates |
| Searching / results / empty / error / rate-limited | 10.4 overlay; the map stays usable (pan still works and hides the overlay) |
| Locating | Locate button `loading`; ignores extra presses |
| Permission denied (foreground) | No system prompt retry loop. A dismissible inline banner (the `ErrorBanner` pattern, `dangerSoft`, but with `onDismiss`) under the search bar: "Location permission is off. You can still search or move the map." with a ghost button "Open settings" -> `Linking.openSettings()`. Shown only after the user tapped the locate button; the map, the search and confirm keep working |
| Location unavailable / timeout (10 s) | Same banner: "Could not get your location. Try again or move the map." |
| Confirming | Confirm button `loading`; map gestures and search disabled until done; Android back ignored for the duration (<= 8 s timeout) |
| Reverse failed | Not blocking: confirm still succeeds (10.7) |
| Invalid `requestId` | `EmptyState icon="alert"` "Something went wrong" + "Close" |

### 10.6 `lib/nominatim.ts`

Contact email DECISION: `extra.nominatimContactEmail` in `app.config.ts`, read once via `Constants.expoConfig?.extra?.nominatimContactEmail` (expo-constants is installed; the app version comes from `Constants.expoConfig?.version`). One place, shipped in config (it is public by nature: it is sent in a header), and changeable without code edits or a second constants file. Missing value: log a dev-only warning and omit the parenthesised part (never crash). Do not hard-code the address anywhere else.

API (named exports, no default):

```ts
export type PlaceResult = { lat: number; lng: number; name: string; address: string; boundingBox: [south: number, north: number, west: number, east: number] | null };
export type NominatimErrorCode = 'network' | 'timeout' | 'rate_limited' | 'blocked' | 'server' | 'invalid_response' | 'aborted';
export class NominatimError extends Error { code: NominatimErrorCode }
export function searchPlaces(query: string, opts?: { signal?: AbortSignal }): Promise<PlaceResult[]>;
export function reversePlace(lat: number, lng: number, opts?: { signal?: AbortSignal }): Promise<{ name: string; address: string } | null>; // null = nothing at that point
export function defaultNameFromReverse(r: ReverseJson | null, lat: number, lng: number): { name: string; address: string | null };
```

Requests (base `https://nominatim.openstreetmap.org`, HTTPS only):
- Search: `GET /search?format=jsonv2&q={encodeURIComponent(q)}&limit=5&addressdetails=1&accept-language={lang}`. Query trimmed, whitespace collapsed, length 2..200 (shorter = return `[]` without a request; longer = cut at 200). No `countrycodes`, no `viewbox` in MVP.
- Reverse: `GET /reverse?format=jsonv2&lat={lat}&lon={lng}&zoom=18&addressdetails=1&accept-language={lang}`. Coordinates `toFixed(6)`; must be finite and within range, else throw a plain `Error` before any network call (programming error).
- Headers (native only): `User-Agent: onMyWay/{version} ({email})`, `Accept-Language: {lang}`, `Accept: application/json`. A browser cannot set `User-Agent`: on web skip it and add `&email={email}` to the query instead (Nominatim's documented alternative; the browser sends its own UA/Referer). Only these headers; NEVER send the Supabase token, cookies or any user id.
- `lang`: device locale from `Intl.DateTimeFormat().resolvedOptions().locale` (e.g. `vi-VN`), fallback `en`. Header `Accept-Language: {locale},en;q=0.5`; query `accept-language` is the same list.
- Timeout 8 s per request: internal `AbortController` linked to the caller `signal` (abort either -> `aborted` if the caller aborted, `timeout` if the timer fired). `fetch` rejection -> `network`.
- Error map by HTTP status: 429 -> `rate_limited`; 403 -> `blocked` (UI shows the rate-limited copy; log in dev); 5xx -> `server`; other non-2xx or JSON that is not the expected shape -> `invalid_response`. UI mapping: `rate_limited`/`blocked` -> the rate-limited row; `network`/`timeout`/`server`/`invalid_response` -> the error row; `aborted` -> ignored silently. Reverse never surfaces an error to the user (10.7).
- Parsing: `lat`/`lon` are strings -> `Number`, drop entries that are not finite. `name` = `item.name` if non-empty else `defaultNameFromReverse`'s logic (below); `address` = `display_name`. `boundingBox` from `boundingbox` (four numeric strings) or null.

Throttle (shared by search and reverse) DECISION: a single serial queue, not rejection. Rationale: a rejected call looks like a user-visible failure for something that only needs 1 s of patience; the user flows here are one call at a time, so the queue stays at most 1-2 deep. Rules: a module-level promise chain guarantees at least 1100 ms between the START of two requests (1 s plus margin; also across retries); the first request after an idle period runs immediately. Queue depth is capped at 2: a newer SEARCH replaces a still-queued older search (the older rejects `aborted`); a reverse never gets replaced. Aborting a queued call removes it without consuming a slot. No automatic retry on 429/5xx (it would worsen load); the user taps "Try again".

Cache: module-level `Map`, LRU, max 50 entries, TTL 10 minutes, keys `s:{lowercase query}:{lang}` and `r:{lat.toFixed(5)},{lng.toFixed(5)}:{lang}` (5 decimals is about 1 m: the same pin position reuses the result). Only successful responses (including an empty search result) are cached; errors never. A cache hit returns without touching the throttle. Not persisted to disk.

### 10.7 Reverse geocoding and default name

- Only on confirm (tap "Use this location") and only when the pin has no known label: (a) after a search result was selected and not moved -> no request; (b) after a pan or GPS -> one `reversePlace(centerLat, centerLng)`.
- Edit flow: when opened with `lat`/`lng` and the user presses confirm without moving the pin, the same reverse runs (the caller keeps the existing stop name; see the note below).
- While the request runs the confirm button is `loading`. Timeout 8 s (plus up to 1.1 s queue wait; the total wait the user sees is capped at 9 s: past that, fall back).
- Derived name (`defaultNameFromReverse`), first non-empty of: `name` (a POI/shop/attraction name, e.g. "Ben Thanh Market"); `address.road` + optional `address.house_number` ("12 Nguyen Hue"); `address.neighbourhood` / `suburb` / `village` / `town` / `city` / `county`; the first comma-separated part of `display_name`. Trim, collapse spaces, max 80 characters. `address` = `display_name`, max 200 characters.
- Reverse FAILS (any error, timeout, or empty result) -> do not block: return `{ lat, lng, name: 'Dropped pin', address: null }`. The user can rename it in the trip form (step 10). No error dialog; the confirm bar's caption stays unchanged.
- Result lat/lng are the PIN position (map centre at confirm time, `toFixed(6)` as numbers), or the result's own coordinates when a search result was selected and the pin has not moved.
- Edit note for step 10: the caller should only replace a stop's `name` with the returned one if the stop's name is empty or still equals its previous auto name; otherwise keep the user's text and update only `lat`, `lng`, `address`. This is the caller's decision, not the picker's.

### 10.8 Search flow

1. User types freely (no requests). Submit (keyboard search key) with trimmed length >= 2: `search(q)`. Length 0-1: do nothing (the field keeps focus; no error).
2. `search` aborts the previous in-flight search (AbortController), sets `loading`, calls `searchPlaces`. A late response from an older call is discarded (compare a request counter).
3. Rows tap -> `onSelect`: dismiss the list and keyboard, move the camera (10.3), set the confirm label to the result's name/address, remember the pin as "unmoved".
4. Pressing submit again with the same text and `ready` results just re-shows the (cached) list.
5. The submit key is also ignored while status is `loading` (no duplicate queueing).

### 10.9 Web fallback

`react-native-maps` does not run on web. `components/map/location-picker-map.web.tsx` has the same props and ref (no-ops) and renders a bordered `surface` card (same style as `trip-map.web.tsx`): `Icon map xl` + "The map is available in the mobile app. Search for a place instead." The route is the same file: on web there is no pin, no locate button and no panning. The search bar and the result list work (Nominatim supports CORS, `email` query param instead of a User-Agent per 10.6). Tapping a result SELECTS it (row highlighted with `primarySoft` and 2 px `primary` border, `accessibilityState.selected`) and fills the confirm bar; confirm is disabled until a result is selected ("Search for a place to continue" as the confirm bar caption). Confirm returns the selected result; no reverse request is needed on web. Web is not a target; it must only not crash.

### 10.10 Copy

"Choose location", "Cancel", "Search for a place", "Clear search", "Searching...", "No places found", "Try a different name, or move the map to place the pin yourself.", "Could not search. Check your connection.", "Search is busy right now. Wait a moment and try again.", "Try again", "{n} places found", "Use my location", "Location permission is off. You can still search or move the map.", "Open settings", "Could not get your location. Try again or move the map.", "Move the map to place the pin", "Address is looked up when you confirm", "Use this location", "Dropped pin", "© OpenStreetMap contributors", "The map is available in the mobile app. Search for a place instead.", "Search for a place to continue", "Something went wrong", "Close".

### 10.11 Tester checklist

- Open from the stub/dev caller: the modal shows, Cancel and Android back/iOS swipe return with NO result (`takePickResult` returns null); confirm returns `{lat, lng, name, address}` once, a second `take` returns null.
- Opened with `lat`/`lng`: the pin starts there at street zoom; with no params and permission granted before: starts near the last known position; with no permission: world view and NO permission prompt on open.
- Typing never sends a request (watch the network log); only the search key does; text of 0-1 chars sends nothing. A second submit while loading is ignored; two quick different searches show only the second result.
- A result tap moves the pin, the bar shows its name + address, confirm sends NO reverse request; after any pan the bar reverts to coordinates; confirm then sends exactly one reverse request.
- Panning many times sends zero requests. Requests (search or reverse) are never closer than 1 s apart, including search followed immediately by confirm. Repeating the same search or the same pin position within 10 min hits the cache (no request).
- Every request carries `User-Agent: onMyWay/1.0.0 (quanhuynhvt2004@gmail.com)` on iOS/Android (inspect with a proxy); no Authorization header; the email appears only in `app.config.ts`.
- Errors: airplane mode -> "Could not search..." with Try again; simulate 429/403 -> the busy message and a disabled retry for 5 s; no results ("asdkjhqwe") -> "No places found"; reverse failure at confirm -> still returns "Dropped pin" with the exact pin coordinates and `address: null`.
- Location: grant -> the pin jumps to you; deny -> banner with Open settings, map/search/confirm still work; deny once then reopen: no repeated prompts; GPS off -> "Could not get your location".
- Layout: the pin tip is exactly at the map centre (compare the confirm coordinates with a known landmark); the confirm bar clears the home indicator; with the keyboard open the bar/locate/attribution are hidden and the result list is not covered; the attribution text is always visible and readable on light and dark tiles.
- Dark mode: map style, search card, results, banner, bar all themed; Dynamic Type 200%: no clipped text, the bar grows, the button stays tappable.
- Screen reader (VoiceOver/TalkBack): map skipped with its single label, search field, clear, results, locate, confirm all reachable with correct labels; result count announced; the changed confirm label is announced.
- Targets: all controls >= 44x44.
- Web: the page renders, search works, a result must be selected before confirm, returns the result, no crash.
- Security: no logging of queries or coordinates in production builds; HTTPS only; query is URL-encoded; the picker never sends data to Supabase.

---

## 11. Step 10 - Create / edit trip

Scope: the real `trip/new` form, the new `trip/[id]/edit` form, local drafts (new trip only), photo pick/compress, the publish pipeline (insert, upload, `save_trip_stops`, visibility) and the edit-save pipeline. Supersedes: PLAN 1.5 (sticky Publish footer, drag handle, undo snackbar, `reorder_stops` RPC) and PLAN 2.9 "stops in one insert, photos in one insert" (replaced by the `save_trip_stops` RPC from `0002_save_trip_stops.sql`), and DESIGN 9.5 "Edit trip is DEFERRED". No new libraries: `@react-native-async-storage/async-storage`, `expo-image-picker`, `expo-image-manipulator`, `expo-image` are installed. `expo-file-system` and `expo-crypto` are NOT installed and not needed (see 11.9, 11.12). Before coding, check the SDK 57 docs for `expo-image-picker` option names (`allowsMultipleSelection`, `selectionLimit`, `orderedSelection`, `allowsEditing`, `aspect`) and `expo-image-manipulator` (`ImageManipulator.manipulate` pattern as in `profile/edit.tsx`).

### 11.1 Decisions (summary)

| Topic | Decision |
|---|---|
| Layout | One scrolling screen, shared by create and edit (`TripForm`); no wizard |
| Presentation | Both routes `fullScreenModal`, `gestureEnabled: false` (a long scrolling form + nested pick-location modal + iOS sheet swipe-down would fight; Cancel and the guard cover leaving) |
| Primary action | Header right text button ("Publish" / "Save"), same pattern as Edit profile; plus a full-width `Button` at the end of the form for the create flow (users finish at the bottom). No sticky footer (it floats above the keyboard) |
| Reorder | MOVE UP / MOVE DOWN buttons only. No drag in MVP (11.5) |
| Visibility | Two-option radio group "Public" / "Private", default Public on create; edit shows the current value |
| Drafts | Local, new trip only, autosave. NO drafts for edit; edit has only an unsaved-changes confirm |
| Delete trip | Not duplicated here. It stays in the trip detail owner menu |
| Edit entry | Pencil `IconButton` ("Edit trip") next to "Trip options" in the detail header (11.14) |
| Stop delete | Confirm only when the stop has content; NO undo snackbar in MVP |
| Cover | Optional, cropped 16:9 at pick time |
| Ids | The client generates RFC 4122 v4 UUIDs for trip, stops and photos (11.12) |

### 11.2 Files

| File | Purpose |
|---|---|
| `app/(app)/trip/new.tsx` (replace placeholder) | Create screen: header, draft restore, `useTripForm`, publish flow, leave guard |
| `app/(app)/trip/[id]/edit.tsx` (new) | Edit screen: `useTrip(id)` load, ownership check, form init, save flow, leave guard. A file `trip/[id].tsx` and a folder `trip/[id]/` coexist in Expo Router; the coder verifies typed routes accept `/trip/${id}/edit` and keeps this path |
| `app/(app)/_layout.tsx` (edit) | Registrations (11.3) |
| `components/trip-form/trip-form.tsx` | Presentational scroll body. Props: `mode: 'create' \| 'edit'`, `form`, `actions` (from the hook), `errors`, `remoteUrls: Record<string, string>` (signed URLs for existing photos), `disabled` (while saving), `onAddStop`, `onChangeLocation(stopId)`, `scrollRef`, `banner` node. No data fetching |
| `components/trip-form/cover-picker.tsx` | Cover block (11.4) |
| `components/trip-form/visibility-picker.tsx` | Radio group (11.4) |
| `components/trip-form/stop-editor-card.tsx` | One stop card, wrapped in `React.memo`, callbacks take the stop id (11.4) |
| `components/trip-form/stop-photo-strip.tsx` | Horizontal photo tiles + add tile (11.4) |
| `components/trip-form/publish-progress.tsx` | Blocking overlay with steps, progress and failure actions (11.8); also used with `variant="save"` for edit (11.10) and `variant="discard"` |
| `hooks/use-trip-form.ts` | `useReducer` form state + actions + derived (`errors`, `isEmpty`, `dirty`) |
| `hooks/use-trip-draft.ts` | Load once, debounced autosave, flush on background, clear |
| `hooks/use-unsaved-guard.ts` | `beforeRemove` listener shared by both screens (11.7) |
| `lib/trip-form.ts` | Types, `emptyForm()`, `normalizeForm`, `validateForm`, `toPayload`, limit constants |
| `lib/trip-drafts.ts` | AsyncStorage `loadDraft(uid)`, `saveDraft(uid, draft)`, `clearDraft(uid)` |
| `lib/trip-images.ts` | `pickStopPhotos(maxCount)`, `pickCover()`, `compressToJpeg` (11.9) |
| `lib/trip-storage.ts` | Move `listAll` out of `use-trip.ts`; add `removePaths(paths)` best effort, `removePrefix(uid, tripId)`, `uploadJpeg(path, uri)` |
| `lib/trip-publish.ts` | `publishTrip`, `discardPublishedTrip` (11.8) |
| `lib/trip-save.ts` | `saveTripEdits` (11.10) |
| `lib/trip-errors.ts` | `classifyTripError(e)` -> `'network' \| 'limit' \| 'not_owner' \| 'invalid' \| 'photo_missing' \| 'unknown'` (11.11) |
| `lib/random-id.ts` (edit) | Add `randomUuid()` (11.12) |
| `lib/trip-events.ts` (edit) | Add `{ type: 'created'; id }` and `{ type: 'updated'; id }` |
| `hooks/use-trip.ts` (edit) | Subscribe to `updated` for its id and call `refresh()`; import `listAll` from `lib/trip-storage.ts` |
| Feed / profile list hooks (edit) | On `created` and `updated`, refresh the first page (same mechanism they already use for `removed` / `visibility`) |
| `components/ui/icon.tsx` (edit) | Add `arrow-up` (`arrow.up` / `arrow_upward`), `arrow-down` (`arrow.down` / `arrow_downward`), `trash` (`trash` / `delete`), `edit` (`pencil` / `edit`); `pin` (`mappin` / `location_on`) if step 9 has not added it |
| `components/ui/screen.tsx` (edit) | Optional `scrollRef?: Ref<ScrollView>` forwarded to the internal `ScrollView` (needed for scroll-to-error and scroll-to-new-stop) |
| `app/(app)/trip/[id].tsx` (edit) | Pencil button (11.14) |

### 11.3 Routes and header

Registration in `(app)/_layout.tsx` (replace the `trip/new` entry, remove `headerShown: false`):

```tsx
<Stack.Screen name="trip/new" options={{ presentation: 'fullScreenModal', title: 'New trip', gestureEnabled: false }} />
<Stack.Screen name="trip/[id]/edit" options={{ presentation: 'fullScreenModal', title: 'Edit trip', gestureEnabled: false }} />
```

Header (set from each screen with `<Stack.Screen options>` like `profile/edit.tsx`; reuse/extract its `HeaderTextButton` into `components/ui/header-text-button.tsx`):
- Left: "Cancel" (text button, `router.back()`, which triggers the guard in 11.7). Disabled while a save/publish runs.
- Right: create "Publish", edit "Save" (bold, `primary`). Create: always enabled when not busy (validation runs on press, per 6.2). Edit: enabled only when `dirty && !busy`. While busy shows a spinner in place of the label.
- Android hardware back: goes through `beforeRemove` (guard). While busy it is blocked.
- Body: `Screen scroll edges={['left','right','bottom']}`, `padded` default, `keyboardAvoiding`. Vertical gap between sections `Spacing.four`, inside a section `Spacing.three`.

After create success: `router.replace(`/trip/${tripId}`)`. The modal is replaced by a normal pushed detail, so Back from the detail returns to the previous screen (Feed or Profile), not to the form. After edit success: `router.back()` (the detail refreshes through the `updated` event).

### 11.4 Form layout (top to bottom)

Create and edit are identical except where noted.

1. Draft note (create only, after the first autosave): `caption` `textMuted` "Draft saved on this device". Not a live region.
2. Banner slot: `ErrorBanner` (save/publish error, photo permission, partial publish notice). Announced when it appears.
3. Cover (`CoverPicker`): a 16:9 box, full content width, `Radius.lg`, overflow hidden.
   - Empty: bg `primarySoft`, 2 px dashed `borderStrong` border, centred `image` icon (`primary`) + "Add cover photo" (`label`). The whole box is a button (label "Add cover photo", hint "Opens your photo library").
   - Set: image (`contentFit="cover"`). Below it a row with ghost `sm` buttons "Change photo" and "Remove photo". Tapping the image also changes it. Local picks use the local uri; existing covers use the signed URL.
   - Processing a pick: the box shows a spinner on `overlay` until the file is compressed.
4. Title: `TextField` label "Trip title", `maxLength 120`, `showCounter`, `autoCapitalize="sentences"`, `returnKeyType="next"` -> focuses Description. Error "Enter a title for your trip." (no "required" marker; the submit error is enough).
5. Description: `TextField multiline`, label "Description (optional)", `maxLength 5000`, `showCounter`, helper "What is this trip about?". Empty saves as `null`; trim and collapse 3+ newlines to 2 (same helper as bio in `profile/edit.tsx`; extract to `lib/trip-form.ts`).
6. Visibility (`VisibilityPicker`): label "Who can see this trip" (`label`), two stacked option rows, each a `Pressable` >= 56 px, `accessibilityRole="radio"`, `accessibilityState={{ selected }}`, inside a container with `accessibilityRole="radiogroup"`. Row: no leading icon; title `bodyStrong` + caption `textMuted`, and a trailing 24 px circle (selected = filled `primary` with a `check` glyph in `onPrimary`; unselected = 2 px `borderStrong` ring). Selected row has 2 px `primary` border and `primarySoft` bg; unselected 2 px transparent border (no layout shift).
   - "Public" / "Everyone on onMyWay can see this trip." (default on create)
   - "Private" / "Only you can see this trip."
7. Stops section: header row "Stops" (`heading`, header role) + caption "{n} of 20". Then:
   - Empty (0 stops): bordered `surface` block, `map` icon, "No stops yet", message "Add the places you will visit, in order.", primary `Button` "Add the first stop".
   - Cards (`StopEditorCard`), plain `View` map (max 20; not a FlatList: it sits in the ScrollView), gap `Spacing.three`, `key = stop.id` (stable, so inputs keep state and focus when a card moves).
   - Below the cards (>= 1 stop): `Button variant="secondary" icon="plus" fullWidth` "Add stop". At 20 stops: `disabled` and caption `textMuted` "You've reached the limit of 20 stops." (keeps the button visible so the limit is explained).
   - Submit error (no stops): inline caption in `danger` with `alert` icon: "Add at least one stop to publish." (live region `polite`).
8. Bottom action (create only): `Button size="lg" fullWidth` "Publish trip", with `loading` while publishing; under it a ghost `sm` button "Save draft and close" (flushes the draft, then leaves without the prompt). Edit: `Button size="lg" fullWidth` "Save changes". Bottom padding `Spacing.six`.

#### Stop card (`StopEditorCard`)

Card: bg `surface`, `Radius.lg`, padding `Spacing.three`, gap `Spacing.three`. Props: `stop`, `index` (0-based), `count`, `errors`, `remoteUrls`, `disabled`, and callbacks `onChange(id, patch)`, `onMove(id, -1 | 1)`, `onDelete(id)`, `onChangeLocation(id)`, `onAddPhotos(id)`, `onRemovePhoto(id, photoId)`, `onLayout`.

- Row 1 (header): number badge (28 px circle, `primary` bg, `onPrimary` bold number, same as the detail list and map marker), text "Stop {n}" (`subheading`, flex 1, header role), then three `IconButton`s (44x44 each, `plain`): `arrow-up` "Move stop {n} up" (disabled on first), `arrow-down` "Move stop {n} down" (disabled on last), `trash` "Delete stop {n}" (`color="danger"`). With a 320 px width this row is 28 + 3 x 44 + gaps: allowed; if Dynamic Type wraps the title, the title wraps, buttons stay.
- Name: `TextField` label "Stop name", `maxLength 120`, counter only when length >= 100, `autoCapitalize="words"`, `returnKeyType="next"` -> focuses Notes. Error "Enter a name for this stop."
- Location row: `Pressable` block (>= 56 px) showing `pin` icon (`primary`), address (`body`, 2 lines) or, when `address` is null, the coordinates "10.77690, 106.70090" (never both), and a trailing ghost `sm` `Button` "Change location" (the whole row is also pressable with the same label). Opens pick-location with `lat`, `lng` params (11.6).
- Notes: `TextField multiline`, label "Notes (optional)", `maxLength 5000`, counter only when length >= 4500, `autoCapitalize="sentences"`. Empty saves as `null`.
- Photos: label row "Photos" (`label`) + caption "{n}/5" right-aligned, then `StopPhotoStrip`.

`StopPhotoStrip`: horizontal `ScrollView` (no snap), tile 96x96, `Radius.md`, gap `Spacing.two`, `expo-image` (`contentFit="cover"`, `cacheKey` = path when remote). Each photo tile = image + a 44x44 hit-area close `IconButton` in the top-right corner (visual 24 px dark `overlay` circle with white `close` glyph, hit area 44 via the button box, the tile padding keeps it inside the tile). Tile accessibility: the image is `accessible` role `image`, label "Photo {i} of {m} for {stop name or 'stop {n}'}"; the close button is a sibling focus target "Remove photo {i}". A failed/missing file shows an `image` icon placeholder with caption "Unavailable" and a `danger` border; the same remove button works. Add tile (shown only when `photos.length < 5`): 96x96 dashed `borderStrong`, `plus` icon + "Add photo" (`caption`), role button, label "Add photo to stop {n}", hint "You can add {remaining} more". While photos are being compressed, the add tile is replaced by a spinner tile and presses are ignored. No photo reordering and no photo viewer inside the form (remove and re-add; the detail screen has the viewer).

### 11.5 Reorder decision: move up / down only

`react-native-draggable-flatlist` is a vertical virtualized list that must own the vertical scroll. The form is one `ScrollView` with a cover, three inputs and photo strips; nesting a draggable list inside it breaks scrolling and gesture handoff, and making the whole form the `DraggableFlatList` (header and footer components) means 20 tall cards with focused `TextInput`s, keyboard insets, and a drag handle that must start a pan over a long card inside a scroll: fragile on both platforms and hard to make accessible. With at most 20 stops, two 44 px buttons per card are reliable, work with VoiceOver/TalkBack and keyboards, and need no gesture dependency. The library stays installed but unused; drag reorder is deferred (post-MVP, only if user feedback asks for it).

Behaviour:
- `moveStop(id, dir)` swaps the stop with its neighbour in `form.stops`. Numbers, labels and the map order derive from the index, so they update at once.
- Visual: `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` before the state change, skipped when `AccessibilityInfo.isReduceMotionEnabled()` is true (cache the value on mount). On Android enable via `UIManager.setLayoutAnimationEnabledExperimental` only if the docs for the installed RN still require it; otherwise no animation is acceptable.
- Keep the moved card in view: parent records each card's y with `onLayout` (same pattern as the detail screen) and calls `scrollTo({ y: cardY - Spacing.three, animated: true })` after the update settles (next frame).
- Announce: `AccessibilityInfo.announceForAccessibility("Stop moved to position {n} of {m}")`.
- Disabled (not hidden) at the ends, with `accessibilityState.disabled`.

### 11.6 Add and change location

State: `pendingPickRef = useRef<{ requestId: string; target: { kind: 'add' } | { kind: 'change'; stopId: string } } | null>(null)`.

- Add: `requestId = randomId()`; `pendingPickRef.current = { requestId, target: { kind: 'add' } }`; `router.push({ pathname: '/pick-location', params: { requestId } })`. Disabled at 20 stops and while busy.
- Change: same with `target: { kind: 'change', stopId }` and params `lat`, `lng` as strings.
- Result: in the screen, `useFocusEffect(useCallback(() => { const p = pendingPickRef.current; if (!p) return; const r = takePickResult(p.requestId); pendingPickRef.current = null; if (!r) return; ... }, []))`. Cancel leaves no entry, so nothing changes.
  - Add: if `stops.length >= 20` ignore (defensive). Append `{ id: randomUuid(), name: r.name, autoName: r.name, notes: '', lat, lng, address: r.address, photos: [] }`, then scroll to the new card and announce "Stop {n} added". Do not focus a field (it would raise the keyboard on return).
  - Change: update `lat`, `lng`, `address`; replace `name` (and `autoName`) with `r.name` ONLY if `name.trim() === ''` or `name === autoName`; otherwise keep the user's text (DESIGN 10.7 note). If the name did not change, keep `autoName` as is.
- `autoName` is part of form state and the draft; it is not sent to the server.

### 11.7 Leaving, drafts and the unsaved-changes guard

`hooks/use-unsaved-guard.ts` registers `navigation.addListener('beforeRemove', ...)` like `profile/edit.tsx`, with refs `leavingRef` (set before a deliberate `router.back()/replace`) and `busyRef` (blocks while saving/publishing: `e.preventDefault()` and nothing else). It receives a `mode` and the callbacks below.

#### Create (new trip)

Dirty = form is not empty (`isEmpty` = no trimmed title, no trimmed description, no cover, no stops). An empty form leaves silently and removes any saved draft. Otherwise `Alert.alert('Save this trip as a draft?', 'You can finish it later.', [Keep editing (cancel), Discard (destructive), Save draft])` (three buttons: fine on Android).
- Save draft: flush the draft immediately (do not wait for the debounce), set `leavingRef`, dispatch the original action.
- Discard: if the draft has a `tripId` (publish was started) -> `discardPublishedTrip` with the `discard` overlay (11.8); on success clear the draft and leave; on failure stay and show the banner "Could not discard this trip. Please try again." with Retry. If no `tripId`: clear the draft and leave.
- Keep editing: stay.
- "Save draft and close" button in the form runs the Save draft path without the prompt.

Autosave (`use-trip-draft.ts`): on any form change, debounce 800 ms then `saveDraft`. An empty form removes the draft instead. Flush immediately on `AppState` change to `inactive`/`background` and on Save draft. Persist the publish bookkeeping immediately (not debounced) whenever the `tripId` is created or a photo `path` is assigned (11.8). Write failures (storage full) are ignored in the UI (dev log only). The first successful save sets the "Draft saved on this device" note.

Draft storage: key `onmyway:trip-draft:v1:${userId}` (per user; sign-out does NOT clear it, per 6.6). One draft per user. Value:

```ts
type TripDraft = { v: 1; savedAt: string; tripId: string | null; form: TripFormValues };
```
`TripFormValues` (also the reducer state): `{ title, description, visibility, cover: CoverValue | null, stops: StopValue[] }`, `StopValue = { id, name, autoName, notes, lat, lng, address, photos: PhotoValue[] }`, `PhotoValue = { id, uri: string | null, path: string | null }`, `CoverValue = { id, uri: string | null, path: string | null }`. `uri` = local compressed file; `path` = storage path (set once uploaded, or for existing server photos). The persisted form therefore already carries the uploaded paths, which is how a retry skips finished uploads. Parse errors, `v !== 1`, or a draft whose `userId` key does not match are ignored and removed.

Resume on open (create only): while the draft loads (a few ms) show the form skeleton (cover box + 3 field skeletons in a `SkeletonGroup`). If a non-empty draft exists: `Alert.alert('Resume your draft?', "You have an unfinished trip{ \"title\"}, saved {relative time}.{ It was partly published.}", [Discard draft (destructive), Resume])`, `cancelable: false`. Resume loads the form (and `tripId`). Discard draft: same cleanup as Discard above. Corrupt or empty draft: start fresh with no prompt.

Local photo files live in the cache directory and the OS may purge them. A draft photo whose file is gone shows the "Unavailable" tile (image `onError`) and fails the upload with `photo_missing` (11.11); the user removes it. No file-system library is added to pre-check.

Partly published notice (draft has `tripId`): `ErrorBanner` (no retry) "This trip was partly published and is still private. Publish to finish, or discard it."

#### Edit

No drafts. `dirty` = `JSON.stringify(normalize(form)) !== JSON.stringify(normalize(initial))` where `initial` is captured once from the loaded trip (do not re-initialise when `useTrip` refreshes; guard with a ref). Dirty and leaving: `Alert.alert('Discard changes?', 'You have unsaved changes.', [Keep editing (cancel), Discard (destructive)])` (same copy as 7.5). Discarding also deletes files uploaded by a failed save attempt (11.10). Not dirty: leave silently.

### 11.8 Photos: pick and compress (`lib/trip-images.ts`)

Reuses the avatar pattern (`launchImageLibraryAsync` then `ImageManipulator.manipulate(...).resize(...).renderAsync()` then `saveAsync({ format: SaveFormat.JPEG, compress: 0.8 })`).

| Kind | Picker options | Processing |
|---|---|---|
| Stop photos | `mediaTypes: ['images']`, `allowsMultipleSelection: true`, `selectionLimit: 5 - current`, `orderedSelection: true` (iOS), `quality: 1` | per asset, sequentially: if `max(width, height) > 1600` resize the long side to 1600 (keep aspect), else no resize; JPEG 0.8. Output is `image/jpeg` only |
| Cover | `mediaTypes: ['images']`, `allowsEditing: true`, `aspect: [16, 9]`, single (editing and multi-select are mutually exclusive), `quality: 1` | resize width to 1600 (1600x900), JPEG 0.8 |

Rules:
- If the picker returns more assets than free slots (some Android pickers ignore the limit), keep the first `remaining` and show a banner "Only {n} photos were added. A stop can have up to 5."
- Each processed photo is appended as `{ id: randomUuid(), uri, path: null }`. If some assets fail to process: add the successful ones and show "Some photos could not be added."; if all fail "Could not open your photo. Please try another." (6.x copy reuse).
- Permission denied (`getMediaLibraryPermissionsAsync` DENIED, as in `profile/edit.tsx`): banner "Allow photo access in Settings to add photos." with ghost button "Open settings" (`Linking.openSettings()`). On Android 13+ the system photo picker needs no permission.
- Expected size 200-700 KB per photo, far under the 10 MB bucket limit; JPEG only so the MIME rule holds.
- Replacing/removing a photo or cover whose `path` was already uploaded in this session (a failed publish left it in Storage) deletes that file best effort at once (`removePaths`), so it is not orphaned. Removing a photo that exists on the server (edit) only removes it from the form; the server file is deleted after a successful save (11.10).

### 11.9 Create / publish pipeline (`lib/trip-publish.ts`)

```ts
export type PublishStep = 'trip' | 'photos' | 'stops' | 'finish';
export type PublishProgress = { step: PublishStep; done: number; total: number }; // photos: x of y
export async function publishTrip(args: {
  userId: string; tripId: string; form: TripFormValues;
  onProgress(p: PublishProgress): void;
  onFormPatch(patch: { photoPaths: Record<string, string>; coverPath?: string }): void; // persist assigned paths into form + draft immediately
  signal?: { cancelled: boolean };
}): Promise<{ ok: true } | { ok: false; step: PublishStep; kind: ErrorKind; photoId?: string }>;
export async function discardPublishedTrip(userId: string, tripId: string): Promise<boolean>;
```

Sequence (authoritative, from db-designer):
1. Local validation (11.11). Failure: show inline errors, scroll to the first, abort (no overlay).
2. Create `tripId = randomUuid()` on first publish and persist it in the draft BEFORE the insert. Insert `trips` row `{ id: tripId, owner_id, title, description, visibility: 'private' }`. Error `23505` = already exists (retry): continue. Other errors map via 11.11.
3. Upload the cover (if `path` is null) and every photo with `path === null`, sequentially, to `trip-photos/{userId}/{tripId}/{uuid}.jpg` (`contentType: 'image/jpeg'`, `upsert: false`). Read the local file first (`fetch(uri).arrayBuffer()` as in avatars); a read failure = `photo_missing` for that photo (not a network error). After each successful upload call `onFormPatch` so the new `path` is in state and in the draft at once. Progress `done/total` counts only items that still needed upload on this attempt (finished ones from earlier attempts are skipped, and the bar starts at 0 of the remaining). Then `update trips set cover_path` when a cover exists (skip if already equal).
4. `rpc('save_trip_stops', { p_trip_id, p_stops })` once, `p_stops` = `form.stops.map` -> `{ id, name, lat, lng, address, notes, photos: [{ id, storage_path }] }` (client-generated ids; array order = positions). The returned removed paths are ignored here (a create has none).
5. `update trips set visibility = form.visibility` (check 0 rows as a failure `not_owner`; a Private choice makes this a no-op but still run it to keep the code path single).
6. Best-effort sweep: `listAll(prefix)` and remove files not referenced by the cover or photo paths (catches uploads whose response was lost on a retry). Failures ignored.
7. `clearDraft`, set `leavingRef`, emit `{ type: 'created', id }`, `router.replace('/trip/' + tripId)`.

Errors keep the draft and `tripId`. Retry re-runs from step 2 and skips what is done (idempotent by design).

`discardPublishedTrip`: `removePrefix` (list + remove all objects under `{userId}/{tripId}/`; if listing or removal fails return false and keep the row so a retry still finds the files), then delete the `trips` row (select to detect 0 rows; 0 rows = already gone = success). Caller then clears the draft.

#### Publish progress UI (`PublishProgress`)

A blocking overlay in the screen (same pattern as the delete overlay in `[id].tsx`: absolute, `overlay` scrim, `onStartShouldSetResponder`, `accessibilityViewIsModal`), with a centred `surface` card (`Radius.lg`, padding `Spacing.four`, max width 360).
- Title `heading` "Publishing your trip" (header role).
- Step list (rows >= 44 px, status icon + label + trailing detail):
  1. "Creating your trip"
  2. "Uploading photos" with trailing "{x} of {y}" and a 6 px determinate bar (`primary` on `border`); hidden when there is nothing to upload
  3. "Saving stops"
  4. "Finishing up"
  - Status icon: pending = empty 20 px circle (`borderStrong`), active = `ActivityIndicator`, done = `check` in `success`, failed = `alert` in `danger`. Never colour alone: the failed row also gets its text in `danger` and the message below.
- Live region: `accessibilityLiveRegion="polite"` on a visually hidden status text updated on STEP changes only ("Uploading photos", "Saving stops", ...), not on every photo (photo count is in the bar's `accessibilityValue={{ min: 0, max: total, now: done }}`).
- Reduce motion: no animated bar fill (set width directly).
- Failure state (same card, list stays so the user sees where it stopped): message under the list (11.11 copy), then buttons stacked full width:
  - `Button primary` "Retry" (hidden for `limit` and `invalid` errors, where retrying cannot help) -> resumes at the failed step.
  - `Button secondary` "Back to editing" -> closes the overlay, keeps the draft and the private half-created trip.
  - `Button ghost` (danger text via `destructive` variant `sm`) "Discard trip" -> `Alert` "Discard this trip?" / "This deletes the partly published trip and its uploaded photos from your account." [Cancel, "Discard" destructive] -> `discard` overlay variant ("Discarding..." spinner), then clear the draft and leave; failure -> back to the failure state with "Could not discard this trip. Please try again."
- Android back while running is blocked; in the failure state it behaves as "Back to editing". The header buttons are disabled while the overlay is up.

### 11.10 Edit save pipeline (`lib/trip-save.ts`)

```ts
export async function saveTripEdits(args: {
  userId: string; tripId: string; initial: TripFormValues; initialCoverPath: string | null;
  form: TripFormValues; uploadedThisAttempt: Set<string>; // mutated: paths uploaded now
  onProgress(p: { step: 'photos' | 'save'; done: number; total: number }): void;
}): Promise<{ ok: true; removed: string[] } | { ok: false; kind: ErrorKind; photoId?: string }>;
```

Sequence (authoritative):
1. Validate locally (11.11).
2. Upload new cover and new photos (`path === null`) first; track every uploaded path in `uploadedThisAttempt` and store it in the form state (`path` assigned) so a network retry skips them.
3. `update trips set title, description, cover_path, visibility where id` with `.select('id').maybeSingle()`; 0 rows or no data = `not_owner`.
4. `rpc('save_trip_stops')` with the FULL list; existing stops and photos keep their ids (updates), new ones use new uuids.
5. On success: best-effort delete the RPC's returned paths plus the old cover (`initialCoverPath`) when it was replaced or removed; emit `{ type: 'updated', id }`; `router.back()`.

Error handling:
- Definite PG error (not network): delete the files in `uploadedThisAttempt` (best effort), clear their `path` values in the form, show the banner; the form stays intact.
- Network error: keep everything (uploaded paths stay in the form and the set), show the banner with Retry.
- Retry re-runs the whole sequence; steps 3-4 are idempotent.

UI: while saving, a lighter `PublishProgress variant="save"`: scrim + spinner + "Saving changes..." (and "Uploading photos {x} of {y}" while uploading), blocking touches and Android back, no step list. Failure: overlay closes, `ErrorBanner` at the top of the form with the message and Retry (`retrying` while running), form unchanged; the banner is announced. Header Save shows a spinner while busy.

Edit load states (`useTrip(id)`):

| State | UI |
|---|---|
| `loading` | `SkeletonGroup`: cover 16:9 box, title and description field skeletons, visibility block, 2 stop card skeletons (height 220); header Save disabled |
| `unavailable` | `EmptyState icon="lock"` "Trip unavailable" / "This trip doesn't exist, was removed, or is private." / "Go back" |
| `error` | `ErrorBanner` "Could not load this trip." + Retry |
| `ready` but `!isOwner` | `EmptyState icon="lock"` "You can't edit this trip" / "Only the person who created it can change it." / "Go back" |
| `ready`, owner | The form, initialised once from the trip |

Existing photo and cover images use ONE `useSignedUrls` call for all paths (as in the detail screen).

### 11.11 Validation, limits and error mapping

Limits (constants in `lib/trip-form.ts`): `MAX_STOPS 20`, `MAX_PHOTOS_PER_STOP 5`, `TITLE_MAX 120`, `STOP_NAME_MAX 120`, `TEXT_MAX 5000`.

Local validation on Publish/Save (6.2 principles): trim strings; send `null` (never `''`) for description, notes and address. Title 1-120, stops 1-20, each stop name 1-120, photos <= 5 per stop, description and notes <= 5000, lat/lng finite and in range. Before the first press nothing shows. After the first press, re-validate live. A failed press focuses the first invalid text field or, for "no stops", scrolls to the Stops section (`scrollRef.scrollTo`, positions from `onLayout`), and announces "Fix {n} problems to continue" via `announceForAccessibility`.

Limit UI: Add stop disabled at 20 with the limit caption; the photo add tile is hidden at 5; counters as in 11.4. Defensive checks in the reducer ignore adds beyond the limits.

Error classification (`classifyTripError`, by `error.code`, never by message text):

| Source | Kind | UI message |
|---|---|---|
| Network (`isNetworkError` from `lib/auth-errors.ts`, thrown fetch failure) | `network` | "No connection. Check your internet and try again." + Retry |
| `P0001` | `limit` | "A trip can have up to 20 stops and 5 photos per stop. Remove some and try again." (no Retry, Back to editing) |
| `42501`, or 0 rows from the trip update | `not_owner` | "You can't change this trip." (no Retry) |
| `23502`, `23514` | `invalid` | "Some details are not valid. Check the title and stop names, then try again." (no Retry) |
| `22023`, `22P02`, anything unknown | `unknown` | "Something went wrong. Please try again." + Retry |
| Local file unreadable | `photo_missing` | "A photo is no longer available. Remove it and try again." (the tile is flagged "Unavailable"; no Retry) |
| Storage upload error (non-network) | `unknown` | "Could not upload your photos. Please try again." + Retry |

### 11.12 `randomUuid()` and ids

`lib/random-id.ts` today falls back to a non-UUID hex string. The DB columns are `uuid`, so add `randomUuid()`: `crypto.randomUUID()` when available, else build a v4 string from `getRandomValues` (set version and variant bits), last resort `Math.random`-based v4. Use it for trip, stop, photo and cover ids. File names under Storage can keep using the photo's id: path = `{userId}/{tripId}/{photoId}.jpg` (so the path is deterministic per photo; a retry after a lost response re-uploads to the same path, and a `409 Duplicate` response is treated as success). The step 6 sweep stays as a safety net. `randomId()` remains for the pick-location `requestId`.

### 11.13 Keyboard, safe areas, scrolling

- `Screen scroll` gives `keyboardShouldPersistTaps="handled"`, interactive dismiss on iOS, `automaticallyAdjustKeyboardInsets`. Multiline fields near the bottom must remain visible on a small phone; on Android (edge-to-edge) the coder verifies on a device and reports the result (DESIGN 3.4).
- Return key chain: Title next -> Description (multiline, Return = newline) ; Stop name next -> that stop's Notes. No chain across cards.
- Tapping Add stop/Change location/photo buttons while a field is focused: `Keyboard.dismiss()` first.
- Bottom padding of the scroll content >= `Spacing.six` plus the bottom inset (the Screen applies the inset); nothing sits under the home indicator.
- Header height is native, so the Screen uses `edges={['left','right','bottom']}`.
- Dark mode: only theme tokens; dashed borders use `borderStrong`; photo close buttons use the `overlay` colour with a white glyph so they read on any photo.

### 11.14 Entry points

- Create: Feed header "+" and empty-state CTAs already push `/trip/new` (7.2, 8.1); no change.
- Edit: in `trip/[id].tsx` the owner `headerRight` becomes a row of two `IconButton`s: `edit` "Edit trip" (-> `router.push(`/trip/${id}/edit`)`) and the existing `more` "Trip options". Reason: Android `Alert.alert` supports at most 3 buttons, and the menu already uses 3 (toggle, Delete, Cancel); a fourth item would be dropped. Both disabled while `menuBusy || deleting`. The menu content is unchanged. Hide the pencil unless `isOwner`.
- The detail screen refreshes on the `updated` event (11.2), so an edit shows immediately on return.

### 11.15 States summary

| State | UI |
|---|---|
| Create, loading draft | Form skeleton, header Publish disabled |
| Create, fresh | Empty form, Visibility = Public, no stops block |
| Create, resumed | Prefilled form; partial-publish banner if `tripId` exists |
| Validation failed | Inline errors, focus/scroll to first, VoiceOver announcement |
| Publishing | Overlay with steps (11.9) |
| Publish failed | Same overlay in failure state: Retry / Back to editing / Discard trip |
| Discarding | Overlay "Discarding..." |
| Edit saving | Overlay "Saving changes..." |
| Edit save failed | Banner with Retry; form kept |
| Photo picking | Spinner tile / cover spinner; add controls ignored |
| Photo permission denied | Banner with Open settings |
| Photo file missing | Tile "Unavailable" with Remove |
| Limits | Add stop disabled with caption at 20; add-photo tile hidden at 5 |

### 11.16 Accessibility

- Every icon button has an explicit label with the stop number ("Move stop 2 up", "Delete stop 2", "Remove photo 3"); all hit areas >= 44x44 (photo close buttons keep a 44 px box over a 24 px glyph).
- Order of focus per card: header row (title, up, down, delete), name, location, notes, photo label, tiles (image then its Remove), Add photo.
- Visibility is a radiogroup with `selected` state; stops section header and each card title have `accessibilityRole="header"`.
- Errors: inline errors use `TextField` (live region); the "no stops" error and banners are live regions. Progress overlay is a modal (`accessibilityViewIsModal`); step changes are announced once each.
- Move up/down, add stop, delete stop and photo add/remove all announce their result (`announceForAccessibility`): "Stop moved to position 2 of 5", "Stop 4 added", "Stop deleted", "Photo added", "Photo removed".
- Dynamic Type 200%: header row wraps, buttons grow (heights are minimums), counters never clip.
- Colour is never the only signal (icons and text accompany `danger`, `success`, `selected`).

### 11.17 Copy

| Where | String |
|---|---|
| Screen titles | "New trip" / "Edit trip" |
| Header | "Cancel" / "Publish" / "Save" |
| Fields | "Trip title" / "Description (optional)" / "What is this trip about?" / "Who can see this trip" / "Stop name" / "Notes (optional)" / "Photos" |
| Visibility | "Public" / "Everyone on onMyWay can see this trip." / "Private" / "Only you can see this trip." |
| Cover | "Add cover photo" / "Change photo" / "Remove photo" |
| Stops | "Stops" / "{n} of 20" / "No stops yet" / "Add the places you will visit, in order." / "Add the first stop" / "Add stop" / "You've reached the limit of 20 stops." / "Stop {n}" / "Change location" / "Add photo" / "Unavailable" |
| Actions | "Publish trip" / "Save changes" / "Save draft and close" |
| Draft note | "Draft saved on this device" |
| Resume alert | "Resume your draft?" / "You have an unfinished trip{ \"title\"}, saved {relative time}.{ It was partly published.}" / "Discard draft" / "Resume" |
| Leave alert (create) | "Save this trip as a draft?" / "You can finish it later." / "Keep editing" / "Discard" / "Save draft" |
| Leave alert (edit) | "Discard changes?" / "You have unsaved changes." / "Keep editing" / "Discard" |
| Delete stop alert | "Delete this stop?" / "Its notes and photos will be removed from this trip." / "Cancel" / "Delete" |
| Partial publish | "This trip was partly published and is still private. Publish to finish, or discard it." |
| Progress | "Publishing your trip" / "Creating your trip" / "Uploading photos" / "{x} of {y}" / "Saving stops" / "Finishing up" / "Saving changes..." / "Discarding..." |
| Failure actions | "Retry" / "Back to editing" / "Discard trip" / "Discard this trip?" / "This deletes the partly published trip and its uploaded photos from your account." / "Discard" |
| Validation | "Enter a title for your trip." / "Enter a name for this stop." / "Add at least one stop to publish." / "Fix {n} problems to continue" |
| Photos | "Only {n} photos were added. A stop can have up to 5." / "Some photos could not be added." / "Could not open your photo. Please try another." / "Allow photo access in Settings to add photos." / "Open settings" / "A photo is no longer available. Remove it and try again." |
| Errors | "No connection. Check your internet and try again." / "A trip can have up to 20 stops and 5 photos per stop. Remove some and try again." / "You can't change this trip." / "Some details are not valid. Check the title and stop names, then try again." / "Something went wrong. Please try again." / "Could not upload your photos. Please try again." / "Could not discard this trip. Please try again." |
| Edit states | "You can't edit this trip" / "Only the person who created it can change it." / plus the existing "Trip unavailable" and "Could not load this trip." |
| Detail | "Edit trip" (a11y label of the pencil) |
| Announcements | "Stop {n} added" / "Stop deleted" / "Stop moved to position {n} of {m}" / "Photo added" / "Photo removed" |

### 11.18 Tester checklist

Create
- "+" opens the form; Visibility defaults to Public; Publish on an empty form shows the title and "no stops" errors, focuses/scrolls to the first, and creates nothing in Supabase.
- Add stop opens pick-location; confirm appends a numbered card with the picked name/address; cancel adds nothing; the 21st stop cannot be added (button disabled with the caption); Change location keeps a user-edited name and replaces an auto name.
- Move up/down reorder, update numbers, keep typed text and focus, are disabled at the ends, and the moved card stays in view; VoiceOver/TalkBack announce the new position.
- Delete: empty stop deletes immediately; a stop with a name edit, notes or photos asks first.
- Photos: multi-select adds up to the free slots (selecting 6 with 3 present adds 2 and shows the message); add tile disappears at 5; cover crop is 16:9; saved files are JPEG with long side <= 1600; permission denied shows the banner; a purged local file shows "Unavailable".
- Draft: type, wait 1 s, kill the app, reopen "+" -> "Resume your draft?"; Resume restores everything including photos; Discard draft clears it; the draft is per user (second account sees none); an empty form never leaves a draft; leaving a non-empty form shows Keep editing / Discard / Save draft and each works; empty form leaves silently.
- Publish success: overlay steps run in order, photo count x of y is right, ends on the trip detail (Back goes to the previous screen, not the form), the trip appears in the Feed (if Public) and on the profile at once, a Private choice stays invisible to others, the draft is gone, Storage contains only referenced files under `{uid}/{tripId}/`.
- Publish failures (airplane mode at each step: insert, mid-upload, stops, visibility): failure state shows the failed step; Retry resumes without re-uploading finished photos or duplicating the trip (check the table: one row, one set of files); Back to editing keeps the draft with the `tripId` and the partial-publish banner after a restart; Discard trip removes the files and the row and the draft. Forced `P0001`, `42501` and `23514` show the right copy and no Retry.
- Android back is blocked while publishing.

Edit
- Pencil appears only for the owner; non-owner deep link to `/trip/{id}/edit` shows "You can't edit this trip".
- The form is prefilled (title, description, visibility, cover, stops, photos with signed URLs); a background refresh does not overwrite typing.
- Unchanged -> Save disabled and Cancel leaves silently; changed -> Cancel asks "Discard changes?".
- Edit title/notes/order/add/remove stops and photos/replace or remove the cover/change visibility, Save: detail shows the new data immediately; existing ids are kept (stop rows updated, not recreated); removed photos and the replaced or removed cover are deleted from Storage; a failed Storage cleanup does not fail the save.
- Network error during upload or save: banner with Retry, nothing lost, Retry succeeds without duplicate uploads; a definite DB error deletes the files uploaded in that attempt.
- 20 stops/5 photos trips can be edited and saved (the RPC does not reject a full trip).

General
- Light and dark mode; Dynamic Type 200%; screen reader order and labels (11.16); touch targets >= 44; keyboard never hides the focused field (small phone, both platforms); safe areas on notch devices; no new lint or type errors; web renders without crashing (maps and picker are not a web target).
- Security: no secrets or draft content logged; draft key is per user; storage paths always start with the signed-in user's id and the trip id; the app never sends a service key.
