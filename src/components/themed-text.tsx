import { StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, Fonts, ThemeColor, Typography } from '@/constants/theme';
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
  small: { ...Typography.label, fontFamily: FontFamily.medium },
  smallBold: { ...Typography.label, fontFamily: FontFamily.bold },
  link: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.semibold },
  linkPrimary: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.semibold },
  code: {
    fontFamily: Fonts.mono,
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
