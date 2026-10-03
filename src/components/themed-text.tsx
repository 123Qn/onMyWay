import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, ThemeColor, Typography } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'link'
    | 'linkPrimary'
    | 'code'
    | 'display'
    | 'subheading'
    | 'bodyStrong'
    | 'caption'
    | 'heading'
    | 'statValue';
  themeColor?: ThemeColor;
};

export function ThemedText({
  style,
  type = 'default',
  themeColor,
  maxFontSizeMultiplier,
  ...rest
}: ThemedTextProps) {
  const theme = useTheme();
  const isLink = type === 'link' || type === 'linkPrimary';
  const color = theme[themeColor ?? (isLink ? 'primary' : 'text')];
  const defaultMultiplier = type === 'title' || type === 'display' || type === 'statValue'
      ? 1.6
      : type === 'heading'
        ? 1.8
        : undefined;

  return (
    <Text
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? defaultMultiplier}
      style={[{ color }, typeStyles[type], style]}
      {...rest}
    />
  );
}

const typeStyles = StyleSheet.create({
  default: Typography.body,
  title: Typography.title,
  subtitle: Typography.heading,
  small: { ...Typography.label, fontWeight: '500' },
  smallBold: { ...Typography.label, fontWeight: '700' },
  link: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  linkPrimary: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: '700' }) ?? '500',
    fontSize: 12,
    lineHeight: 16,
  },
  display: Typography.display,
  subheading: Typography.subheading,
  bodyStrong: Typography.bodyStrong,
  caption: Typography.caption,
  heading: Typography.heading,
  statValue: { ...Typography.statValue, fontVariant: ['tabular-nums'] },
});
