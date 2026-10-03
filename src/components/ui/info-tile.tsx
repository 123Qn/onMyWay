import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Card } from './card';
import { Icon, type IconName } from './icon';

import { ThemedText } from '@/components/themed-text';
import { Radius } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type InfoTileProps = {
  icon: IconName;
  value: string;
  label: string;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Non-interactive stat tile. Put several in a row; each is `flex: 1`. */
export function InfoTile({ icon, value, label, accessibilityLabel, style, testID }: InfoTileProps) {
  const theme = useTheme();

  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={accessibilityLabel ?? `${value} ${label}`}
      style={[styles.flex, style]}>
      <Card elevation="sm" padding={12} style={styles.flex}>
        <View style={styles.content} importantForAccessibility="no-hide-descendants">
          <View style={[styles.iconCircle, { backgroundColor: theme.primarySoft }]}>
            <Icon name={icon} size={18} color="primaryPressed" />
          </View>
          <ThemedText
            type="bodyStrong"
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            maxFontSizeMultiplier={1.3}
            style={styles.centerText}>
            {value}
          </ThemedText>
          <ThemedText
            type="caption"
            themeColor="textMuted"
            maxFontSizeMultiplier={1.3}
            style={styles.centerText}>
            {label}
          </ThemedText>
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { minHeight: 80, alignItems: 'center', justifyContent: 'center', gap: 6 },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerText: { textAlign: 'center', alignSelf: 'stretch' },
});
