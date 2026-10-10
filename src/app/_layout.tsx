import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular';
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium';
import { PlusJakartaSans_600SemiBold } from '@expo-google-fonts/plus-jakarta-sans/600SemiBold';
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect, useMemo, useRef } from 'react';
import { useColorScheme } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { ProfileLoadError } from '@/components/profile-load-error';
import { useTheme } from '@/hooks/use-theme';
import { consumePendingLink, setPendingLink } from '@/lib/pending-link';
import { SessionProvider, needsUsername, useSession } from '@/providers/session-provider';

SplashScreen.preventAutoHideAsync();

function RootStack({ fontsReady }: { fontsReady: boolean }) {
  const { session, profile, isLoading, profileError, recovering } = useSession();

  const ready = !!session && !!profile;
  const onboarding = ready && needsUsername(profile) && !recovering;
  const appOpen = ready && !onboarding && !recovering;

  // A deep link opened while signed out would be dropped by the guards. Remember it (validated
  // to /trip/<uuid> only) and open it once after sign-in. Each distinct URL is looked at once,
  // so a stale URL is not re-captured after a later sign-out.
  const url = Linking.useLinkingURL();
  const seenUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading || !url || url === seenUrlRef.current) return;
    seenUrlRef.current = url;
    if (!session) setPendingLink(url);
  }, [url, session, isLoading]);

  // Signed in and past onboarding: open the remembered link on top of the tabs, once. The timer
  // lets the (app) navigator mount first.
  useEffect(() => {
    if (!appOpen) return;
    const timer = setTimeout(() => {
      const path = consumePendingLink();
      if (path) router.push(path as never);
    }, 0);
    return () => clearTimeout(timer);
  }, [appOpen]);

  // The native splash stays up until the session and the fonts are both settled. Only then is
  // AnimatedSplashOverlay mounted, and it is the single owner of SplashScreen.hideAsync()
  // (native splash -> same-colour overlay -> fade).
  // While recovering, the profile fetch of the freshly exchanged session must not unmount the
  // reset screen.
  if ((isLoading && !recovering) || !fontsReady) return null;

  if (session && profileError && !recovering) {
    return (
      <>
        <AnimatedSplashOverlay />
        <ProfileLoadError />
      </>
    );
  }

  return (
    <>
      <AnimatedSplashOverlay />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={!session && !recovering}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={onboarding}>
          <Stack.Screen name="(onboarding)" />
        </Stack.Protected>
        <Stack.Protected guard={appOpen}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        {/* Reachable in every state so the recovery deep link resolves; it guards itself. */}
        <Stack.Screen name="reset-password" />
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
