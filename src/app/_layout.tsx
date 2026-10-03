import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ProfileLoadError } from '@/components/profile-load-error';
import { SessionProvider, needsUsername, useSession } from '@/providers/session-provider';

SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { session, profile, isLoading, profileError } = useSession();

  useEffect(() => {
    if (!isLoading) SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) return null;

  if (session && profileError) {
    return (
      <>
        <AnimatedSplashOverlay />
        <ProfileLoadError />
      </>
    );
  }

  const ready = !!session && !!profile;
  const onboarding = ready && needsUsername(profile);

  return (
    <>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={onboarding}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={ready && !onboarding}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <SessionProvider>
          <RootStack />
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
