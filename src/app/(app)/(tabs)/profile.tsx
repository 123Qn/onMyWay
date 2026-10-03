import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';

export default function ProfileScreen() {
  return (
    <Screen tabBarInset>
      <ThemedText type="title" accessibilityRole="header">
        Profile
      </ThemedText>
      <View style={styles.identity}>
        <Avatar size="xl" name="Your Name" />
        <ThemedText type="subheading">Your Name</ThemedText>
        <ThemedText themeColor="textMuted">@username</ThemedText>
      </View>
      {/* TODO step 5: wire to the session sign-out. */}
      <Button title="Sign out" variant="secondary" onPress={() => {}} disabled fullWidth />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
});
