import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Spacing } from '@/constants/theme';
import { getAvatarUrl } from '@/lib/avatar-url';
import { getFirstName, type Greeting } from '@/lib/greeting';
import type { Profile } from '@/providers/session-provider';

export type FeedHeaderProps = {
  greeting: Greeting;
  profile: Profile | null;
};

// Phase 2: a right-aligned slot (notifications / search) goes after the text column. Not rendered.
export function FeedHeader({ greeting, profile }: FeedHeaderProps) {
  const firstName = getFirstName(profile?.display_name, profile?.username);
  const text = firstName ? `${greeting}, ${firstName}` : greeting;
  return (
    <View style={styles.row}>
      <Avatar
        size={48}
        uri={getAvatarUrl(profile?.avatar_path)}
        name={profile?.display_name ?? profile?.username}
        accessibilityLabel="Open your profile"
        onPress={() => router.navigate('/profile')}
      />
      <View style={styles.text}>
        <ThemedText
          type="title"
          accessibilityRole="header"
          accessibilityLabel={text}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}>
          {text}
        </ThemedText>
        <ThemedText themeColor="textMuted">Where to next?</ThemedText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three - Spacing.one,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  text: { flex: 1 },
});
