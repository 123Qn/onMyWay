import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Icon, type IconName } from './icon';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ChipProps = {
  label: string;
  icon?: IconName;
  tone?: 'neutral' | 'primary' | 'onImage';
  selected?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const HIT_SLOP = { top: 6, bottom: 6, left: 4, right: 4 } as const;

export function Chip({
  label,
  icon,
  tone = 'neutral',
  selected = false,
  onPress,
  accessibilityLabel,
  style,
  testID,
}: ChipProps) {
  const theme = useTheme();
  const soft = tone === 'primary' || selected;
  const onImage = tone === 'onImage';

  const background = onImage ? theme.scrimChip : soft ? theme.primarySoft : theme.surfaceMuted;
  const textColor: ThemeColor = onImage ? 'onImage' : soft ? 'primaryPressed' : 'text';
  const iconColor: ThemeColor = onImage ? 'onImage' : soft ? 'primary' : 'textMuted';

  const content = (
    <>
      {icon ? <Icon name={icon} size={14} color={iconColor} /> : null}
      <ThemedText
        type={onImage ? 'caption' : 'smallBold'}
        themeColor={textColor}
        maxFontSizeMultiplier={1.3}
        numberOfLines={1}>
        {label}
      </ThemedText>
    </>
  );

  const box = [styles.base, { backgroundColor: background }, style];

  if (!onPress) {
    return (
      <View testID={testID} accessibilityLabel={accessibilityLabel} style={box}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={HIT_SLOP}
      onPress={onPress}
      style={({ pressed }) => [box, pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 32,
    paddingHorizontal: 12,
    borderRadius: Radius.full,
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.one + Spacing.half,
  },
  pressed: { opacity: 0.8 },
});
