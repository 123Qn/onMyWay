import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet } from 'react-native';

import { ProfileHeader } from '@/components/profile/profile-header';
import { profileStatItems } from '@/components/profile/stats-row';
import { ProfileTripList } from '@/components/profile/profile-trip-list';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useProfileStats } from '@/hooks/use-profile-stats';
import { useProfileTrips } from '@/hooks/use-profile-trips';
import { firstCover } from '@/lib/profile-cover';
import { getAvatarUrl } from '@/lib/avatar-url';
import { signOutUser } from '@/lib/sign-out';
import { useSession } from '@/providers/session-provider';

export default function ProfileScreen() {
  const { profile, refreshProfile } = useSession();
  const trips = useProfileTrips({ ownerId: profile?.id ?? null, publicOnly: false });
  const stats = useProfileStats(profile?.id ?? null, { watchTripEvents: true });
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
        cover={firstCover(trips)}
        onCoverError={trips.retryCover}
        stats={profileStatItems(stats.stats, stats.error)}
        actions={
          <>
            <Button
              title="Edit profile"
              variant="primary"
              onPress={() => router.push('/profile/edit')}
              style={styles.action}
            />
            <Button
              title="Sign out"
              variant="secondary"
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
        onRefresh={() => Promise.all([refreshProfile(), stats.refetch()])}
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
  action: { flex: 1, maxWidth: 168 },
  banner: { marginBottom: Spacing.two },
});
