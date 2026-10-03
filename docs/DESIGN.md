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
