import { Stack } from 'expo-router';

import { ToastHost } from '@/components/ui/toast-host';
import { useStackScreenOptions } from '@/hooks/use-stack-screen-options';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  const screenOptions = useStackScreenOptions();
  return (
    <>
      <Stack screenOptions={screenOptions}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="user/[username]" options={{ title: 'Profile' }} />
        <Stack.Screen name="activity" options={{ title: 'Activity' }} />
        <Stack.Screen name="trip/[id]" options={{ title: 'Trip' }} />
        <Stack.Screen
          name="trip/new"
          options={{ presentation: 'fullScreenModal', title: 'New trip', gestureEnabled: false }}
        />
        <Stack.Screen
          name="trip/[id]/edit"
          options={{ presentation: 'fullScreenModal', title: 'Edit trip', gestureEnabled: false }}
        />
        <Stack.Screen name="trip/[id]/likes" options={{ title: 'Likes' }} />
        <Stack.Screen
          name="trip/[id]/comments"
          options={{ presentation: 'modal', title: 'Comments' }}
        />
        <Stack.Screen name="trip/[id]/repost" options={{ presentation: 'modal', title: 'Repost' }} />
        <Stack.Screen
          name="profile/edit"
          options={{ presentation: 'modal', title: 'Edit profile' }}
        />
        <Stack.Screen
          name="pick-location"
          options={{ presentation: 'modal', title: 'Choose location' }}
        />
      </Stack>
      <ToastHost />
    </>
  );
}
