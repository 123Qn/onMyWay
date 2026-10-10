import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { IconButton } from '@/components/ui/icon-button';
import { Spacing } from '@/constants/theme';
import { getFirstName, type Greeting } from '@/lib/greeting';
import { useTheme } from '@/hooks/use-theme';
import type { Profile } from '@/providers/session-provider';

export type FeedHeaderProps = {
  greeting: Greeting;
  profile: Profile | null;
};

// Phase 2: the friends rail height becomes 96 and the slot gets content (height-only change).
const FRIENDS_RAIL_HEIGHT = 0;

// Sticky top bar, rendered above the feed list (does not scroll). Its horizontal padding and
// maxWidth match the list content so the buttons align with the card edges.
export function FeedTopBar() {
  const theme = useTheme();
  return (
    <View collapsable={false} style={[styles.barOuter, { backgroundColor: theme.background }]}>
      <View collapsable={false} style={styles.bar}>
        <IconButton
          icon="plus"
          variant="filled"
          size="lg"
          style={styles.barButton}
          accessibilityLabel="Create trip"
          accessibilityHint="Opens the new trip form"
          onPress={() => router.push('/trip/new')}
        />
        <View collapsable={false} style={styles.center}>
          <ThemedText
            type="heading"
            accessibilityRole="header"
            accessibilityLabel="onMyWay"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
            maxFontSizeMultiplier={1.3}
            style={styles.wordmark}>
            on
            <ThemedText type="heading" themeColor="primary" maxFontSizeMultiplier={1.3}>
              My
            </ThemedText>
            Way
          </ThemedText>
        </View>
        <IconButton
          icon="heart"
          variant="filled"
          size="lg"
          style={styles.barButton}
          accessibilityLabel="Activity"
          accessibilityHint="Opens your activity"
          onPress={() => router.push('/activity')}
        />
      </View>
    </View>
  );
}

// Scrolls with the list (ListHeaderComponent). Two fixed, always-mounted children: greeting and
// friends slot. The root has no `gap`, so the zero-height slot adds no spacing.
export function FeedHeader({ greeting, profile }: FeedHeaderProps) {
  const firstName = getFirstName(profile?.display_name, profile?.username);
  const text = firstName ? `${greeting}, ${firstName}` : greeting;
  return (
    <View collapsable={false}>
      <View collapsable={false} style={styles.greeting}>
        <ThemedText
          type="small"
          themeColor="textMuted"
          numberOfLines={2}
          maxFontSizeMultiplier={1.6}>
          {text}
        </ThemedText>
      </View>
      <View
        collapsable={false}
        importantForAccessibility="no-hide-descendants"
        style={{ height: FRIENDS_RAIL_HEIGHT }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  barOuter: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.two,
  },
  bar: { flexDirection: 'row', alignItems: 'center', minHeight: 52 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  barButton: { width: 44, height: 44 },
  wordmark: { textAlign: 'center' },
  greeting: { marginBottom: Spacing.two },
});
