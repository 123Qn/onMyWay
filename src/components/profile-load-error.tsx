import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { signOutUser } from '@/lib/sign-out';
import { useSession } from '@/providers/session-provider';

/** Full-screen state shown when the signed-in user's profile could not be loaded. */
export function ProfileLoadError() {
  const { refreshProfile } = useSession();
  const [retrying, setRetrying] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const onRetry = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      await refreshProfile();
    } finally {
      setRetrying(false);
    }
  };

  const onSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    await signOutUser();
    setSigningOut(false);
  };

  return (
    <Screen scroll padded="auth" centered>
      <Card padding={Spacing.four} radius="xl" style={styles.card}>
        <View style={styles.content}>
          <ErrorBanner message="Could not load your profile." onRetry={onRetry} retrying={retrying} />
          <Button
            title="Sign out"
            variant="ghost"
            size="lg"
            fullWidth
            loading={signingOut}
            disabled={retrying}
            onPress={onSignOut}
          />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { width: '100%', maxWidth: 480, alignSelf: 'center' },
  content: { gap: Spacing.three },
});
