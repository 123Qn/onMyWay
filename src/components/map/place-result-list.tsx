import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Layout, Radius, Spacing } from '@/constants/theme';
import type { PlaceSearchStatus } from '@/hooks/use-place-search';
import { useTheme } from '@/hooks/use-theme';
import type { PlaceResult } from '@/lib/nominatim';

export type PlaceResultListProps = {
  status: Exclude<PlaceSearchStatus, 'idle'>;
  results: PlaceResult[];
  onSelect: (result: PlaceResult) => void;
  onRetry: () => void;
  /** Highlights the chosen row (used on web, where there is no pin). */
  selectedKey?: string | null;
};

export const placeKey = (r: PlaceResult) => `${r.lat},${r.lng}`;

const RETRY_LOCK_MS = 5000;

/** Ghost retry button that stays disabled for a few seconds after mounting (busy server). */
function RetryButton({ lockMs, onPress }: { lockMs: number; onPress: () => void }) {
  const [locked, setLocked] = useState(lockMs > 0);

  useEffect(() => {
    if (lockMs <= 0) return;
    const timer = setTimeout(() => setLocked(false), lockMs);
    return () => clearTimeout(timer);
  }, [lockMs]);

  return <Button title="Try again" variant="ghost" size="sm" disabled={locked} onPress={onPress} />;
}

export function PlaceResultList({
  status,
  results,
  onSelect,
  onRetry,
  selectedKey = null,
}: PlaceResultListProps) {
  const theme = useTheme();
  if (status === 'loading') {
    return (
      <View accessibilityRole="progressbar" accessibilityLabel="Searching" style={styles.status}>
        <ActivityIndicator color={theme.primary} />
        <ThemedText themeColor="textMuted">Searching...</ThemedText>
      </View>
    );
  }

  if (status === 'empty') {
    return (
      <View accessibilityLiveRegion="polite" style={styles.status}>
        <Icon name="search" size={Layout.iconSize.lg} color="textMuted" />
        <View style={styles.statusText}>
          <ThemedText type="bodyStrong">No places found</ThemedText>
          <ThemedText type="caption" themeColor="textMuted">
            Try a different name, or move the map to place the pin yourself.
          </ThemedText>
        </View>
      </View>
    );
  }

  if (status === 'error' || status === 'rate_limited') {
    const busy = status === 'rate_limited';
    return (
      <View accessibilityLiveRegion="polite" style={styles.status}>
        <Icon name="alert" size={Layout.iconSize.lg} color="danger" />
        <View style={styles.statusText}>
          <ThemedText>
            {busy
              ? 'Search is busy right now. Wait a moment and try again.'
              : 'Could not search. Check your connection.'}
          </ThemedText>
        </View>
        <RetryButton lockMs={busy ? RETRY_LOCK_MS : 0} onPress={onRetry} />
      </View>
    );
  }

  return (
    <FlatList
      data={results}
      keyExtractor={placeKey}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item, index }) => {
        const selected = selectedKey === placeKey(item);
        return (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${item.address}`}
            accessibilityHint="Moves the pin to this place"
            accessibilityState={{ selected }}
            onPress={() => onSelect(item)}
            style={({ pressed }) => [
              styles.row,
              index > 0 && { borderTopWidth: 1, borderTopColor: theme.border },
              selected && {
                backgroundColor: theme.primarySoft,
                borderWidth: 2,
                borderColor: theme.primary,
                borderRadius: Radius.md,
              },
              pressed && { backgroundColor: theme.backgroundSelected },
            ]}>
            <Icon name="pin" size={Layout.iconSize.md} color="textMuted" />
            <View style={styles.rowText}>
              <ThemedText type="small" numberOfLines={1} style={styles.name}>
                {item.name}
              </ThemedText>
              <ThemedText type="caption" themeColor="textMuted" numberOfLines={2}>
                {item.address}
              </ThemedText>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
    minHeight: 56,
  },
  statusText: { flex: 1, gap: Spacing.half },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 56,
  },
  rowText: { flex: 1 },
  name: { fontWeight: '600' },
});
