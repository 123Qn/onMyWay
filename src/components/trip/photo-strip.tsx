import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';

import { PhotoViewer, type StripPhoto } from './photo-viewer';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type { StripPhoto } from './photo-viewer';

export type PhotoStripProps = {
  photos: StripPhoto[];
  stopName: string;
  /** Called at most once per photo when its image fails to load (parent re-signs the URL). */
  onRetryPhoto?: (path: string) => void;
};

const TILE = 120;
const TRIP_TILE_W = 120;
const TRIP_TILE_H = 150;
const MAX_TRIP_TILES = 12;

function useRetryOnce(onRetryPhoto?: (path: string) => void) {
  const retried = useRef(new Set<string>());
  return (path: string) => {
    if (retried.current.has(path)) return;
    retried.current.add(path);
    onRetryPhoto?.(path);
  };
}

/** Per-stop strip of square thumbnails (inside a stop card). */
export function PhotoStrip({ photos, stopName, onRetryPhoto }: PhotoStripProps) {
  const theme = useTheme();
  const handleError = useRetryOnce(onRetryPhoto);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  return (
    <>
      <FlatList
        horizontal
        data={photos}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        renderItem={({ item, index }) => (
          <Pressable collapsable={false}
            accessibilityRole="button"
            accessibilityLabel={`Photo ${index + 1} of ${photos.length} from ${stopName}`}
            onPress={() => setViewerIndex(index)}
            style={({ pressed }) => [
              styles.tile,
              { backgroundColor: theme.primarySoft, opacity: pressed ? 0.85 : 1 },
            ]}>
            {item.url ? (
              <Image
                source={{ uri: item.url, cacheKey: item.path }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                accessible={false}
                onError={() => handleError(item.path)}
              />
            ) : (
              <View style={styles.center}>
                <Icon name="image" size={Layout.iconSize.xl} color="primary" />
              </View>
            )}
          </Pressable>
        )}
      />
      <PhotoViewer
        photos={photos}
        startIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onRetryPhoto={handleError}
      />
    </>
  );
}

export type TripPhoto = StripPhoto & { stopName: string };

export type TripPhotoStripProps = {
  /** Ordered by stop, then position. */
  photos: TripPhoto[];
  onRetryPhoto?: (path: string) => void;
};

/**
 * Trip-level horizontal strip: up to 12 tiles, then a 13th "+N" tile. Every tile (including "+N")
 * opens the shared viewer over ALL photos.
 */
export function TripPhotoStrip({ photos, onRetryPhoto }: TripPhotoStripProps) {
  const theme = useTheme();
  const handleError = useRetryOnce(onRetryPhoto);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const extra = photos.length - MAX_TRIP_TILES;
  // The 13th tile is the first hidden photo with a "+N" overlay (N = photos not shown as plain tiles).
  const shown = extra > 0 ? photos.slice(0, MAX_TRIP_TILES + 1) : photos;

  return (
    <>
      <FlatList
        horizontal
        data={shown}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tripStrip}
        renderItem={({ item, index }) => {
          const showMore = extra > 0 && index === MAX_TRIP_TILES;
          return (
            <Pressable collapsable={false}
              accessibilityRole="button"
              accessibilityLabel={
                showMore
                  ? `Photo ${index + 1} of ${photos.length} from ${item.stopName}. ${extra} more photos. Opens the photo viewer`
                  : `Photo ${index + 1} of ${photos.length} from ${item.stopName}`
              }
              onPress={() => setViewerIndex(index)}
              style={({ pressed }) => [
                styles.tripTile,
                { backgroundColor: theme.primarySoft, opacity: pressed ? 0.9 : 1 },
              ]}>
              {item.url ? (
                <Image
                  source={{ uri: item.url, cacheKey: item.path }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                  cachePolicy="memory-disk"
                  accessible={false}
                  onError={() => handleError(item.path)}
                />
              ) : (
                <View style={styles.center}>
                  <Icon name="image" size={Layout.iconSize.xl} color="primary" />
                </View>
              )}
              {showMore ? (
                <View
                  style={[styles.moreOverlay, { backgroundColor: theme.scrimChip }]}
                  importantForAccessibility="no-hide-descendants">
                  <ThemedText type="bodyStrong" themeColor="onImage" maxFontSizeMultiplier={1.3}>
                    {`+${extra}`}
                  </ThemedText>
                </View>
              ) : null}
            </Pressable>
          );
        }}
      />
      <PhotoViewer
        photos={photos}
        startIndex={viewerIndex}
        onClose={() => setViewerIndex(null)}
        onRetryPhoto={handleError}
      />
    </>
  );
}

const styles = StyleSheet.create({
  strip: { gap: Spacing.two },
  tripStrip: { gap: Spacing.three - Spacing.one, paddingHorizontal: Spacing.three },
  tile: { width: TILE, height: TILE, borderRadius: Radius.md, overflow: 'hidden' },
  tripTile: {
    width: TRIP_TILE_W,
    height: TRIP_TILE_H,
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  moreOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
