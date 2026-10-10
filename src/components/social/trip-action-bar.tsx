import { router } from 'expo-router';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { PopIcon } from '@/components/social/pop-icon';
import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCount, pluralize } from '@/lib/format-count';
import { useTripSocial } from '@/lib/social-store';

type Props = {
  tripId: string;
  /** False on your own trip (nothing to save). */
  showSave: boolean;
  onOpenComments: () => void;
  onOpenShare: () => void;
};

/**
 * Horizontal actions for the stacked feed card, repost card and trip detail. Pills wrap at
 * large text. Every conditional part stays mounted and is toggled by style.
 */
export function TripActionBar({ tripId, showSave, onOpenComments, onOpenShare }: Props) {
  const theme = useTheme();
  const social = useTripSocial(tripId);

  const toggleLike = () => {
    AccessibilityInfo.announceForAccessibility(social.liked ? 'Like removed' : 'Liked');
    social.toggleLike();
  };
  const toggleSave = () => {
    AccessibilityInfo.announceForAccessibility(social.saved ? 'Removed from saved' : 'Saved');
    social.toggleSave();
  };

  return (
    <View style={styles.row}>
      <View
        collapsable={false}
        style={[
          styles.pill,
          { backgroundColor: social.liked ? theme.primarySoft : theme.surfaceMuted },
        ]}>
        <Pressable
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel="Like"
          accessibilityHint={
            social.liked ? 'Double tap to remove your like' : 'Double tap to like this trip'
          }
          accessibilityValue={{ text: pluralize(social.likeCount, 'like') }}
          accessibilityState={{ selected: social.liked }}
          onPress={toggleLike}
          style={styles.heart}>
          <PopIcon
            name="heart"
            filled={social.liked}
            size={Layout.iconSize.md}
            color={social.liked ? 'like' : 'text'}
          />
        </Pressable>
        <Pressable
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel={`${pluralize(social.likeCount, 'like')}, see who liked`}
          disabled={social.likeCount === 0}
          onPress={() => router.push(`/trip/${tripId}/likes`)}
          style={[styles.likeCount, social.likeCount === 0 && styles.hidden]}>
          <ThemedText type="small" maxFontSizeMultiplier={1.5} style={styles.tabular}>
            {formatCount(social.likeCount)}
          </ThemedText>
        </Pressable>
      </View>

      <Pressable
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel="Comments"
        accessibilityHint="Opens the comments"
        accessibilityValue={{ text: pluralize(social.commentCount, 'comment') }}
        onPress={onOpenComments}
        style={[styles.pill, styles.pillPad, { backgroundColor: theme.surfaceMuted }]}>
        <Icon name="comment" size={Layout.iconSize.md} color="text" />
        <ThemedText type="small" maxFontSizeMultiplier={1.5} style={styles.tabular}>
          {formatCount(social.commentCount)}
        </ThemedText>
      </Pressable>

      <Pressable
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel="Share"
        accessibilityHint="Opens share options"
        onPress={onOpenShare}
        style={[styles.pill, styles.pillPad, { backgroundColor: theme.surfaceMuted }]}>
        <Icon name="share" size={Layout.iconSize.md} color="text" />
        <ThemedText type="small" maxFontSizeMultiplier={1.5}>
          Share
        </ThemedText>
      </Pressable>

      <Pressable
        collapsable={false}
        accessibilityRole="button"
        accessibilityLabel="Save trip"
        accessibilityHint={
          social.saved
            ? 'Removes this trip from your saved list'
            : 'Saves this trip to your private list'
        }
        accessibilityState={{ selected: social.saved, disabled: !showSave }}
        disabled={!showSave}
        onPress={toggleSave}
        style={[
          styles.saveCircle,
          { backgroundColor: theme.surfaceMuted },
          !showSave && styles.hidden,
        ]}>
        <PopIcon
          name="bookmark"
          filled={social.saved}
          size={Layout.iconSize.md}
          color={social.saved ? 'primary' : 'text'}
        />
      </Pressable>
    </View>
  );
}

const MIN = Layout.minTouchTarget;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.two },
  pill: {
    minHeight: MIN,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  pillPad: { paddingHorizontal: Spacing.three - Spacing.one },
  heart: {
    minWidth: MIN,
    minHeight: MIN,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: Spacing.one,
  },
  likeCount: {
    minHeight: MIN,
    justifyContent: 'center',
    paddingRight: Spacing.three - Spacing.one,
  },
  saveCircle: {
    width: MIN,
    height: MIN,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hidden: { display: 'none' },
  tabular: { fontVariant: ['tabular-nums'] },
});
