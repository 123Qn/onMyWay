import { Stack } from 'expo-router';

export const unstable_settings = { initialRouteName: 'choose-username' };

export default function OnboardingLayout() {
  return <Stack screenOptions={{ headerShown: false, gestureEnabled: false }} />;
}
