import { useState, type RefObject } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import Animated, {
  useAnimatedKeyboard,
  useAnimatedStyle,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
import { Layout, Radius, Spacing, Typography } from "@/constants/theme";
import { MAX_COMMENT_LENGTH, type ReplyTarget } from "@/hooks/use-comments";
import { useTheme } from "@/hooks/use-theme";
import { COLLAPSED, COLLAPSED_TEXT, collapsedA11y } from "@/lib/collapse";

const COUNTER_FROM = 450;
const MAX_LINES = 5;

type Props = {
  value: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  replyTo: ReplyTarget | null;
  onCancelReply: () => void;
  avatarUrl: string | null;
  displayName: string;
  inputRef: RefObject<TextInput | null>;
  /** Sending is blocked (offline or unavailable). */
  disabled?: boolean;
};

/** Comment input with an always-mounted "Replying to" banner above it. */
export function CommentComposer({
  value,
  onChangeText,
  onSend,
  replyTo,
  onCancelReply,
  avatarUrl,
  displayName,
  inputRef,
  disabled = false,
}: Props) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [focused, setFocused] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);
  const canSend = value.trim().length > 0 && !disabled;

  // Edge-to-edge: the window is not resized for the keyboard, so lift the composer ourselves.
  // The IME height already includes the nav bar, so the bottom inset is max(nav inset, keyboard).
  const keyboard = useAnimatedKeyboard({
    isStatusBarTranslucentAndroid: true,
    isNavigationBarTranslucentAndroid: true,
  });
  const bottomInset = insets.bottom;
  const liftStyle = useAnimatedStyle(() => ({
    paddingBottom: Math.max(bottomInset, keyboard.height.value),
  }));

  // Explicit height: Android multiline inputs do not shrink after the text is cleared (sent
  // comment/reply), which left a blank band above the input. Empty text always resets to minimum.
  const maxInput = LINE * MAX_LINES + Spacing.three;
  const inputHeight =
    value.length === 0
      ? Layout.minTouchTarget
      : Math.min(maxInput, Math.max(Layout.minTouchTarget, contentHeight));

  return (
    <Animated.View
      collapsable={false}
      style={[{ backgroundColor: theme.surface }, liftStyle]}
    >
      <View
        collapsable={false}
        style={[styles.container, { borderTopColor: theme.border }]}
      >
        <View
          collapsable={false}
          {...collapsedA11y(!replyTo)}
          style={[
            styles.banner,
            { backgroundColor: theme.surfaceMuted },
            !replyTo && styles.noneColumn,
          ]}
        >
          <ThemedText
            type="caption"
            themeColor="textMuted"
            numberOfLines={1}
            style={styles.bannerText}
          >
            {replyTo ? `Replying to @${replyTo.username}` : ""}
          </ThemedText>
          <IconButton
            icon="close"
            accessibilityLabel="Cancel reply"
            disabled={!replyTo}
            onPress={onCancelReply}
          />
        </View>

        <View style={styles.inputRow}>
          <Avatar size="sm" uri={avatarUrl} name={displayName} />
          <View
            collapsable={false}
            style={[
              styles.inputBox,
              {
                backgroundColor: theme.surfaceMuted,
                borderColor: focused ? theme.primary : theme.borderStrong,
                borderWidth: focused ? 2 : 1.5,
              },
            ]}
          >
            <TextInput
              ref={inputRef}
              value={value}
              onChangeText={onChangeText}
              multiline
              maxLength={MAX_COMMENT_LENGTH}
              placeholder="Add a comment..."
              placeholderTextColor={theme.textMuted}
              selectionColor={theme.primary}
              accessibilityLabel="Add a comment"
              accessibilityHint="Maximum 500 characters"
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onContentSizeChange={(e) =>
                setContentHeight(e.nativeEvent.contentSize.height)
              }
              style={[styles.input, { color: theme.text, height: inputHeight }]}
            />
          </View>
          <Pressable
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel={replyTo ? "Post reply" : "Post comment"}
            accessibilityState={{ disabled: !canSend }}
            disabled={!canSend}
            onPress={onSend}
            style={[
              styles.send,
              { backgroundColor: theme.primary },
              !canSend && styles.sendDisabled,
            ]}
          >
            <Icon name="arrow-up" size={Layout.iconSize.lg} color="onPrimary" />
          </Pressable>
        </View>

        <ThemedText
          type="caption"
          themeColor={
            value.length >= MAX_COMMENT_LENGTH ? "danger" : "textMuted"
          }
          {...collapsedA11y(value.length < COUNTER_FROM)}
          style={[
            styles.counter,
            value.length < COUNTER_FROM && styles.noneText,
          ]}
        >
          {`${value.length}/${MAX_COMMENT_LENGTH}`}
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const LINE = Typography.body.lineHeight;

const styles = StyleSheet.create({
  container: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: Spacing.three - Spacing.one,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: Radius.md,
    paddingLeft: Spacing.three - Spacing.one,
  },
  bannerText: { flex: 1 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.three - Spacing.one,
  },
  inputBox: {
    flex: 1,
    minHeight: Layout.minTouchTarget,
    borderRadius: Radius.lg,
    justifyContent: "center",
  },
  input: {
    paddingHorizontal: Spacing.three - Spacing.one,
    paddingVertical: Spacing.two,
    maxHeight: LINE * MAX_LINES + Spacing.three,
    fontSize: Typography.body.fontSize,
    lineHeight: LINE,
    fontFamily: Typography.body.fontFamily,
    textAlignVertical: "top",
  },
  send: {
    width: Layout.minTouchTarget,
    height: Layout.minTouchTarget,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  sendDisabled: { opacity: 0.4 },
  counter: { alignSelf: "flex-end" },
  // Collapsed in the container column: cancel the one gap it still reserves.
  noneColumn: { ...COLLAPSED, marginBottom: -Spacing.two },
  noneText: { ...COLLAPSED_TEXT, marginBottom: -Spacing.two },
});
