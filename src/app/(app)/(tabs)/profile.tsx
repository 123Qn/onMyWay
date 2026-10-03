import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { signOutUser } from '@/lib/sign-out';
import { useSession } from '@/providers/session-provider';

export default function ProfileScreen() {
  const { profile } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    setFailed(false);
    const result = await signOutUser();
    if (result === 'failed') setFailed(true);
    setSigningOut(false);
  };

  return (
    <Screen tabBarInset>
      <ThemedText type="title" accessibilityRole="header">
        Profile
      </ThemedText>
      <View style={styles.identity}>
        <Avatar size="xl" name={profile?.display_name} />
        <ThemedText type="subheading">{profile?.display_name ?? ''}</ThemedText>
        {profile ? <ThemedText themeColor="textMuted">{`@${profile.username}`}</ThemedText> : null}
      </View>
      {failed ? (
        <ErrorBanner
          message="Could not sign out. Please try again."
          onRetry={onSignOut}
          retrying={signingOut}
        />
      ) : null}
      <Button
        title="Sign out"
        variant="secondary"
        onPress={onSignOut}
        loading={signingOut}
        fullWidth
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.four },
});
