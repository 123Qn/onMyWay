import type { Stack } from 'expo-router';
import type { ComponentProps } from 'react';
import { Platform } from 'react-native';

import { FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type StackOptions = Exclude<
  NonNullable<ComponentProps<typeof Stack>['screenOptions']>,
  (...args: never[]) => unknown
>;

/** Shared native-stack header/content styling from tokens (DESIGN.md 3.10). */
export function useStackScreenOptions(): StackOptions {
  const theme = useTheme();
  return {
    headerShadowVisible: false,
    headerStyle: { backgroundColor: theme.background },
    headerTintColor: theme.text,
    headerTitleStyle: { fontFamily: FontFamily.bold, fontSize: 17 },
    contentStyle: { backgroundColor: theme.background },
    ...(Platform.OS === 'ios' ? { headerBackButtonDisplayMode: 'minimal' as const } : null),
  };
}
