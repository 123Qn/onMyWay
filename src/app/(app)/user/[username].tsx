import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import {
  ProfileHeader,
  ProfileHeaderSkeleton,
} from '@/components/profile/profile-header';
import { ProfileTripList } from '@/components/profile/profile-trip-list';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { SkeletonGroup } from '@/components/ui/skeleton';
import { useProfileTrips } from '@/hooks/use-profile-trips';
import { getAvatarUrl } from '@/lib/avatar-url';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/providers/session-provider';
import type { Profile } from '@/providers/session-provider';

type State =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'not-found' }
  | { status: 'ready'; profile: Profile };

async function fetchProfile(username: string): Promise<State> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_path, bio')
      .eq('username', username)
      .maybeSingle();
    if (error) return { status: 'error' };
    return data ? { status: 'ready', profile: data } : { status: 'not-found' };
  } catch {
    return { status: 'error' };
  }
}

const EDGES = ['left', 'right', 'bottom'] as const;

export default function UserProfileScreen() {
  const params = useLocalSearchParams<{ username: string }>();
  const username = String(params.username ?? '').toLowerCase();
  const { profile: me } = useSession();
  const isMe = !!me && me.username === username;

  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    if (isMe) {
      router.replace('/profile');
      return;
    }
    let active = true;
    fetchProfile(username).then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, [isMe, username]);

  const retry = () => {
    setState({ status: 'loading' });
    fetchProfile(username).then(setState);
  };

  const shown = state.status === 'ready' ? state.profile : null;
  const trips = useProfileTrips({ ownerId: shown?.id ?? null, publicOnly: true });

  const title = `@${username}`;

  if (isMe) return <Stack.Screen options={{ title }} />;

  let body;
  if (state.status === 'loading') {
    body = (
      <Screen edges={[...EDGES]} padded={false}>
        <SkeletonGroup>
          <ProfileHeaderSkeleton />
        </SkeletonGroup>
      </Screen>
    );
  } else if (state.status === 'not-found') {
    body = (
      <Screen edges={[...EDGES]} centered>
        <EmptyState
          icon="person"
          title="User not found"
          message="This profile doesn't exist or was removed."
          actionLabel="Go back"
          onAction={() => router.back()}
        />
      </Screen>
    );
  } else if (state.status === 'error') {
    body = (
      <Screen edges={[...EDGES]}>
        <ErrorBanner message="Could not load this profile." onRetry={retry} />
      </Screen>
    );
  } else {
    body = (
      <Screen edges={[...EDGES]} padded={false} keyboardAvoiding={false}>
        <ProfileTripList
          trips={trips}
          header={
            <ProfileHeader
              displayName={state.profile.display_name}
              username={state.profile.username}
              avatarUrl={getAvatarUrl(state.profile.avatar_path)}
              bio={state.profile.bio}
              tripCount={trips.count}
            />
          }
          loadError="Could not load this profile."
          refreshError="Could not load this profile."
          onPressTrip={(id) => router.push(`/trip/${id}`)}
          empty={
            <EmptyState
              icon="map"
              title="No public trips yet"
              message={`@${state.profile.username} hasn't shared a trip yet.`}
            />
          }
        />
      </Screen>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title }} />
      {body}
    </>
  );
}
