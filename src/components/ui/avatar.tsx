import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontFamily, Layout, Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl' | 'xxl' | number;

export type AvatarProps = {
  uri?: string | null;
  name?: string;
  size?: AvatarSize;
  accessibilityLabel?: string;
  /** Ring around the avatar: 'surface' (over a cover) or 'image' (over a photo). */
  ring?: 'none' | 'surface' | 'image';
  onPress?: () => void;
  testID?: string;
};

const SIZES = { sm: 32, md: 40, lg: 64, xl: 96, xxl: 112 } as const;

export function getInitials(name?: string): string {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0].charAt(0);
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : '';
  return (first + last).toUpperCase();
}

export function Avatar({
  uri,
  name,
  size = 'md',
  accessibilityLabel,
  ring = 'none',
  onPress,
  testID,
}: AvatarProps) {
  const theme = useTheme();
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const px = typeof size === 'number' ? size : SIZES[size];
  const label = accessibilityLabel ?? (name ? `${name}'s avatar` : 'Avatar');
  const ringWidth = ring === 'none' ? 0 : px >= SIZES.xl ? 4 : 2;
  const ringColor = ring === 'image' ? theme.onImage : theme.background;
  const showImage = !!uri && failedUri !== uri;

  const circle = (
    <View
      testID={onPress ? undefined : testID}
      accessible={!onPress}
      accessibilityRole={onPress ? undefined : 'image'}
      accessibilityLabel={onPress ? undefined : label}
      style={[
        styles.circle,
        { width: px, height: px, borderRadius: Radius.full, backgroundColor: theme.primarySoft },
        ringWidth > 0 && { borderWidth: ringWidth, borderColor: ringColor },
      ]}>
      {showImage ? (
        <Image
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          transition={150}
          cachePolicy="memory-disk"
          recyclingKey={uri}
          onError={() => setFailedUri(uri ?? null)}
        />
      ) : (
        <ThemedText
          themeColor="primaryPressed"
          maxFontSizeMultiplier={1.2}
          style={[styles.initials, { fontSize: px * 0.4, lineHeight: px * 0.5 }]}>
          {getInitials(name)}
        </ThemedText>
      )}
    </View>
  );

  if (!onPress) return circle;

  const slop = Math.max(0, (Layout.minTouchTarget - px) / 2);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={slop > 0 ? { top: slop, bottom: slop, left: slop, right: slop } : undefined}
      onPress={onPress}>
      {circle}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  circle: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: FontFamily.bold },
});
