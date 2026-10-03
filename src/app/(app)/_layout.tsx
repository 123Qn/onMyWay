import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="user/[username]" options={{ title: 'Profile' }} />
      <Stack.Screen name="trip/[id]" options={{ title: 'Trip' }} />
      <Stack.Screen
        name="trip/new"
        options={{ presentation: 'fullScreenModal', title: 'New trip', gestureEnabled: false }}
      />
      <Stack.Screen
        name="trip/[id]/edit"
        options={{ presentation: 'fullScreenModal', title: 'Edit trip', gestureEnabled: false }}
      />
      <Stack.Screen
        name="profile/edit"
        options={{ presentation: 'modal', title: 'Edit profile' }}
      />
      <Stack.Screen
        name="pick-location"
        options={{ presentation: 'modal', title: 'Choose location' }}
      />
    </Stack>
  );
}
