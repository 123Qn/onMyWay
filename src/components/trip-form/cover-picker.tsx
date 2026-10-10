import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { COVER_ASPECT } from '@/lib/trip-images';

export type CoverPickerProps = {
  /** Local file or signed URL of the current cover; null = no cover. */
  imageUri: string | null;
  hasCover: boolean;
  picking: boolean;
  disabled: boolean;
  onPick: () => void;
  onRemove: () => void;
};

export function CoverPicker({
  imageUri,
  hasCover,
  picking,
  disabled,
  onPick,
  onRemove,
}: CoverPickerProps) {
  const theme = useTheme();
  const { height: windowHeight } = useWindowDimensions();
  // 4:5 preview: full width, but never taller than 60% of the window (width = 0.6 * H * 4/5).
  const maxWidth = (windowHeight * 0.6 * COVER_ASPECT[0]) / COVER_ASPECT[1];

  return (
    <View style={styles.wrap}>
      <Pressable collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={hasCover ? 'Change cover photo' : 'Add cover photo'}
        accessibilityHint="Opens your photo library"
        accessibilityState={{ disabled: disabled || picking, busy: picking }}
        disabled={disabled || picking}
        onPress={onPick}
        style={[
          styles.box,
          { maxWidth },
          hasCover
            ? { backgroundColor: theme.primarySoft }
            : {
                backgroundColor: theme.primarySoft,
                borderColor: theme.borderStrong,
                borderWidth: 2,
                borderStyle: 'dashed',
              },
        ]}>
        {hasCover && imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            accessible={false}
          />
        ) : !hasCover ? (
          <View style={styles.empty}>
            <Icon name="image" size={32} color="primary" />
            <ThemedText type="small" themeColor="text" style={styles.label}>
              Add cover photo
            </ThemedText>
          </View>
        ) : null}
        {picking ? (
          <View style={[StyleSheet.absoluteFill, styles.spinner, { backgroundColor: theme.overlay }]}>
            <ActivityIndicator color={theme.onImage} />
          </View>
        ) : null}
      </Pressable>
      {hasCover ? (
        <View style={styles.actions}>
          <Button
            title="Change photo"
            variant="ghost"
            size="sm"
            disabled={disabled || picking}
            onPress={onPick}
          />
          <Button
            title="Remove photo"
            variant="ghost"
            size="sm"
            disabled={disabled || picking}
            onPress={onRemove}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: Spacing.one },
  box: {
    width: '100%',
    alignSelf: 'center',
    aspectRatio: 4 / 5,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', gap: Spacing.one },
  label: { fontFamily: FontFamily.semibold },
  spinner: { alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two, justifyContent: 'center' },
});
