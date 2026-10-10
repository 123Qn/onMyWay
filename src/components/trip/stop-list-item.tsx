import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';

import { CollapsibleText } from './collapsible-text';
import { PhotoStrip, type StripPhoto } from './photo-strip';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type StopListItemData = {
  id: string;
  name: string;
  address: string | null;
  notes: string | null;
  photos: StripPhoto[];
};

export type StopListItemProps = {
  /** 1-based display number. */
  index: number;
  stop: StopListItemData;
  selected: boolean;
  onPress: () => void;
  onRetryPhoto?: (path: string) => void;
  /** Parent records the card's y offset to scroll to it. */
  onLayout?: (event: LayoutChangeEvent) => void;
};

const BADGE = 32;

/** Stop card: `surface` + soft shadow; selected = 2 px primary border + primarySoft fill. */
export function StopListItem({
  index,
  stop,
  selected,
  onPress,
  onRetryPhoto,
  onLayout,
}: StopListItemProps) {
  const theme = useTheme();

  return (
    <View
      onLayout={onLayout}
      style={[
        styles.card,
        shadow(theme, 'sm'),
        {
          backgroundColor: selected ? theme.primarySoft : theme.surface,
          borderColor: selected ? theme.primary : 'transparent',
        },
      ]}>
      <Pressable collapsable={false}
        accessibilityRole="button"
        accessibilityLabel={`Stop ${index}: ${stop.name}`}
        accessibilityHint="Shows this stop on the map"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={({ pressed }) => [styles.header, { opacity: pressed ? 0.85 : 1 }]}>
        <View style={[styles.badge, { backgroundColor: theme.primary }]}>
          <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
            {index}
          </ThemedText>
        </View>
        <View style={styles.headerText}>
          <ThemedText type="subheading">{stop.name}</ThemedText>
          {stop.address ? (
            <ThemedText type="caption" themeColor="textMuted" numberOfLines={2}>
              {stop.address}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
      {stop.notes ? (
        <CollapsibleText text={stop.notes} maxChars={140} tone={selected ? 'onSoft' : 'default'} />
      ) : null}
      {stop.photos.length > 0 ? (
        <PhotoStrip photos={stop.photos} stopName={stop.name} onRetryPhoto={onRetryPhoto} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 2,
  },
  header: { flexDirection: 'row', gap: Spacing.three - Spacing.two, minHeight: 44, alignItems: 'flex-start' },
  headerText: { flex: 1, gap: Spacing.half },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
