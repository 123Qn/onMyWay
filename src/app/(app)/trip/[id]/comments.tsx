import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  InteractionManager,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { Spinner } from '@/components/ui/spinner';
import { CommentComposer } from '@/components/comments/comment-composer';
import { CommentThread, type CommentActions } from '@/components/comments/comment-item';
import { ThemedText } from '@/components/themed-text';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { ToastHost } from '@/components/ui/toast-host';
import { Spacing } from '@/constants/theme';
import { useComments, type CommentNode, type ReplyTarget } from '@/hooks/use-comments';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';
import { useTheme } from '@/hooks/use-theme';
import { useTripSocialInfo } from '@/hooks/use-trip-social-info';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { getAvatarUrl } from '@/lib/avatar-url';
import { useSession } from '@/providers/session-provider';

const EDGES = ['left', 'right'] as const;
const SKELETONS = [0, 1, 2, 3];

function CommentSkeletons() {
  return (
    <SkeletonGroup>
      {SKELETONS.map((i) => (
        <View key={i} style={styles.skeletonRow}>
          <Skeleton shape="circle" height={32} />
          <View style={styles.skeletonText}>
            <Skeleton shape="text" width="40%" />
            <Skeleton shape="text" width="85%" />
          </View>
        </View>
      ))}
    </SkeletonGroup>
  );
}

function CommentsBody() {
  const params = useLocalSearchParams<{ id: string; focus?: string }>();
  const id = String(params.id ?? '');
  const theme = useTheme();
  const stackOptions = useStackScreenOptions();
  const headerHeight = useHeaderHeight();
  const { profile } = useSession();
  const info = useTripSocialInfo(id);

  const me = useMemo(
    () =>
      profile
        ? {
            id: profile.id,
            username: profile.username,
            displayName: profile.display_name,
            avatarUrl: getAvatarUrl(profile.avatar_path),
          }
        : null,
    [profile],
  );
  const comments = useComments(id, me);

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [menuNode, setMenuNode] = useState<CommentNode | null>(null);
  const draftRef = useRef('');
  const prefillRef = useRef('');
  const inputRef = useRef<TextInput | null>(null);
  const listRef = useRef<FlatList<CommentNode>>(null);
  const kavRef = useRef<View>(null);
  const [keyboardInset, setKeyboardInset] = useState(0);

  // Android edge-to-edge: KeyboardAvoidingView does not move content in a modal, so measure how
  // far the keyboard overlaps this container and pad the bottom by exactly that.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const show = Keyboard.addListener('keyboardDidShow', (e) => {
      kavRef.current?.measureInWindow((_x, y, _w, h) => {
        setKeyboardInset(Math.max(0, Math.round(y + h - e.endCoordinates.screenY)));
      });
    });
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardInset(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useUnsavedGuard({
    shouldGuard: () => draftRef.current.trim().length > 0,
    onGuard: (proceed) => {
      Alert.alert('Discard comment?', undefined, [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: proceed },
      ]);
    },
  });

  const changeDraft = (text: string) => {
    draftRef.current = text;
    setDraft(text);
  };

  // Opened from a "write a comment" entry: focus the input once the transition is done.
  const focusOnOpen = params.focus === 'composer';
  useEffect(() => {
    if (!focusOnOpen) return;
    const handle = InteractionManager.runAfterInteractions(() => inputRef.current?.focus());
    return () => handle.cancel();
  }, [focusOnOpen]);

  const startReply = (node: CommentNode) => {
    // A reply to a reply attaches to the top-level parent and mentions the replied user.
    const target = { parentKey: node.parentKey ?? node.key, username: node.username };
    const prefill = `@${node.username} `;
    setReplyTo(target);
    if (draftRef.current.trim().length === 0) {
      prefillRef.current = prefill;
      changeDraft(prefill);
    }
    inputRef.current?.focus();
  };

  const cancelReply = () => {
    // Remove the prefilled mention only while it is still untouched.
    if (prefillRef.current && draftRef.current === prefillRef.current) changeDraft('');
    prefillRef.current = '';
    setReplyTo(null);
  };

  const submit = () => {
    if (!draft.trim()) return;
    comments.send(draft, replyTo);
    if (!replyTo) listRef.current?.scrollToOffset({ offset: 0, animated: true });
    prefillRef.current = '';
    changeDraft('');
    setReplyTo(null);
  };

  const confirmDelete = (node: CommentNode) => {
    const replies = node.parentKey ? 0 : node.replyCount;
    const message =
      replies > 0
        ? `This also deletes its ${replies === 1 ? '1 reply' : `${replies} replies`}. This can't be undone.`
        : "This can't be undone.";
    Alert.alert('Delete comment?', message, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => comments.remove(node.key) },
    ]);
  };

  const actions: CommentActions = {
    onReply: startReply,
    onToggleLike: (node) => comments.toggleLike(node.key),
    onOpenMenu: setMenuNode,
    onRetry: (node) => comments.retrySend(node.key),
    onDiscard: (node) => comments.discard(node.key),
  };

  const header = <Stack.Screen options={{ ...stackOptions, title: 'Comments' }} />;

  if (info.status === 'unavailable' || comments.unavailable) {
    return (
      <Screen edges={[...EDGES, 'bottom']} centered>
        {header}
        <EmptyState
          icon="lock"
          title="This trip is no longer available"
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  }

  let emptyNode;
  if (comments.status === 'loading') {
    emptyNode = <CommentSkeletons />;
  } else if (comments.status === 'error') {
    emptyNode = (
      <ErrorBanner message="Couldn't load comments." onRetry={comments.retry} style={styles.banner} />
    );
  } else {
    emptyNode = (
      <EmptyState icon="comment" title="No comments yet" message="Start the conversation." />
    );
  }

  let footer = null;
  if (comments.loadingMore) {
    footer = (
      <View style={styles.footer} accessible accessibilityLabel="Loading more">
        <Spinner color="textMuted" />
        <ThemedText type="caption" themeColor="textMuted">
          Loading more
        </ThemedText>
      </View>
    );
  } else if (comments.loadMoreError) {
    footer = (
      <View style={styles.footer}>
        <ThemedText type="caption" themeColor="textMuted">
          Couldn&apos;t load more comments.
        </ThemedText>
        <Button title="Retry" variant="ghost" size="sm" onPress={comments.retryLoadMore} />
      </View>
    );
  }

  return (
    <Screen edges={[...EDGES]} padded={false} keyboardAvoiding={false}>
      {header}
      <View ref={kavRef} collapsable={false} style={styles.flex}>
        <KeyboardAvoidingView
          style={[styles.flex, { paddingBottom: keyboardInset }]}
          enabled={Platform.OS === 'ios'}
          behavior="padding"
          keyboardVerticalOffset={headerHeight}>
        <FlatList
          ref={listRef}
          data={comments.top}
          extraData={comments.threads}
          keyExtractor={(node) => node.key}
          renderItem={({ item }) => (
            <CommentThread
              node={item}
              thread={comments.threads[item.key]}
              tripOwnerId={info.ownerId}
              onToggleReplies={(node) => comments.toggleReplies(node.key)}
              onMoreReplies={(node) => comments.loadMoreReplies(node.key)}
              onRetryReplies={(node) => comments.retryReplies(node.key)}
              {...actions}
            />
          )}
          ListEmptyComponent={emptyNode}
          ListFooterComponent={footer}
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReachedThreshold={0.5}
          onEndReached={comments.loadMore}
          refreshControl={
            <RefreshControl
              refreshing={comments.refreshing}
              tintColor={theme.primary}
              colors={[theme.primary]}
              onRefresh={comments.refresh}
            />
          }
        />
        <CommentComposer
          value={draft}
          onChangeText={changeDraft}
          onSend={submit}
          replyTo={replyTo}
          onCancelReply={cancelReply}
          avatarUrl={me?.avatarUrl ?? null}
          displayName={me?.displayName ?? ''}
          inputRef={inputRef}
          disabled={!me}
        />
        </KeyboardAvoidingView>
      </View>
      <BottomSheet
        visible={!!menuNode}
        onClose={() => setMenuNode(null)}
        title="Comment options"
        rows={[
          {
            key: 'delete',
            icon: 'trash',
            label: 'Delete comment',
            destructive: true,
            onPress: () => {
              const node = menuNode;
              setMenuNode(null);
              if (node) confirmDelete(node);
            },
          },
        ]}
      />
    </Screen>
  );
}

export default function CommentsScreen() {
  return (
    <>
      <CommentsBody />
      <ToastHost bottomOffset={96} />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 600, alignSelf: 'center' },
  banner: { margin: Spacing.three },
  skeletonRow: {
    flexDirection: 'row',
    gap: Spacing.three - Spacing.one,
    paddingVertical: Spacing.three - Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  skeletonText: { flex: 1, gap: Spacing.two },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
});
