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
