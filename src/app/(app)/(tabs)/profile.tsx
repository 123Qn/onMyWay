import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ProfileHeader } from '@/components/profile/profile-header';
import { ProfileTripList } from '@/components/profile/profile-trip-list';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useProfileTrips } from '@/hooks/use-profile-trips';
import { getAvatarUrl } from '@/lib/avatar-url';
import { signOutUser } from '@/lib/sign-out';
import { useSession } from '@/providers/session-provider';

export default function ProfileScreen() {
  const { profile, refreshProfile } = useSession();
  const trips = useProfileTrips({ ownerId: profile?.id ?? null, publicOnly: false });
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

  const header = (
    <>
      <ProfileHeader
        displayName={profile?.display_name ?? ''}
        username={profile?.username ?? ''}
        avatarUrl={getAvatarUrl(profile?.avatar_path)}
        bio={profile?.bio}
        tripCount={trips.count}
        actions={
          <>
            <Button
              title="Edit profile"
              variant="secondary"
              onPress={() => router.push('/profile/edit')}
              style={styles.action}
            />
            <Button
              title="Sign out"
              variant="ghost"
              onPress={onSignOut}
              loading={signingOut}
              style={styles.action}
            />
          </>
        }
      />
      {failed ? (
        <ErrorBanner
          message="Could not sign out. Please try again."
          onRetry={onSignOut}
          retrying={signingOut}
          style={styles.banner}
        />
      ) : null}
    </>
  );

  return (
    <Screen tabBarInset padded={false} keyboardAvoiding={false}>
      <ProfileTripList
        trips={trips}
        header={header}
        loadError="Could not load your trips."
        refreshError="Could not load your trips."
        onPressTrip={(id) => router.push(`/trip/${id}`)}
        onRefresh={refreshProfile}
        empty={
          <EmptyState
            icon="map"
            title="You haven't created a trip"
            message="Plan a route and share it with other travellers."
            actionLabel="Create a trip"
            onAction={() => router.push('/trip/new')}
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  action: { flex: 1 },
  banner: { marginBottom: Spacing.two },
});
