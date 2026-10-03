import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MAX_PHOTOS_PER_STOP, type PhotoValue } from '@/lib/trip-form';

const TILE = 96;

export type StopPhotoStripProps = {
  photos: PhotoValue[];
  stopId: string;
  stopNumber: number;
  stopName: string;
  /** Signed URLs of photos that already exist on the server (by storage path). */
  remoteUrls: Record<string, string>;
  picking: boolean;
  disabled: boolean;
  onAdd: (stopId: string) => void;
  onRemove: (stopId: string, photoId: string) => void;
};

export function StopPhotoStrip({
  photos,
  stopId,
  stopNumber,
  stopName,
  remoteUrls,
  picking,
  disabled,
  onAdd,
  onRemove,
}: StopPhotoStripProps) {
  const theme = useTheme();
  const [broken, setBroken] = useState<Record<string, true>>({});
  const remaining = MAX_PHOTOS_PER_STOP - photos.length;
  const label = stopName.trim() || `stop ${stopNumber}`;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.row}>
      {photos.map((p, i) => {
        const uri = p.uri ?? (p.path ? (remoteUrls[p.path] ?? null) : null);
        const isBroken = !!broken[p.id];
        return (
          <View key={p.id} style={styles.tileWrap}>
            <View
              accessible
              accessibilityRole="image"
              accessibilityLabel={`Photo ${i + 1} of ${photos.length} for ${label}`}
              style={[
                styles.tile,
                { backgroundColor: theme.surface },
                isBroken && { borderWidth: 2, borderColor: theme.danger },
              ]}>
              {isBroken ? (
                <View style={styles.center}>
                  <Icon name="image" size={24} color="textMuted" />
                  <ThemedText type="caption" themeColor="textMuted">
                    Unavailable
                  </ThemedText>
                </View>
              ) : uri ? (
                <Image
                  source={{ uri, cacheKey: p.path ?? undefined }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  accessible={false}
                  onError={() => setBroken((b) => ({ ...b, [p.id]: true }))}
                />
              ) : null}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove photo ${i + 1}`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => onRemove(stopId, p.id)}
              style={styles.close}>
              <View style={[styles.closeGlyph, { backgroundColor: theme.overlay }]}>
                <Icon name="close" size={14} color="#FFFFFF" />
              </View>
            </Pressable>
          </View>
        );
      })}
      {picking ? (
        <View style={[styles.tile, styles.center, { backgroundColor: theme.surface }]}>
          <ActivityIndicator />
        </View>
      ) : remaining > 0 ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Add photo to stop ${stopNumber}`}
          accessibilityHint={`You can add ${remaining} more`}
          accessibilityState={{ disabled }}
          disabled={disabled}
          onPress={() => onAdd(stopId)}
          style={[
            styles.tile,
            styles.center,
            { borderWidth: 2, borderStyle: 'dashed', borderColor: theme.borderStrong },
          ]}>
          <Icon name="plus" size={24} color="primary" />
          <ThemedText type="caption" themeColor="textMuted">
            Add photo
          </ThemedText>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: Spacing.two, paddingTop: Spacing.one },
  tileWrap: { width: TILE, height: TILE },
  tile: {
    width: TILE,
    height: TILE,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: Spacing.one },
  // 44 px hit area sitting over the top-right corner; the visible glyph is 24 px.
  close: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeGlyph: {
    width: 24,
    height: 24,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
