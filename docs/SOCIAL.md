# onMyWay - Social features: like, comment, share/repost, save

Audience: coder, tester, manager, db-designer (section 9 only). Extends `docs/DESIGN.md` (call it D) and `docs/DESIGN-mvp.md`; where this file conflicts, THIS FILE WINS. Tokens, components, radii, shadows, motion, a11y rules of D apply unless overridden here. No app code is in this document.

## 0. Owner decisions (final) and my decisions

| # | Decision | Source |
|---|---|---|
| 1 | Likes, like counts and the who-liked list are PUBLIC | owner |
| 2 | Comments with ONE reply level (a reply to a reply attaches to the top-level parent); comments can be liked; comment owner deletes own; trip owner deletes any comment on their trip | owner |
| 3 | Share = (a) OS share sheet with a deep link (public trips only) and (b) in-app repost with optional caption | owner |
| 4 | Save (bookmark) is PRIVATE; "Saved" tab only on your OWN profile | owner |
| 5 | Private trips have NO social UI at all (no rail, no actions row, no comments entry, no save, no share). Existing data is kept and reappears if the trip becomes public again | designer |
| 6 | Cannot repost your own trip. One repost per user per original trip (the action becomes "Remove repost"). Reposting from a repost card reposts the ORIGINAL | designer |
| 7 | Reposts appear in the FEED only (not on the profile grid) in this phase. Actions on a repost card act on the ORIGINAL trip | designer |
| 8 | Double-tap-to-like only on the trip DETAIL cover, never on feed cards (a double-tap detector would delay or fight the single tap that opens the trip) | designer |
| 9 | No haptics: `expo-haptics` is not installed and D section 8 says "not needed". Do not install it; manager may approve later (one `Haptics.selectionAsync()` on like/save) | designer |
| 10 | Save is a top-right button on the cover (feed card and detail), not part of the right rail, and not in the share sheet | designer (uses the D slot "top-right reserved for save") |

## 1. Feed card: action rail, save, double-tap

Applies to `TripCard variant="feed"` (D 3.11), public trips only (decision 5).

### 1.1 Placement (hero layout)

Inside the existing `<View overlay pointerEvents="box-none">`, add two siblings AFTER the bottom text block (stable order: main button, overlay[author, text block, rail], top-right save):

- Rail: `position: absolute; right: 16; bottom: 16`, column, width 48, `alignItems: center`, gap 12, `pointerEvents="box-none"`. Items top to bottom: Like, Comment, Share. This is the D 3.11 "phase 2 slot"; the text column gets `paddingRight: 64` (style change on a mounted view, not an inserted view).
- Rail item = ONE `Pressable` 48 wide, containing a 44x44 circle and, under it (gap 2), the count `caption` `onImage`, `minHeight 16`, `maxFontSizeMultiplier 1.3`, `tabular-nums`. The count `Text` is ALWAYS mounted; content is empty when the count is 0 (Instagram style, no "0"). Pressable hit area = 48 x 62, above 44.
- Save: `position: absolute; top: 16; right: 16`, 44x44 circle, same states as rail circles. The private chip (top-left) never coexists with social UI, so no overlap.
- Scrim check: the rail top sits at about 49% of the card height from the bottom (3 x 62 + 2 x 12 + 16 = 226 of ~450); scrim alpha there is about 0.62 and every circle has its own fill, so contrast holds. Re-check with a white photo.

### 1.2 Circle visuals (states are never colour-only)

| State | Circle fill | Glyph |
|---|---|---|
| Off | `scrimChip` | outline glyph, `onImage` |
| Like ON | `onImage` (white) | filled heart, colour `likeOnImage` |
| Save ON | `onImage` (white) | filled bookmark, fixed `#A32C09` in both modes (the light `primaryPressed` value, because the circle is always white) |
| Comment / Share | `scrimChip` | outline glyph, `onImage` (no on-state) |

New tokens (both modes, add to `theme.ts`, coder runs the contrast check from D 2.2): `like` light `#D81B45`, dark `#FF6B88` (heart on `surface`/`background`/`surfaceMuted`, needs >= 3:1 as non-text; the dark value is for dark surfaces); `likeOnImage` `#D81B45` in both modes (heart on a white circle, 4.9:1). `like` is the ONLY non-coral accent; it is used for the heart glyph only, never for text or fills other than the circle glyph.

Size: glyph 24 (`Layout.iconSize.lg`). Count text is white on the scrim.

### 1.3 Icons (add to `IconName` / `ICONS` in `src/components/ui/icon.tsx`; the wrapper has no filled variants, so add an optional `filled?: boolean` prop to `Icon` that swaps to the filled name, or add separate names; coder verifies every name against the installed `expo-symbols` types)

| IconName | iOS (SF Symbols) | Android (Material Symbols) |
|---|---|---|
| `heart` / `heart-filled` | `heart` / `heart.fill` | `favorite` (outline vs FILL axis; if the installed Android set cannot render a filled variant, ship the same glyph and rely on the circle fill change + `selected` state) |
| `comment` | `bubble.left` | `chat_bubble` |
| `share` | `square.and.arrow.up` | `share` |
| `bookmark` / `bookmark-filled` | `bookmark` / `bookmark.fill` | `bookmark` (same FILL note) |
| `repost` | `arrow.2.squarepath` | `repeat` |
| `send` | reuse `arrow-up` | reuse `arrow-up` |
| `reply` | `arrowshape.turn.up.left` | `reply` |

### 1.4 Behaviour

- Like: optimistic. Tap flips the circle and count immediately (count +/- 1, never below 0), then syncs (section 8). Pop animation on the glyph: scale 1 -> 1.25 -> 1 over `Duration.fast` x2 with `Easing.out(cubic)`. Reduce motion: no scale, instant swap.
- Comment: opens `trip/[id]/comments` (section 3). Count = ALL comments including replies.
- Share: opens the share sheet (section 6) for public trips; on your OWN public trip the sheet omits "Repost".
- Count format `formatCount(n)`: 0 -> "" ; 1-999 as is; 1,000-9,999 "1.2K" (one decimal, drop ".0"); 10,000-999,999 "12K"; >= 1,000,000 "1.2M". The a11y value uses the exact number.
- Save: optimistic toggle; toast "Saved to your private list" on ON only (first time per session), "Removed from saved" on OFF is silent.
- Taps on rail items never navigate to the trip (they are siblings of the main button, not children).

### 1.5 Accessibility

| Control | role | label | value / state | hint |
|---|---|---|---|---|
| Like | `button` | "Like" | `accessibilityValue.text` "{n} likes" (e.g. "1 like"); `accessibilityState.selected = liked` | "Double tap to like this trip" (when selected: "Double tap to remove your like") |
| Comment | `button` | "Comments" | value "{n} comments" | "Opens the comments" |
| Share | `button` | "Share" | none | "Opens share options" |
| Save | `button` | "Save trip" | `selected = saved` | "Saves this trip to your private list" / "Removes this trip from your saved list" |

- After a toggle call `AccessibilityInfo.announceForAccessibility("Liked")` / "Like removed" / "Saved" / "Removed from saved" (also Android).
- Focus order in the card: main button, author, Like, Comment, Share, Save.
- Large-text fallback (`PixelRatio.getFontScale() >= 1.5`, D 3.11 stacked layout): the rail is replaced by the horizontal `TripActionBar` (1.6) rendered on the `surface` text block below the title, and Save becomes the last item of that bar (not on the image). Same hooks, same labels.

### 1.6 `TripActionBar` (horizontal, shared)

Used by: stacked feed card, repost card (section 2), trip detail (section 4). Row, gap 8, wraps (`flexWrap`) at large text. Items are `surfaceMuted` pills, height 44 (min), padding 12, radius `full`, glyph 20 + count `label`. Like pill = TWO touch targets inside one pill: the heart (toggle) and, when count > 0, the count (opens who-liked list, section 4.2); each >= 44 high, labels "Like" and "{n} likes, see who liked". Like ON: glyph `like` filled, pill fill `dangerSoft`-independent: use `primarySoft` fill and `text` count (state also carried by `selected` and filled glyph). Comment pill "{n}" + glyph. Share pill glyph + "Share". Save: trailing icon-only 44 circle `surfaceMuted`, `bookmark-filled` `primary` when ON. On `surface`, glyph colour `text` (off) so contrast >= 3:1.

## 2. Repost card in the feed

Feed item types (union, keys `trip:<tripId>` and `repost:<repostId>`): `TripCard` (existing) and `RepostCard` (new). A repost is NOT a full-bleed card, so it is visually lighter than a trip and clearly a different kind of item.

### 2.1 Layout (`RepostCard`, `src/components/trip/repost-card.tsx`)

`Card elevated` (radius `xl`, `Shadow.md`, padding 16, gap 12; dark mode 1 px border per D 2.6), full feed width, separator 16:

1. Header row: `Avatar md` (40) + column [`label` "{displayName}" + " reposted" in `textMuted`, 1 line; `caption` `textMuted` relative date] + trailing `more` `IconButton` (44) ONLY on the viewer's own repost (menu: "Remove repost"). Avatar + name block is one `Pressable` (>= 44) opening `user/[username]`.
2. Caption (only if present): `body`, `CollapsibleText` with 3-line collapse ("more"/"less"). Wrapped in an always-mounted slot (section 10); empty slot has height 0.
3. Embedded original: `TripCard variant="embedded"` (new variant): radius `lg`, 4:3 image (seeded gradient fallback), `tileScrim`, bottom block like the grid tile (title `label` 2 lines, `caption` "by @author · {n} stops"), 1 px `border`. Its own single `Pressable` opening `trip/[id]` of the ORIGINAL; label "Trip: {title}, by {author}. {n} stops. Reposted by {reposter}." No rail inside it.
4. `TripActionBar` (1.6) acting on the ORIGINAL trip (counts are the original's).

### 2.2 Original unavailable (private, deleted, or hidden by RLS)

Embedded slot renders an `unavailable` placeholder: `surfaceMuted` rounded box (radius `lg`, 4:3 collapsed to minHeight 120), `lock` icon 24 `textMuted`, `label` "This trip is no longer available", `caption` "The owner may have made it private or deleted it." It is NOT pressable and the `TripActionBar` is not rendered (the repost row never leaks which case it was). Header, caption and the reposter's menu remain, so the reposter can still remove the repost. Data requirement: the feed query must return the repost row even when the original is invisible, with `trip = null`.

### 2.3 Create, own-trip rule, un-repost

- Repost entry: share sheet row "Repost to your feed" (section 6). Not shown on your own trips. Not shown for private trips. If already reposted: row text "Remove repost" with `repost` icon (confirm below).
- Compose: route `trip/[id]/repost` (`presentation: 'modal'`, title "Repost"). Content on `background`: embedded preview card (non-interactive), `TextField variant="onCard"` multiline "Add a caption (optional)", max 280 chars, counter shown from 220 ("{n}/280"), trim ends, whitespace-only counts as empty (allowed, posts with no caption). Header: Cancel (left, `text`) and "Repost" (right, `primary`), plus a bottom `Button primary lg fullWidth` "Repost" for thumb reach (both call the same handler; header one is hidden on narrow height is NOT needed). Loading state on both while posting. Error: `ErrorBanner` "Couldn't repost. Try again." with Retry; already-reposted conflict (duplicate): treat as success. Discard guard: if the caption is non-empty and Cancel/back is used, `Alert` "Discard caption?" [Keep editing] [Discard].
- Success: dismiss, toast "Reposted to your feed", silently refetch page 1 of the feed (the repost appears at the top).
- Un-repost (from the repost card menu, or the share sheet row): `Alert` title "Remove repost?", message "It will be removed from your feed. The original trip is not affected.", [Cancel] [Remove] (destructive). Optimistic removal of the card with the usual revert on failure + toast "Couldn't remove the repost. Try again.".
- Deleting the original trip deletes (server side) its reposts or leaves them as placeholders per db-designer; the UI handles both (2.2).

## 3. Comments

### 3.1 Route

`src/app/(app)/trip/[id]/comments.tsx`, registered in `(app)/_layout.tsx` as `<Stack.Screen name="trip/[id]/comments" options={{ presentation: 'modal', title: 'Comments' }} />` with the shared stack options (D 3.10). Reason for a normal modal and not `formSheet`: keyboard + sheet detents are unreliable on Android; the modal behaves the same on both. `gestureEnabled` true; if the composer has unsent text, intercept dismiss via `usePreventRemove` / `beforeRemove` with the discard confirm of 3.7. Route params: `id` (trip), optional `focus=composer`. Header `headerLeft`/`headerRight`: native close ("Close" label on iOS modal swipe; Android back).

### 3.2 Structure (top to bottom)

`<View flex 1 background>` : `FlatList` (flex 1, `keyboardShouldPersistTaps="handled"`, `keyboardDismissMode="on-drag"`) then the composer area (3.4). Never put the composer inside the list.

### 3.3 List and items

- Top-level comments newest first. Page size 20, keyset pagination on (`created_at`, `id`), `onEndReached` threshold 0.5, footer row "Loading more" (spinner, `caption`) or the retry row "Couldn't load more comments. Retry" (ghost sm).
- `CommentItem` (`src/components/comments/comment-item.tsx`), row, padding 12 16, gap 12:
  - Left: `Avatar sm` (32; 28 for replies); avatar+name is a `Pressable` (>= 44 high including the name line) to `user/[username]`.
  - Middle (flex 1): line 1 `label` `{displayName}` + `caption` `textMuted` " · {relative date}" + ` · Trip owner` chip-like `caption` `primaryPressed` text "Author" when the commenter is the trip owner ("Author" with no background). Line 2 `body` text (selectable, `maxFontSizeMultiplier` 2.0). Line 3 actions: `Reply` ghost-text `label` `textMuted` (hit area 44 high via `hitSlop`) and, for deletable comments, a `more` `IconButton` 44 (menu "Delete comment" in an `Alert` list on Android and `ActionSheetIOS` on iOS, or the shared bottom sheet of section 6 - use the shared sheet for both platforms).
  - Right column (width 48, centre): heart `IconButton` 44 with count `caption` below (always-mounted count Text, empty at 0). Same states as 1.2 but on `background`: off outline `textMuted`, on filled `like`. Labels "Like comment" + value "{n} likes", `selected`.
- Replies: collapsed by default. Under a top-level comment that has `reply_count > 0`, an always-mounted slot holds the toggle `Pressable` (min height 44, indent 44 = avatar + gap): a 24 px hairline `border` + `label` `textMuted` "View {n} replies" ("View 1 reply"). Tap loads and shows the first 5 replies oldest first, toggle text becomes "Hide replies" and, when more remain, a second row "View {m} more replies". Replies are `CommentItem` with `isReply` (indent 44, avatar 28, no Reply-to-reply row: tapping Reply on a reply targets the parent and prefills "@username "). Reply loading: the toggle shows a spinner and `accessibilityState.busy`. Error loading replies: row "Couldn't load replies. Retry".
- Posting your own comment: appears at the top of the list (reply: at the END of that parent's visible replies, expanding the parent) immediately in the `sending` state: 60% opacity, `caption` "Sending...". On success it settles; on failure it shows `caption` `danger` with alert icon "Couldn't send. Tap to retry" (Pressable, retries) and a second action "Discard". Failed items persist until retried or discarded and never block new comments.
- New comments from other users are not pushed live; pull-to-refresh (tint `primary`) refetches page 1 and collapses expanded replies.

### 3.4 Composer (`CommentComposer`)

- Container: `surface` fill, top hairline `border`, padding 12 16, bottom padding `max(insets.bottom, 12)` (the screen is a modal so no tab bar), row, gap 12, `alignItems: flex-end`.
- Left: own `Avatar sm`. Middle: `TextInput` multiline, `minHeight 44`, max height 5 lines then scrolls, radius `lg` (use `TextField` internals or a bare themed input: fill `surfaceMuted`, 1.5 `borderStrong` on focus 2 `primary`), `maxLength={500}`, placeholder "Add a comment...", `textAlignVertical: 'top'` on Android, `returnKeyType` default (Enter = newline). Right: send `IconButton` 44, circle, fill `primary`, glyph `send` `onPrimary`; disabled (opacity 0.4, `accessibilityState.disabled`) when `text.trim().length === 0`, or while posting the SAME text. Label "Post comment" (reply mode: "Post reply").
- Validation: trim both ends on submit; collapse 3+ consecutive newlines to 2; reject empty/whitespace-only silently (button disabled, no error text); length 1-500 after trim. Counter `caption` `textMuted` shown only from 450 ("{n}/500"), `danger` at 500. Paste beyond 500 is truncated by `maxLength`.
- Send flow: clear the input and reply context immediately on tap (optimistic item shows the text); on failure the item goes to the failed state (3.3) and the text lives in the item, not the composer. Network error copy: "Couldn't send. Tap to retry". Rate limit: "You're commenting too fast. Try again in a moment." (toast; the item goes to the failed state).
- Reply mode: tapping Reply sets `replyTo = { parentId, username }`, focuses the input, prefills "@username " (plain text, no mention parsing), and shows a banner row ABOVE the input: `surfaceMuted`, `caption` "Replying to @username" + `close` `IconButton` 44 labelled "Cancel reply". The banner slot is always mounted (section 10); contents conditional. Closing the banner removes the prefilled "@username " only if it is still untouched.
- Keyboard: wrap list + composer in `KeyboardAvoidingView` (`behavior="padding"` on both platforms, `keyboardVerticalOffset = useHeaderHeight()` on iOS, 0 on Android with edge-to-edge; the coder verifies on a real Android 15 device and records the result). When the keyboard opens the list stays scrolled to where it was. Opening with `focus=composer` focuses the input after the transition (`InteractionManager.runAfterInteractions`).
- Signed-in users only (the whole `(app)` group is guarded); no logged-out state.

### 3.5 Delete

- Who: comment author, or the trip owner on any comment of their trip. Others never see the `more` button (the server also enforces).
- Menu item "Delete comment" (destructive colour `danger` + `trash` icon). Confirm `Alert`: title "Delete comment?", message "This can't be undone." for a comment without replies; for a top-level comment with replies: "This also deletes its {n} replies. This can't be undone." Buttons [Cancel] [Delete] (destructive). The trip owner deleting someone else's comment gets the same dialog.
- On confirm: optimistic removal (the whole subtree), the trip comment count drops by the number actually removed (server returns the new count; use it), toast on failure "Couldn't delete the comment. Try again." and the item returns. Deleting a reply only removes that reply and decrements the parent `reply_count`.

### 3.6 States

| State | UI |
|---|---|
| Loading first page | 4 comment skeletons (circle 32, two text bars) in `SkeletonGroup`, composer already usable |
| Empty | `EmptyState` compact: `comment` icon, title "No comments yet", message "Start the conversation." (no CTA; the composer is the CTA, input gets focus when the empty state shows after a tap on the comment button) |
| Error first page | `ErrorBanner` "Couldn't load comments." + Retry above the (still visible) composer |
| Trip unavailable (deleted/private meanwhile) | Replace the screen body with `EmptyState` "This trip is no longer available" + button "Go back"; composer hidden |
| Offline | Banner `caption` "You're offline. Comments will load when you're back." sending disabled with the same message in the failed state |

### 3.7 Accessibility and discard

- Each comment is a grouped container: `accessible={false}` on the row, with separate focus targets: author button ("{name}, profile"), body text (label includes "{name} said: {text}. {relative date}"), Like (value "{n} likes", selected), Reply (label "Reply to {name}"), More ("Comment options"). Replies toggle: label "View {n} replies", `accessibilityState.expanded`.
- Composer input label "Add a comment", hint "Maximum 500 characters". Announce "Comment posted" / "Reply posted" / "Comment deleted".
- Discard guard: closing with a non-empty draft -> `Alert` "Discard comment?" [Keep editing] [Discard].
- Large text: no fixed heights; the right column wraps below the text at font scale >= 1.5 (heart row inline with Reply).

## 4. Trip detail (`trip/[id]`, D 5.3)

Public trips only (decision 5). Order changes (new items marked):

1. Cover with **top-right Save circle** (44, same as 1.2, `position: absolute; top 16; right 16`). It mounts together with the cover; visibility is known at mount, so private trips never render it.
2. Title.
3. Author row.
4. **Actions row**: `TripActionBar` (1.6) with Like (+ count -> likes list), Comments ("{n}"), Share. Placed between the author row and the info tiles, `marginTop` section gap 16.
5. Info tiles, description, photos, route, stops, floating Follow button: unchanged.

The native header `headerRight` still shows owner `edit` and `more` on your own trips; Save is not in the header (it lives on the cover, like the feed). On your own public trip: Save is hidden (nothing to save) and the share sheet omits Repost; Like and Comment stay (you may like your own trip).

Double-tap on the cover likes (never unlikes): two taps within 300 ms. Show a centred heart (64, `onImage`, with `scrimChip`-less drop shadow `Shadow.lg`) that scales 0.6 -> 1.1 -> 1 and fades out over `Duration.slow`; reduce motion: fade only. If already liked: just show the animation, no request. Implementation: a transparent `Pressable` over the image counting taps (or gesture-handler `Gesture.Tap().numberOfTaps(2)` if `react-native-gesture-handler` is already a dependency; coder checks). Not announced as a control (`accessible={false}`); the Like button is the accessible path. A single tap on the cover does nothing (as today).

### 4.2 Who liked (`trip/[id]/likes`)

Route `src/app/(app)/trip/[id]/likes.tsx`, regular stack push (`title: 'Likes'`, back button). `FlatList` of rows (min height 64, padding 12 16): `Avatar md` 40, `label` displayName, `caption` `textMuted` @username; each row is a `Pressable` to `user/[username]`, label "{name}, @{username}". Newest like first, page size 30, keyset on (`created_at`, `id`), same footer/retry as comments. Header row (not sticky) `caption` "{n} likes". States: loading = 6 row skeletons; empty = `EmptyState` `heart` icon, title "No likes yet", message "Be the first to like this trip." (CTA ghost "Like this trip" only if the viewer has not liked and the trip is public); error = `ErrorBanner` "Couldn't load likes." + Retry. Entry points: the count in the detail Like pill only (the feed shows counts but opens nothing). Likes list is public to any signed-in user who can see the trip.

## 5. Profile: "Saved" tab

- Own profile (`(tabs)/profile`): `UnderlineTabs` with TWO tabs, "Trips" and "Saved" (supersedes D 5.2 item 6 and decision 7 single-tab rule, only for the own profile). Other profiles (`user/[username]`) keep the single non-interactive "Trips" header; Saved is never fetched for other users and no route exposes it.
- Same `FlatList numColumns={2}` and grid; only `data`, empty/loading states and the footer change when the tab changes. `numColumns` must NOT change between tabs. Keep each tab's loaded page and scroll offset in state so switching back is instant; refetch Saved on focus if the shared social store reports a save/unsave since the last load.
- Saved grid tile = grid variant with `showAuthor`: title `label` (2 lines) and `caption` `onImageMuted` "@username · {n} stops" (replaces the plain "{n} stops" line). No lock badge. Tile label "Saved trip: {title}, by {author}. {n} stops."
- Order: most recently saved first, page size 20, keyset on (`saved_at`, `id`). Trips that become private or deleted disappear from the list silently (the server omits them; never show a placeholder, to avoid leaking privacy).
- Privacy note: when "Saved" is active, a row under the tabs (padding 12 16, `lock` icon 14 + `caption` `textMuted`): "Only you can see what you've saved." Always shown on that tab, including when empty. Also announced when the tab is selected.
- Empty: `EmptyState` `bookmark` icon, title "Nothing saved yet", message "Tap the bookmark on a trip to keep it here.", CTA `Button secondary` "Browse the feed" -> `router.navigate('/')`.
- Error: `ErrorBanner` "Couldn't load your saved trips." + Retry. Loading: 4 grid skeleton tiles.
- Stats row (Trips/Stops/Photos) is unchanged and independent of the active tab. Pull-to-refresh refetches stats and the ACTIVE tab's page 1.
- Unsave happens from the trip detail (or by tapping the bookmark in the feed card); the grid tile has no bookmark button.

## 6. Share sheet and links

### 6.1 Sheet (`ShareSheet`, `src/components/trip/share-sheet.tsx`)

Custom bottom sheet on BOTH platforms for identical behaviour (RN `Modal`, `transparent`, `animationType="fade"` for the scrim `overlay`, sheet = `surface`, top corners `xxl`, padding 16 and bottom `max(insets.bottom, 16)`, drag handle decorative). Also reused as the comment `more` menu (same component, different rows). Rows are `Pressable`s, min height 56, icon 24 + `bodyStrong` label, gap 16; last row "Cancel" `secondary` full-width button. Close on scrim tap and Android back. Rows:

| Row | Icon | Shown when | Action |
|---|---|---|---|
| "Share link..." | `share` | trip is public | `Share.share` (6.2) |
| "Repost to your feed" | `repost` | public, not your own, not yet reposted | opens `trip/[id]/repost` |
| "Remove repost" | `repost` | you already reposted it | confirm (2.3) |

Private trip: the share button is not rendered at all (decision 5); if a deep link to a private trip is opened by a non-owner, the "unavailable" screen applies (D / MVP 9.6). If a trip turns private while the sheet is open and the action fails with "not available", close the sheet and show the toast "This trip is private now."

### 6.2 Link and message

Single helper `buildTripShareUrl(tripId)` in `src/lib/share.ts`:
- Path is always `/trip/<id>` (matches the Expo Router file `(app)/trip/[id]`; groups do not appear in URLs).
- If `EXPO_PUBLIC_WEB_BASE_URL` is set (future domain, e.g. `https://onmyway.app`): `${base}/trip/<id>`.
- Otherwise: `Linking.createURL('/trip/<id>')` from `expo-linking` (already installed), which yields `onmyway://trip/<id>` in a dev/production build (`scheme: 'onmyway'` is already in `app.config.ts`) and `exp://...` in Expo Go.
- LIMITATION to tell the owner: a custom scheme only works when the recipient already has the app installed, and many chat apps do not make `onmyway://...` tappable. Real sharing needs (1) a domain, (2) iOS universal links (`associatedDomains`, `apple-app-site-association`) and Android App Links (`intentFilters` with `autoVerify`) in `app.config.ts`, (3) a small web landing page for people without the app. None of this is built now; the helper is the single change point.

Message (`Share.share`): iOS `{ message, url }` is fine but Android ignores `url`, so put the link in the message on both and do NOT pass `url`:
`"{title} - a trip on onMyWay\n{link}"` (title truncated to 80 chars). `dialogTitle` (Android) "Share trip". Treat `result.action === Share.dismissedAction` as a silent no-op; thrown errors -> toast "Couldn't open the share options. Try again.". No toast on success (the OS shows its own UI).

### 6.3 Opening a link

Expo Router resolves `onmyway://trip/<id>` to the detail screen. Required behaviours (coder verifies, tester checks): signed out -> sign-in first, then land on that trip (if the existing auth guard drops the target path, record it as an open issue for the manager rather than changing routing silently); trip private/deleted -> existing "unavailable" state; back from a deep-linked detail goes to the feed (not out of the app) - give the stack an initial route.

## 7. Copy list (all English, exact)

| Where | String |
|---|---|
| Like / comment / share / save labels | "Like", "Comments", "Share", "Save trip" |
| Values | "{n} likes" ("1 like"), "{n} comments" ("1 comment") |
| Announcements | "Liked", "Like removed", "Saved", "Removed from saved", "Comment posted", "Reply posted", "Comment deleted" |
| Toasts | "Saved to your private list", "Reposted to your feed", "This trip is private now.", "Couldn't update. Check your connection and try again.", "You're doing that too fast. Try again in a moment.", "Couldn't remove the repost. Try again.", "Couldn't delete the comment. Try again.", "Couldn't open the share options. Try again." |
| Share sheet | "Share link...", "Repost to your feed", "Remove repost", "Cancel" |
| Share message | "{title} - a trip on onMyWay\n{link}" ; dialog title "Share trip" |
| Repost header | "{name} reposted" |
| Repost compose | title "Repost"; placeholder "Add a caption (optional)"; buttons "Cancel", "Repost"; discard "Discard caption?" [Keep editing] [Discard] |
| Repost remove | "Remove repost?", "It will be removed from your feed. The original trip is not affected.", [Cancel] [Remove] |
| Repost unavailable | "This trip is no longer available", "The owner may have made it private or deleted it." |
| Comments title / placeholder | "Comments", "Add a comment..." |
| Comments empty | "No comments yet", "Start the conversation." |
| Comments errors | "Couldn't load comments.", "Couldn't load more comments. Retry", "Couldn't load replies. Retry", "Couldn't send. Tap to retry", "Sending...", "Discard", "You're commenting too fast. Try again in a moment." |
| Replies | "View {n} replies", "View 1 reply", "View {m} more replies", "Hide replies", "Reply", "Replying to @{username}", "Cancel reply", "Author" |
| Comment menu | "Delete comment", dialog "Delete comment?", "This can't be undone.", "This also deletes its {n} replies. This can't be undone.", [Cancel] [Delete]; discard "Discard comment?" [Keep editing] [Discard] |
| Offline | "You're offline. Comments will load when you're back." |
| Likes screen | title "Likes", "{n} likes", "No likes yet", "Be the first to like this trip.", "Like this trip", "Couldn't load likes." |
| Saved tab | tab "Saved", note "Only you can see what you've saved.", empty "Nothing saved yet", "Tap the bookmark on a trip to keep it here.", CTA "Browse the feed", error "Couldn't load your saved trips." |

## 8. Edge cases and consistency

- Single source of truth: one client store keyed by trip id holds `{ likeCount, commentCount, likedByMe, savedByMe, repostedByMe }` (React context + `useSyncExternalStore`, or equivalent; NO new library). Feed card, repost card, detail, likes entry and saved grid read from it, so toggling anywhere updates everywhere. Lists seed it from each page response.
- Rapid toggling: UI flips instantly per tap; keep ONE in-flight request per (trip, kind) and remember the latest desired value; when the request settles and desired != confirmed, send once more. Requests are idempotent "set liked = true/false". Always reconcile to the server-returned canonical `{liked, count}` after settle. Never add +1 per tap; counts derive from `confirmedCount + (desired ? 1 : 0) - (confirmedLiked ? 1 : 0)` while in flight. Count never below 0.
- Offline or request failure: revert to the last confirmed value and show the toast "Couldn't update. Check your connection and try again." (once per 5 s, not per tap). No offline queue in this phase. Comments: failed items stay with retry (3.3).
- Rate limits: server returns a distinguishable error (for example HTTP 429 or a specific Postgres error code, db-designer to define); map to "You're doing that too fast. Try again in a moment." and revert. Never lose composer text.
- Deleted or private mid-session: any social mutation that returns "not found/forbidden" -> remove the item from the store, close sheets, toast "This trip is private now." or the unavailable state on detail.
- Count consistency: comment count always includes replies; after any comment create/delete use the count returned by the server, not a local +/-1. Count of a deleted subtree can drop by more than 1.
- Pagination dedupe: dedupe by id when pages overlap (new comments shift pages); keyset pagination avoids skips.
- Deleted users (later): show avatar fallback, name "Deleted user", no profile link. Blocked users (later): their comments/likes/reposts are filtered by the server; the UI needs no special state except the unavailable placeholder in 2.2.
- Pull-to-refresh on the feed re-seeds the store; in-flight optimistic values win until they settle.
- Own content: own trip has no Save and no Repost; you can like/comment on it; trip owner has delete rights on all its comments.
- Long text: names single-line with ellipsis, comment body wraps unlimited; long unbroken strings must not overflow (`flexShrink: 1`, `minWidth: 0`).

## 9. Data and queries the UI needs (db-designer input, not a schema)

Viewer = signed-in user. All counts are for what the viewer may see.

1. Feed page (cursor pagination as today) returns items of two kinds. Trip item: existing card data + `like_count`, `comment_count`, `liked_by_me`, `saved_by_me`. Repost item: `repost_id`, `reposted_at`, `caption`, reposter `{id, username, display_name, avatar_url}`, and the original trip card data with the four fields above, or `trip = null` when the viewer cannot see it. Must be batched (no N+1).
2. Trip detail: the same four fields plus `reposted_by_me` and the trip owner id.
3. Comments list: params `trip_id`, cursor (`created_at`, `id`), limit 20; returns top-level comments with author profile, `body`, `created_at`, `like_count`, `liked_by_me`, `reply_count`. Replies: params `parent_id`, cursor, limit 5 (first) / 20 (more), oldest first, same fields without `reply_count`.
4. Likes list: `trip_id`, cursor (`created_at`, `id`), limit 30 -> profiles `{id, username, display_name, avatar_url}`.
5. Saved list: viewer only, cursor (`saved_at`, `id`), limit 20 -> trip card data (cover, title, stop count, author profile) of trips still visible to the viewer.
6. Mutations (idempotent where noted): `set_trip_like(trip, liked)` and `set_trip_save(trip, saved)` -> `{liked|saved, like_count}`; `create_comment(trip, parent_id?, body)` -> the comment row (+ `comment_count`); `delete_comment(id)` -> new `comment_count`; `set_comment_like(comment, liked)` -> `{liked, like_count}`; `create_repost(trip, caption?)` (error on own trip, duplicate = idempotent success), `delete_repost(repost_id)`.
7. Constraints the UI relies on: comment body 1-500 chars after trim, repost caption 0-280, parent of a reply must be top-level (the server re-parents or rejects), a user can reply only on visible public trips, all social reads/writes denied for private trips except the trip owner's own data, rate limit errors distinguishable.

## 10. Coder checklist

Android Fabric (recent `addViewAt` crashes, commit d039078) - apply to EVERY new component here:
- [ ] Any `View` whose visual props change with state (rail circle fill, like pill fill, save circle, send button, heart pop wrapper, comment sending/failed opacity, tab indicator, skeleton-to-content swaps, toast) has `collapsable={false}`. Same for animated wrappers (`Animated.View`) that change opacity/transform.
- [ ] Do not conditionally insert views BEFORE existing siblings. Use always-mounted slots: reply-to banner above the composer, repost caption, repost embedded original/unavailable placeholder, replies container under a comment, rail count `Text`, privacy note under Saved tabs. Put conditional content INSIDE a stable slot wrapper (`collapsable={false}`), or use `display: 'none'`/height 0 style toggles on a mounted view. Append-only conditional children at the END of a parent are acceptable.
- [ ] Lists: stable `keyExtractor` (`trip:<id>`, `repost:<id>`, `comment:<id>`); optimistic items use a client key that is preserved when the server id arrives (map clientKey -> id) so the row is not remounted.
- [ ] Do not change `numColumns` on the profile list between tabs; do not swap the list component between Trips and Saved.
- [ ] Toggling like/save must not remount the card (no key based on state).

Implementation:
- [ ] Read the SDK 57 docs before using `Share`, `expo-linking`, `KeyboardAvoidingView`, `expo-symbols` names, `usePreventRemove`.
- [ ] New tokens `like`, `likeOnImage` in both modes + contrast report (1.2). New icons (1.3). `Icon filled` handling.
- [ ] Components: `TripActionRail`, `TripActionBar`, `SaveButton`, `LikeButton` (circle and pill variants), `RepostCard`, `TripCard variant="embedded"` and grid `showAuthor`, `ShareSheet`, `CommentItem`, `CommentComposer`, `Toast` (simple, bottom, 3 s, above the tab bar on tab screens via `useTabBarInset`, role `alert`, also `announceForAccessibility`). Hooks: `useTripSocial(tripId)` (store selector + mutations), `useComments`, `useReplies`, `useTripLikes`, `useSavedTrips`.
- [ ] Routes: `trip/[id]/comments` (modal), `trip/[id]/likes` (push), `trip/[id]/repost` (modal); register in `(app)/_layout.tsx`; update `docs/ROUTING.md` route table only if the manager asks.
- [ ] Private trips render NO social UI (decision 5); own trips: no Save, no Repost.
- [ ] No haptics, no new dependency. `formatCount` in `src/lib/format-count.ts` (pure; tests in 11).
- [ ] No hard-coded colours; all labels/roles/states per 1.5 and 3.7; touch targets >= 44; dark mode checked; font scale 1.0 and 2.0.
- [ ] Never call the service_role key; only RPCs/tables via the anon client. Do not log comment bodies.
- [ ] Run `npx tsc --noEmit` and `npx expo lint`.

## 11. Tester checklist

Functional
- [ ] Like on feed: tap flips heart, count +1; second tap -1; reopen app: persisted. Count formats: 0 (blank), 999, 1.2K, 12K, 1.2M (unit-test `formatCount`).
- [ ] Rapid tap 10 times: final state matches the last tap, count never negative or doubled, only one request in flight.
- [ ] Like in feed, open detail, back: same state everywhere (store). Same trip in a repost card updates too.
- [ ] Detail double-tap likes once and never unlikes; single tap does nothing; reduce motion shows fade only.
- [ ] Like count on detail opens the likes list; pagination loads page 2; empty/error/skeleton states; rows open the profile.
- [ ] Save toggles on feed and detail; appears first in Saved tab; unsave removes it on return; Saved tab exists ONLY on own profile; other profile shows single "Trips"; privacy note visible; empty state CTA works.
- [ ] Saved trip turned private/deleted disappears for the saver without placeholder.
- [ ] Share link: OS sheet opens on iOS and Android; message contains title and link; link opens the trip (build with the scheme, signed in and signed out); private trip has no share control; own trip sheet lacks Repost.
- [ ] Repost: from another user's public trip with and without caption; appears at top of feed with embedded original; cannot repost own; second attempt shows "Remove repost"; remove confirm works; deleting/privatising the original shows the unavailable placeholder and the reposter can still remove it.
- [ ] Comments: open from feed, detail; post (empty/whitespace blocked, 500 limit, counter from 450, multiline), keyboard never hides the composer (small phone, iOS and Android, with 3-row input), sending/failed/retry/discard states, offline send fails and keeps text, reply to top-level and to a reply (attaches to parent, prefill), cancel reply, "View N replies" expand/hide/more, like a comment, delete own with and without replies (copy differs), trip owner deletes someone else's, non-owner sees no delete on others, counts match after delete (replies included), pagination, pull to refresh, empty/error/unavailable states, discard guard on dismiss with draft.
- [ ] Rate limit and offline messages show and state reverts.

Visual / a11y
- [ ] Rail does not overlap the title (paddingRight 64), is readable over a white photo and a black photo; liked/saved circles white with red/dark glyph; light and dark; contrast report attached.
- [ ] Font scale 2.0: stacked feed card shows the `TripActionBar`; no clipped text; pills wrap; comment rows keep >= 44 targets.
- [ ] TalkBack and VoiceOver: labels, values, `selected`, announcements, focus order (1.5), replies `expanded`, composer label, send disabled state.
- [ ] Touch targets >= 44 everywhere (rail 48x62, pills 44, send 44, more 44).

Android Fabric stability
- [ ] 50 rapid like/save toggles on a feed card, opening/closing the comments modal, expanding/collapsing replies, starting/cancelling a reply, switching Trips/Saved tabs 20 times, sending and failing a comment: no `addViewAt`/"child already has a parent" crashes on Android (release-like build if possible).
