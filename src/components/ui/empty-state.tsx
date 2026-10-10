import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from './button';
import { Icon, type IconName } from './icon';

import { ThemedText } from '@/components/themed-text';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type EmptyStateProps = {
  icon?: IconName;
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function EmptyState({
  icon,
  title,
  message,
  actionLabel,
  onAction,
  style,
  testID,
}: EmptyStateProps) {
  const theme = useTheme();

  return (
    <View testID={testID} accessible={false} style={[styles.container, style]}>
      {icon ? (
        <View style={[styles.ring, { backgroundColor: theme.primarySoft + '66' }]}>
          <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
            <Icon name={icon} size={Layout.iconSize.xl} color="primary" />
          </View>
        </View>
      ) : null}
      <ThemedText type="heading" accessibilityRole="header" style={styles.centerText}>
        {title}
      </ThemedText>
      {message ? (
        <ThemedText themeColor="textMuted" style={styles.centerText}>
          {message}
        </ThemedText>
      ) : null}
      {actionLabel && onAction ? <Button title={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    maxWidth: 320,
  },
  ring: {
    width: 120,
    height: 120,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 88,
    height: 88,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: { textAlign: 'center' },
});
