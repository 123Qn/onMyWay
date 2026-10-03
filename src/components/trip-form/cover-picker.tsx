import { Image } from 'expo-image';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

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

  return (
    <View style={styles.wrap}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={hasCover ? 'Change cover photo' : 'Add cover photo'}
        accessibilityHint="Opens your photo library"
        accessibilityState={{ disabled: disabled || picking, busy: picking }}
        disabled={disabled || picking}
        onPress={onPick}
        style={[
          styles.box,
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
    aspectRatio: 16 / 9,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { alignItems: 'center', gap: Spacing.one },
  label: { fontFamily: FontFamily.semibold },
  spinner: { alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', gap: Spacing.two },
});
