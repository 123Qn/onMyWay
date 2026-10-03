/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#000000',
    background: '#ffffff',
    backgroundElement: '#F0F0F3',
    backgroundSelected: '#E0E1E6',
    textSecondary: '#60646C',
    /** Alias of backgroundElement. */
    surface: '#F0F0F3',
    /** Alias of textSecondary. */
    textMuted: '#60646C',
    /** Alias of backgroundSelected. Decorative dividers only, not input outlines. */
    border: '#E0E1E6',
    /** Input and outline-button borders (>= 3:1 non-text contrast). */
    borderStrong: '#8A8E96',
    primary: '#0B7A75',
    primaryPressed: '#095F5B',
    onPrimary: '#FFFFFF',
    primarySoft: '#E0F2F1',
    danger: '#C62828',
    onDanger: '#FFFFFF',
    dangerSoft: '#FDECEC',
    success: '#1B7F3B',
    skeleton: '#E4E5E9',
    skeletonHighlight: '#F0F0F3',
    overlay: 'rgba(0,0,0,0.5)',
  },
  dark: {
    text: '#ffffff',
    background: '#000000',
    backgroundElement: '#212225',
    backgroundSelected: '#2E3135',
    textSecondary: '#B0B4BA',
    surface: '#212225',
    textMuted: '#B0B4BA',
    border: '#2E3135',
    borderStrong: '#6B6F76',
    primary: '#2DD4BF',
    primaryPressed: '#5EEAD4',
    onPrimary: '#04211F',
    primarySoft: '#0F2E2C',
    danger: '#FF6B6B',
    onDanger: '#000000',
    dangerSoft: '#3A1B1D',
    success: '#4ADE80',
    skeleton: '#2A2D31',
    skeletonHighlight: '#363A3F',
    overlay: 'rgba(0,0,0,0.6)',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;

export const Radius = { sm: 8, md: 12, lg: 16, xl: 24, full: 9999 } as const;

export const Layout = {
  minTouchTarget: 44,
  controlHeight: { sm: 36, md: 48, lg: 56 }, // sm gets hitSlop to reach 44
  screenPadding: Spacing.three,
  iconSize: { sm: 16, md: 20, lg: 24, xl: 32 },
} as const;

export const Duration = { fast: 150, normal: 250, pulse: 900 } as const;

export const Typography = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  heading: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  subheading: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  label: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
} as const;
