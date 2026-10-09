/**
 * Design tokens for the UI refresh (see docs/DESIGN.md section 2).
 * Colors are defined for light and dark mode; key names are stable, values may change.
 */

import '@/global.css';

import { Platform, type ViewStyle } from 'react-native';

export const Colors = {
  light: {
    text: '#1C1815',
    background: '#FAF7F2',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#EAE3DA',
    textSecondary: '#6B625A',
    /** Alias of backgroundElement. */
    surface: '#FFFFFF',
    /** Secondary button fill, chips, input fill inside a card. */
    surfaceMuted: '#F3EEE7',
    /** Alias of textSecondary. */
    textMuted: '#6B625A',
    /** Alias of backgroundSelected. Decorative dividers only, not input outlines. */
    border: '#EAE3DA',
    /** Input outlines, dashed pickers, radio rings (>= 3:1 non-text contrast). */
    borderStrong: '#8C8279',
    primary: '#C73A10',
    /** Pressed state; also the text/icon colour on primarySoft. */
    primaryPressed: '#A32C09',
    /** Decorative coral and icon-only tab-bar "+" fill. Never text. */
    primaryBright: '#F2592B',
    /** Alias of primaryBright. */
    fab: '#F2592B',
    onFab: '#FFFFFF',
    fabPressed: '#C73A10',
    onPrimary: '#FFFFFF',
    primarySoft: '#FDE9E1',
    danger: '#B3261E',
    onDanger: '#FFFFFF',
    dangerSoft: '#FCEAE8',
    success: '#1B7F3B',
    skeleton: '#EBE5DD',
    skeletonHighlight: '#F6F1EA',
    overlay: 'rgba(20,12,8,0.5)',
    onImage: '#FFFFFF',
    onImageMuted: '#F8F5F0',
    scrimChip: 'rgba(0,0,0,0.55)',
    glassFill: 'rgba(255,255,255,0.90)',
    glassBorder: 'rgba(255,255,255,0.65)',
    glassSolid: '#FFFFFF',
    backgroundTransparent: 'rgba(250,247,242,0)',
    shadow: '#2B1A10',
  },
  dark: {
    text: '#F7F2EC',
    background: '#14110F',
    backgroundElement: '#1E1A17',
    backgroundSelected: '#332D28',
    textSecondary: '#B9AEA3',
    surface: '#1E1A17',
    surfaceMuted: '#26211D',
    textMuted: '#B9AEA3',
    border: '#332D28',
    borderStrong: '#7A6F65',
    primary: '#FF7A4D',
    primaryPressed: '#FF9770',
    primaryBright: '#FF7A4D',
    fab: '#FF7A4D',
    onFab: '#240B02',
    fabPressed: '#FF9770',
    onPrimary: '#240B02',
    primarySoft: '#3A1E14',
    danger: '#FF8F85',
    onDanger: '#2A0A07',
    dangerSoft: '#3B1D1A',
    success: '#5FD38A',
    skeleton: '#2B2622',
    skeletonHighlight: '#38322C',
    overlay: 'rgba(0,0,0,0.6)',
    onImage: '#FFFFFF',
    onImageMuted: '#F8F5F0',
    scrimChip: 'rgba(0,0,0,0.55)',
    glassFill: 'rgba(30,26,23,0.88)',
    glassBorder: 'rgba(255,255,255,0.10)',
    glassSolid: '#26211D',
    backgroundTransparent: 'rgba(20,17,15,0)',
    shadow: '#000000',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export type ThemeColors = (typeof Colors)[keyof typeof Colors];

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

/**
 * Font family names (Plus Jakarta Sans). Loaded at runtime in the root layout; weight is
 * chosen only through the family.
 */
export const FontFamily = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const MaxContentWidth = 800;

export const Radius = { xs: 6, sm: 10, md: 14, lg: 20, xl: 28, xxl: 36, full: 9999 } as const;

export const Layout = {
  minTouchTarget: 44,
  controlHeight: { sm: 36, md: 48, lg: 56 }, // sm gets hitSlop to reach 44
  inputHeight: 52,
  screenPadding: Spacing.three,
  gridGap: 12,
  iconSize: { sm: 16, md: 20, lg: 24, xl: 32 },
} as const;

export const TabBar = {
  height: 64,
  margin: 16,
  maxWidth: 420,
  fab: 56,
  fabLift: 20,
  bottomMin: 12,
} as const;

export const Duration = { fast: 150, normal: 250, slow: 400, pulse: 900 } as const;

// Weight is chosen only through fontFamily; never combine with fontWeight.
export const Typography = {
  display: { fontSize: 34, lineHeight: 42, letterSpacing: -0.4, fontFamily: FontFamily.bold },
  title: { fontSize: 28, lineHeight: 34, letterSpacing: -0.3, fontFamily: FontFamily.bold },
  heading: { fontSize: 22, lineHeight: 28, letterSpacing: -0.2, fontFamily: FontFamily.bold },
  subheading: { fontSize: 18, lineHeight: 24, letterSpacing: 0, fontFamily: FontFamily.semibold },
  body: { fontSize: 16, lineHeight: 24, letterSpacing: 0, fontFamily: FontFamily.regular },
  bodyStrong: { fontSize: 16, lineHeight: 24, letterSpacing: 0, fontFamily: FontFamily.semibold },
  label: { fontSize: 14, lineHeight: 20, letterSpacing: 0, fontFamily: FontFamily.semibold },
  caption: { fontSize: 12, lineHeight: 16, letterSpacing: 0.1, fontFamily: FontFamily.medium },
  statValue: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
    fontFamily: FontFamily.bold,
    fontVariant: ['tabular-nums'],
  },
} as const;

export type ShadowLevel = 'sm' | 'md' | 'lg' | 'fab';

const SHADOW_SPEC = {
  sm: { y: 2, opacity: 0.06, radius: 6, elevation: 2 },
  md: { y: 6, opacity: 0.1, radius: 16, elevation: 4 },
  lg: { y: 10, opacity: 0.14, radius: 24, elevation: 8 },
  fab: { y: 8, opacity: 0.35, radius: 14, elevation: 8 },
} as const;

/**
 * Shadow style for a theme level. Dark mode doubles the opacity (black shadow colour).
 * For `fab`, `tint` colours the glow ('primaryBright' for the tab-bar "+", 'primary' for the
 * floating Follow button). On iOS, clipped cards need an outer shadow view and an inner
 * overflow:hidden view; Android needs an opaque backgroundColor on the shadowed view.
 */
export function shadow(
  theme: ThemeColors,
  level: ShadowLevel,
  tint: 'primaryBright' | 'primary' = 'primaryBright',
): ViewStyle {
  const spec = SHADOW_SPEC[level];
  const dark = theme.background === Colors.dark.background;
  const color = level === 'fab' ? theme[tint] : theme.shadow;
  const opacity = dark && level !== 'fab' ? spec.opacity * 2 : spec.opacity;
  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: spec.y },
    shadowOpacity: opacity,
    shadowRadius: spec.radius,
    elevation: spec.elevation,
  };
}

export type GradientSpec = {
  colors: readonly [string, string, ...string[]];
  locations?: readonly [number, number, ...number[]];
  start: { x: number; y: number };
  end: { x: number; y: number };
};

const SCRIM_COLORS = ['rgba(16,10,6,0)', 'rgba(16,10,6,0.62)', 'rgba(16,10,6,0.90)'] as const;
const VERTICAL = { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } } as const;
const DIAGONAL = { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } } as const;

export const Gradients = {
  /** Feed card overlay; covers the bottom 65% of the card. */
  imageScrim: { colors: SCRIM_COLORS, locations: [0, 0.25, 1], ...VERTICAL },
  /** Grid tile overlay; covers the bottom 60% of the tile. */
  tileScrim: { colors: SCRIM_COLORS, locations: [0, 0.25, 1], ...VERTICAL },
  /** Auth hero. White text is allowed: every stop is >= 4.5:1. */
  brand: { colors: ['#D6420F', '#C73A10', '#A32C09'], ...DIAGONAL },
  /** Seeded fallbacks for covers without a photo. No text on the lighter ones. */
  coverFallbacks: [
    { colors: ['#FF9A6B', '#F2592B'], ...DIAGONAL },
    { colors: ['#FFC48A', '#F2592B'], ...DIAGONAL },
    { colors: ['#F2592B', '#8E3B6B'], ...DIAGONAL },
    { colors: ['#2AA59B', '#1E6F8C'], ...DIAGONAL },
    { colors: ['#E9C99B', '#D98A4E'], ...DIAGONAL },
  ],
} as const satisfies Record<string, GradientSpec | readonly GradientSpec[]>;

/** Bottom fade from transparent to the canvas colour, built per theme. */
export function fadeToBackground(theme: ThemeColors): GradientSpec {
  return { colors: [theme.backgroundTransparent, theme.background], ...VERTICAL };
}

/** Index into `Gradients.coverFallbacks` from a seed string (username or trip id). */
export function coverFallbackIndex(seed: string): number {
  let sum = 0;
  for (let i = 0; i < seed.length; i++) sum += seed.charCodeAt(i);
  return sum % Gradients.coverFallbacks.length;
}
