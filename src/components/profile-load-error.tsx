import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
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
      <ErrorBanner message="Could not load your profile." onRetry={onRetry} retrying={retrying} />
      <Button
        title="Sign out"
        variant="ghost"
        fullWidth
        loading={signingOut}
        disabled={retrying}
        onPress={onSignOut}
      />
    </Screen>
  );
}
