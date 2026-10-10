import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from './button';
import { Icon, type IconName } from './icon';

import { ThemedText } from '@/components/themed-text';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type SheetRow = {
  key: string;
  icon: IconName;
  label: string;
  destructive?: boolean;
  onPress: () => void;
};

export type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  rows: SheetRow[];
  /** Accessible name of the sheet. */
  title: string;
};

const ROW_HEIGHT = 56;

/**
 * Custom bottom sheet (same on iOS and Android). The Modal stays mounted and only `visible`
 * changes. Closes on scrim tap, the Cancel button and Android back.
 */
export function BottomSheet({ visible, onClose, rows, title }: BottomSheetProps) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Inside an Android edge-to-edge Modal the bottom inset can read 0, so keep a minimum that
  // clears a 3-button nav bar (~48dp).
  const bottomPadding =
    Math.max(insets.bottom, 0) + Spacing.three + (Platform.OS === 'android' && insets.bottom === 0 ? Spacing.four + 16 : 0);

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent>
      <View collapsable={false} style={styles.root}>
        <Pressable
          collapsable={false}
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={[StyleSheet.absoluteFill, { backgroundColor: theme.overlay }]}
        />
        <View
          collapsable={false}
          accessibilityViewIsModal
          accessibilityLabel={title}
          style={[
            styles.sheet,
            { backgroundColor: theme.surface, paddingBottom: bottomPadding },
          ]}>
          <View
            collapsable={false}
            style={[styles.handle, { backgroundColor: theme.borderStrong }]}
            importantForAccessibility="no-hide-descendants"
          />
          {rows.map((row) => (
            <Pressable
              collapsable={false}
              key={row.key}
              accessibilityRole="button"
              accessibilityLabel={row.label}
              onPress={row.onPress}
              style={({ pressed }) => [
                styles.row,
                pressed && { backgroundColor: theme.surfaceMuted },
              ]}>
              <Icon
                name={row.icon}
                size={Layout.iconSize.lg}
                color={row.destructive ? 'danger' : 'text'}
              />
              <ThemedText type="bodyStrong" themeColor={row.destructive ? 'danger' : 'text'}>
                {row.label}
              </ThemedText>
            </Pressable>
          ))}
          <Button title="Cancel" variant="secondary" fullWidth onPress={onClose} style={styles.cancel} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.xxl,
    borderTopRightRadius: Radius.xxl,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    gap: Spacing.one,
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: Radius.full,
    marginBottom: Spacing.two,
    opacity: 0.5,
  },
  row: {
    minHeight: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderRadius: Radius.md,
  },
  cancel: { marginTop: Spacing.two },
});
