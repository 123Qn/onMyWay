import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Duration, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type UnderlineTab = { key: string; label: string };

export type UnderlineTabsProps = {
  tabs: UnderlineTab[];
  value: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

const ITEM_HEIGHT = 48;
const INDICATOR_RATIO = 0.4;

/**
 * Underline tab header. With ONE tab it renders as a non-interactive section header
 * (role header, no tab roles).
 */
export function UnderlineTabs({ tabs, value, onChange, style, testID }: UnderlineTabsProps) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const [width, setWidth] = useState(0);
  const single = tabs.length === 1;

  const itemWidth = tabs.length > 0 ? width / tabs.length : 0;
  const indicatorWidth = itemWidth * INDICATOR_RATIO;
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === value),
  );
  const targetX = activeIndex * itemWidth + (itemWidth - indicatorWidth) / 2;

  const x = useSharedValue(targetX);
  useEffect(() => {
    x.value = reduceMotion
      ? targetX
      : withTiming(targetX, { duration: Duration.fast, easing: Easing.inOut(Easing.cubic) });
  }, [targetX, reduceMotion, x]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }));

  return (
    <View
      testID={testID}
      accessibilityRole={single ? undefined : 'tablist'}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={[styles.row, { borderBottomColor: theme.border }, style]}>
      {tabs.map((tab) => {
        const selected = tab.key === value;
        const label = (
          <ThemedText
            type="smallBold"
            themeColor={selected ? 'text' : 'textMuted'}
            accessibilityRole={single ? 'header' : undefined}>
            {tab.label}
          </ThemedText>
        );
        if (single) {
          return (
            <View key={tab.key} style={styles.item}>
              {label}
            </View>
          );
        }
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityLabel={tab.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.key)}
            style={styles.item}>
            {label}
          </Pressable>
        );
      })}
      {width > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.indicator,
            { width: indicatorWidth, backgroundColor: theme.primary },
            indicatorStyle,
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', borderBottomWidth: 1, width: '100%' },
  item: { flex: 1, minHeight: ITEM_HEIGHT, alignItems: 'center', justifyContent: 'center' },
  indicator: { position: 'absolute', left: 0, bottom: -1, height: 3, borderRadius: Radius.full },
});
