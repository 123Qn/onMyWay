import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ProfileLoadError } from '@/components/profile-load-error';
import { useTheme } from '@/hooks/use-theme';
import { SessionProvider, needsUsername, useSession } from '@/providers/session-provider';

SplashScreen.preventAutoHideAsync();

function RootStack({ fontsReady }: { fontsReady: boolean }) {
  const { session, profile, isLoading, profileError } = useSession();

  useEffect(() => {
    if (!isLoading && fontsReady) SplashScreen.hideAsync();
  }, [isLoading, fontsReady]);

  // The splash stays visible until the session and the fonts are both settled.
  if (isLoading || !fontsReady) return null;

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
  const theme = useTheme();

  // Only the four weights in use are bundled. On error the app continues with system fonts.
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  useEffect(() => {
    if (fontError && __DEV__) console.warn('Font loading failed, using system fonts.', fontError);
  }, [fontError]);

  // Navigation theme built from tokens so transitions never flash white/black.
  const navigationTheme = useMemo(() => {
    const base = colorScheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        background: theme.background,
        card: theme.background,
        text: theme.text,
        border: theme.border,
        primary: theme.primary,
      },
    };
  }, [colorScheme, theme]);

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(theme.background).catch(() => {});
  }, [theme.background]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        {/* Base entry of the status-bar stack; the auth hero pushes 'light' and pops it on unmount. */}
        <StatusBar style="auto" />
        <SessionProvider>
          <RootStack fontsReady={fontsLoaded || !!fontError} />
        </SessionProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
