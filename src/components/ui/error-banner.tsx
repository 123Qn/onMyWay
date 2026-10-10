import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Button } from './button';
import { Icon } from './icon';
import { IconButton } from './icon-button';

import { ThemedText } from '@/components/themed-text';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ErrorBannerProps = {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
  retrying?: boolean;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function ErrorBanner({
  message,
  onRetry,
  retryLabel = 'Retry',
  retrying = false,
  onDismiss,
  style,
  testID,
}: ErrorBannerProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[
        styles.container,
        { backgroundColor: theme.dangerSoft, borderColor: theme.danger + '66' },
        style,
      ]}>
      <Icon name="alert" size={Layout.iconSize.lg} color="danger" />
      <ThemedText style={styles.message}>{message}</ThemedText>
      {onRetry ? (
        <Button title={retryLabel} variant="ghost" size="sm" tone="onSoft" loading={retrying} onPress={onRetry} />
      ) : null}
      {onDismiss ? (
        <IconButton icon="close" accessibilityLabel="Dismiss error" onPress={onDismiss} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  message: { flex: 1 },
});
