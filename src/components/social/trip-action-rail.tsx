import { AccessibilityInfo, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PopIcon } from '@/components/social/pop-icon';
import { ThemedText } from '@/components/themed-text';
import type { IconName } from '@/components/ui/icon';
import { Layout, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatCount, pluralize } from '@/lib/format-count';
import { useTripSocial } from '@/lib/social-store';

const CIRCLE = 44;
const RAIL_WIDTH = 48;

type RailItemProps = {
  icon: IconName;
  filled?: boolean;
  /** Circle turns white and the glyph takes `activeGlyph` (like on). */
  active?: boolean;
  activeGlyph?: ThemeColor;
  count?: number;
  label: string;
  valueText?: string;
  hint?: string;
  selected?: boolean;
  onPress: () => void;
};

/** One rail button: 44 circle over a count line, 48 x 62 hit area. The count Text is always mounted. */
function RailItem({
  icon,
  filled = false,
  active = false,
  activeGlyph = 'likeOnImage',
  count,
  label,
  valueText,
  hint,
  selected,
  onPress,
}: RailItemProps) {
  const theme = useTheme();
  return (
    <Pressable
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityValue={valueText ? { text: valueText } : undefined}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={styles.item}>
      <View
        collapsable={false}
        style={[styles.circle, { backgroundColor: active ? theme.onImage : theme.scrimChip }]}>
        <PopIcon
          name={icon}
          filled={filled}
          size={Layout.iconSize.lg}
          color={active ? activeGlyph : 'onImage'}
        />
      </View>
      <ThemedText
        type="caption"
        themeColor="onImage"
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}
        importantForAccessibility="no"
        style={styles.count}>
        {count === undefined ? '' : formatCount(count)}
      </ThemedText>
    </Pressable>
  );
}

type RailProps = {
  tripId: string;
  onOpenComments: () => void;
  onOpenShare: () => void;
};

/** Like, Comment and Share, top to bottom. Sits bottom-right of the hero feed card. */
export function TripActionRail({ tripId, onOpenComments, onOpenShare }: RailProps) {
  const social = useTripSocial(tripId);
  const toggleLike = () => {
    AccessibilityInfo.announceForAccessibility(social.liked ? 'Like removed' : 'Liked');
    social.toggleLike();
  };
  return (
    <View style={styles.rail} pointerEvents="box-none">
      <RailItem
        icon="heart"
        filled={social.liked}
        active={social.liked}
        activeGlyph="likeOnImage"
        count={social.likeCount}
        label="Like"
        valueText={pluralize(social.likeCount, 'like')}
        hint={social.liked ? 'Double tap to remove your like' : 'Double tap to like this trip'}
        selected={social.liked}
        onPress={toggleLike}
      />
      <RailItem
        icon="comment"
        count={social.commentCount}
        label="Comments"
        valueText={pluralize(social.commentCount, 'comment')}
        hint="Opens the comments"
        onPress={onOpenComments}
      />
      <RailItem icon="share" label="Share" hint="Opens share options" onPress={onOpenShare} />
    </View>
  );
}

type SaveProps = {
  tripId: string;
  style?: StyleProp<ViewStyle>;
};

/** Top-right bookmark circle on a cover (white when saved). */
export function SaveCircle({ tripId, style }: SaveProps) {
  const theme = useTheme();
  const social = useTripSocial(tripId);
  const onPress = () => {
    AccessibilityInfo.announceForAccessibility(social.saved ? 'Removed from saved' : 'Saved');
    social.toggleSave();
  };
  return (
    <Pressable
      collapsable={false}
      accessibilityRole="button"
      accessibilityLabel="Save trip"
      accessibilityHint={
        social.saved
          ? 'Removes this trip from your saved list'
          : 'Saves this trip to your private list'
      }
      accessibilityState={{ selected: social.saved }}
      onPress={onPress}
      style={[
        styles.circle,
        styles.save,
        { backgroundColor: social.saved ? theme.onImage : theme.scrimChip },
        style,
      ]}>
      <PopIcon
        name="bookmark"
        filled={social.saved}
        size={Layout.iconSize.lg}
        color={social.saved ? 'saveOnImage' : 'onImage'}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: {
    position: 'absolute',
    right: Spacing.three,
    bottom: Spacing.three,
    width: RAIL_WIDTH,
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
  },
  item: { width: RAIL_WIDTH, alignItems: 'center', gap: Spacing.half },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  count: { minHeight: 16, fontVariant: ['tabular-nums'] },
  save: { position: 'absolute', top: Spacing.three, right: Spacing.three },
});
