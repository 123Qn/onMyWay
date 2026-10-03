import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { router } from 'expo-router';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { GlassSurface } from '@/components/ui/glass-surface';
import { Icon, type IconName } from '@/components/ui/icon';
import { FontFamily, Layout, Radius, shadow, TabBar } from '@/constants/theme';
import { useTabBarBottomOffset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';

const FAB_RING = 4;
const FAB_OUTER = TabBar.fab + FAB_RING * 2;
const SPACER = 72;
const CAPSULE = { width: 56, height: 32 } as const;

const ROUTE_ICONS: Record<string, IconName> = { index: 'home', profile: 'person' };

function CreateButton() {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Create trip"
      accessibilityHint="Opens the new trip form"
      onPress={() => router.push('/trip/new')}
      style={({ pressed }) => [
        styles.fab,
        shadow(theme, 'fab', 'primaryBright'),
        {
          backgroundColor: pressed ? theme.fabPressed : theme.fab,
          borderColor: theme.background,
        },
        pressed && styles.fabPressed,
      ]}>
      <Icon name="plus" size={28} color="onFab" />
    </Pressable>
  );
}

/** Floating glass tab bar: [tabs] [raised "+" button] [tabs]. The "+" is not a route. */
export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const theme = useTheme();
  const bottom = useTabBarBottomOffset();
  const half = Math.ceil(state.routes.length / 2);

  const renderTab = (route: (typeof state.routes)[number], index: number) => {
    const { options } = descriptors[route.key];
    const label = typeof options.title === 'string' ? options.title : route.name;
    const focused = state.index === index;
    const iconColor = focused ? 'primary' : 'textMuted';

    const onPress = () => {
      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
      if (!focused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityLabel={options.tabBarAccessibilityLabel ?? label}
        accessibilityState={{ selected: focused }}
        testID={options.tabBarButtonTestID}
        onPress={onPress}
        onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
        style={styles.tab}>
        <View style={[styles.capsule, focused && { backgroundColor: theme.primarySoft }]}>
          <Icon name={ROUTE_ICONS[route.name] ?? 'home'} size={Layout.iconSize.lg} color={iconColor} />
        </View>
        <ThemedText
          type="caption"
          themeColor={focused ? 'text' : 'textMuted'}
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          style={styles.label}>
          {label}
        </ThemedText>
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrapper, { paddingBottom: bottom }]}>
      <View pointerEvents="box-none" style={styles.container}>
        <View style={[styles.pillShadow, shadow(theme, 'lg'), { backgroundColor: theme.glassSolid }]}>
          <GlassSurface style={styles.pill}>
            <View accessibilityRole="tablist" style={styles.row}>
              <View style={styles.slot}>
                {state.routes.slice(0, half).map((r, i) => renderTab(r, i))}
              </View>
              <View style={styles.spacer} />
              <View style={styles.slot}>
                {state.routes.slice(half).map((r, i) => renderTab(r, i + half))}
              </View>
            </View>
          </GlassSurface>
        </View>
        <View pointerEvents="box-none" style={styles.fabAnchor}>
          <CreateButton />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: TabBar.margin,
  },
  // Tall enough that the protruding "+" stays inside its parent (touches outside bounds are lost).
  container: {
    width: '100%',
    maxWidth: TabBar.maxWidth,
    height: TabBar.height + TabBar.fabLift,
    justifyContent: 'flex-end',
  },
  pillShadow: { height: TabBar.height, borderRadius: Radius.full },
  pill: { flex: 1 },
  row: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  slot: { flex: 1, flexDirection: 'row' },
  spacer: { width: SPACER },
  tab: {
    flex: 1,
    minHeight: TabBar.height,
    minWidth: Layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  capsule: {
    width: CAPSULE.width,
    height: CAPSULE.height,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: FontFamily.semibold },
  fabAnchor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  fab: {
    width: FAB_OUTER,
    height: FAB_OUTER,
    borderRadius: Radius.full,
    borderWidth: FAB_RING,
    alignItems: 'center',
    justifyContent: 'center',
    // Android elevation needs an opaque fill (set above); keep the ring crisp on both platforms.
    ...Platform.select({ android: { elevation: 8 } }),
  },
  fabPressed: { transform: [{ scale: 0.94 }] },
});
