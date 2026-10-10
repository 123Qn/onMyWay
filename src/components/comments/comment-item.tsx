import { router } from 'expo-router';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Spinner } from '@/components/ui/spinner';
import { PopIcon } from '@/components/social/pop-icon';
import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { Layout, Spacing } from '@/constants/theme';
import type { CommentNode, Thread } from '@/hooks/use-comments';
import { useTheme } from '@/hooks/use-theme';
import { formatCount, pluralize } from '@/lib/format-count';
import { formatRelativeLong, formatRelativeShort } from '@/lib/format-date';

const LARGE_TEXT_SCALE = 1.5;
const AVATAR = 32;
const AVATAR_REPLY = 28;
const GAP = Spacing.three - Spacing.one;
const INDENT = AVATAR + GAP;

export type CommentActions = {
  onReply: (node: CommentNode) => void;
  onToggleLike: (node: CommentNode) => void;
  onOpenMenu: (node: CommentNode) => void;
  onRetry: (node: CommentNode) => void;
  onDiscard: (node: CommentNode) => void;
};

type ItemProps = CommentActions & {
  node: CommentNode;
  isReply: boolean;
  tripOwnerId: string | null;
};

function CommentItem({
  node,
  isReply,
  tripOwnerId,
  onReply,
  onToggleLike,
  onOpenMenu,
  onRetry,
  onDiscard,
}: ItemProps) {
  const { fontScale } = useWindowDimensions();
  const large = fontScale >= LARGE_TEXT_SCALE;
  const sending = node.status === 'sending';
  const failed = node.status === 'failed';
  const settled = node.status === 'sent' && !!node.id;
  const isAuthor = !!tripOwnerId && node.userId === tripOwnerId;
  const openProfile = () => router.push(`/user/${node.username}`);

  return (
    <View collapsable={false} style={[styles.row, isReply && styles.reply, sending && styles.sending]}>
      <Pressable
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`${node.displayName}, profile`}
        onPress={openProfile}
        hitSlop={8}
        style={styles.avatar}>
        <Avatar size={isReply ? AVATAR_REPLY : AVATAR} uri={node.avatarUrl} name={node.displayName} />
      </Pressable>

      <View style={styles.middle}>
        <Pressable
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={`${node.displayName}, profile`}
          onPress={openProfile}
          style={styles.nameLine}>
          <ThemedText type="smallBold" numberOfLines={1} maxFontSizeMultiplier={1.5} style={styles.name}>
            {node.displayName}
          </ThemedText>
          <ThemedText type="caption" themeColor="textMuted" numberOfLines={1} maxFontSizeMultiplier={1.5}>
            {` · ${formatRelativeShort(node.createdAt)}`}
          </ThemedText>
          <ThemedText
            type="caption"
            themeColor="primaryPressed"
            numberOfLines={1}
            maxFontSizeMultiplier={1.5}
            style={!isAuthor && styles.none}>
            {' · Author'}
          </ThemedText>
        </Pressable>

        <ThemedText
          selectable
          maxFontSizeMultiplier={2}
          accessibilityLabel={`${node.displayName} said: ${node.body}. ${formatRelativeLong(node.createdAt)}`}
          style={styles.body}>
          {node.body}
        </ThemedText>

        <View collapsable={false} style={[styles.status, node.status === 'sent' && styles.none]}>
          <View collapsable={false} style={sending ? undefined : styles.none}>
            <ThemedText type="caption" themeColor="textMuted">
              Sending...
            </ThemedText>
          </View>
          <View collapsable={false} style={failed ? styles.failedRow : styles.none}>
            <Pressable
              collapsable={false}
              accessibilityRole="button"
              accessibilityLabel="Couldn't send. Tap to retry"
              onPress={() => onRetry(node)}
              style={styles.failedTap}>
              <Icon name="alert" size={Layout.iconSize.sm} color="danger" />
              <ThemedText type="caption" themeColor="danger" maxFontSizeMultiplier={1.5}>
                {node.failure === 'rate_limited'
                  ? "You're commenting too fast. Tap to retry"
                  : "Couldn't send. Tap to retry"}
              </ThemedText>
            </Pressable>
            <Button title="Discard" variant="ghost" size="sm" onPress={() => onDiscard(node)} />
          </View>
        </View>

        <View collapsable={false} style={[styles.actions, !settled && styles.none]}>
          <Pressable
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel={`Reply to ${node.displayName}`}
            onPress={() => onReply(node)}
            style={styles.replyButton}>
            <ThemedText type="small" themeColor="textMuted" maxFontSizeMultiplier={1.5}>
              Reply
            </ThemedText>
          </Pressable>
          <View collapsable={false} style={node.canDelete ? undefined : styles.none}>
            <IconButton
              icon="more"
              accessibilityLabel="Comment options"
              disabled={!node.canDelete}
              onPress={() => onOpenMenu(node)}
            />
          </View>
        </View>
      </View>

      <View collapsable={false} style={[styles.likeColumn, large && styles.likeColumnLarge, !settled && styles.none]}>
        <Pressable
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel="Like comment"
          accessibilityValue={{ text: pluralize(node.likeCount, 'like') }}
          accessibilityState={{ selected: node.liked }}
          onPress={() => onToggleLike(node)}
          style={styles.heart}>
          <PopIcon
            name="heart"
            filled={node.liked}
            size={Layout.iconSize.md}
            color={node.liked ? 'like' : 'textMuted'}
          />
        </Pressable>
        <ThemedText
          type="caption"
          themeColor="textMuted"
          maxFontSizeMultiplier={1.3}
          importantForAccessibility="no"
          style={styles.likeCount}>
          {formatCount(node.likeCount)}
        </ThemedText>
      </View>
    </View>
  );
}

type ThreadProps = CommentActions & {
  node: CommentNode;
  thread: Thread | undefined;
  tripOwnerId: string | null;
  onToggleReplies: (node: CommentNode) => void;
  onMoreReplies: (node: CommentNode) => void;
  onRetryReplies: (node: CommentNode) => void;
};

/** A top-level comment with its always-mounted replies slot. */
export function CommentThread({
  node,
  thread,
  tripOwnerId,
  onToggleReplies,
  onMoreReplies,
  onRetryReplies,
  ...actions
}: ThreadProps) {
  const theme = useTheme();
  const expanded = !!thread?.expanded;
  const loading = !!thread?.loading;
  const replies = thread?.replies ?? [];
  const loaded = replies.filter((r) => r.status === 'sent').length;
  const remaining = Math.max(0, node.replyCount - loaded);
  const toggleLabel = expanded
    ? 'Hide replies'
    : node.replyCount === 1
      ? 'View 1 reply'
      : `View ${node.replyCount} replies`;

  return (
    <View collapsable={false}>
      <CommentItem node={node} isReply={false} tripOwnerId={tripOwnerId} {...actions} />

      <View collapsable={false} style={styles.threadSlot}>
        <Pressable
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={toggleLabel}
          accessibilityState={{ expanded, busy: loading }}
          disabled={node.replyCount === 0 || loading}
          onPress={() => onToggleReplies(node)}
          style={[styles.toggle, node.replyCount === 0 && styles.none]}>
          <View collapsable={false} style={[styles.hairline, { backgroundColor: theme.border }]} />
          <ThemedText type="small" themeColor="textMuted" maxFontSizeMultiplier={1.5}>
            {toggleLabel}
          </ThemedText>
          <View collapsable={false} style={loading ? undefined : styles.none}>
            <Spinner color="textMuted" />
          </View>
        </Pressable>

        <View collapsable={false} style={expanded ? undefined : styles.none}>
          {replies.map((reply) => (
            <CommentItem
              key={reply.key}
              node={reply}
              isReply
              tripOwnerId={tripOwnerId}
              {...actions}
            />
          ))}
          <Pressable
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel={remaining === 1 ? 'View 1 more reply' : `View ${remaining} more replies`}
            disabled={remaining === 0 || loading}
            onPress={() => onMoreReplies(node)}
            style={[styles.toggle, (remaining === 0 || !!thread?.error) && styles.none]}>
            <View collapsable={false} style={[styles.hairline, { backgroundColor: theme.border }]} />
            <ThemedText type="small" themeColor="textMuted" maxFontSizeMultiplier={1.5}>
              {remaining === 1 ? 'View 1 more reply' : `View ${remaining} more replies`}
            </ThemedText>
          </Pressable>
          <Pressable
            collapsable={false}
            accessibilityRole="button"
            accessibilityLabel="Couldn't load replies. Retry"
            onPress={() => onRetryReplies(node)}
            style={[styles.toggle, !thread?.error && styles.none]}>
            <Icon name="alert" size={Layout.iconSize.sm} color="danger" />
            <ThemedText type="small" themeColor="danger" maxFontSizeMultiplier={1.5}>
              Couldn&apos;t load replies. Retry
            </ThemedText>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: GAP,
    paddingVertical: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  reply: { paddingLeft: Spacing.three + INDENT },
  sending: { opacity: 0.6 },
  avatar: { minHeight: Layout.minTouchTarget - 8, paddingTop: Spacing.half },
  middle: { flex: 1, minWidth: 0, gap: Spacing.half },
  nameLine: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Layout.minTouchTarget - 12,
  },
  name: { flexShrink: 1 },
  body: { minWidth: 0 },
  status: { gap: Spacing.one },
  failedRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  failedTap: {
    minHeight: Layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  replyButton: {
    minHeight: Layout.minTouchTarget,
    minWidth: Layout.minTouchTarget,
    justifyContent: 'center',
  },
  likeColumn: { width: 48, alignItems: 'center' },
  likeColumnLarge: { flexBasis: '100%', width: 'auto', alignItems: 'flex-start', paddingLeft: INDENT - GAP },
  heart: {
    width: Layout.minTouchTarget,
    height: Layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  likeCount: { minHeight: 16, fontVariant: ['tabular-nums'] },
  threadSlot: {},
  toggle: {
    marginLeft: Spacing.three + INDENT,
    minHeight: Layout.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hairline: { width: 24, height: 1 },
  none: { display: 'none' },
});
