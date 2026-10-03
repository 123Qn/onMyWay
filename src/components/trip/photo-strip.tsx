import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { Icon } from '@/components/ui/icon';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type StripPhoto = { id: string; path: string; url: string | null };

export type PhotoStripProps = {
  photos: StripPhoto[];
  stopName: string;
  /** Called at most once per photo when its image fails to load (parent re-signs the URL). */
  onRetryPhoto?: (path: string) => void;
};

const TILE = 120;

export function PhotoStrip({ photos, stopName, onRetryPhoto }: PhotoStripProps) {
  const theme = useTheme();
  const retried = useRef(new Set<string>());
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const handleError = (path: string) => {
    if (retried.current.has(path)) return;
    retried.current.add(path);
    onRetryPhoto?.(path);
  };

  return (
    <>
      <FlatList
        horizontal
        data={photos}
        keyExtractor={(p) => p.id}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.strip}
        renderItem={({ item, index }) => (
          <Pressable
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
                transition={150}
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

type PhotoViewerProps = {
  photos: StripPhoto[];
  /** Null = closed. */
  startIndex: number | null;
  onClose: () => void;
  onRetryPhoto: (path: string) => void;
};

function PhotoViewer({ photos, startIndex, onClose, onRetryPhoto }: PhotoViewerProps) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const visible = startIndex !== null;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
      onShow={() => setPage(startIndex ?? 0)}>
      <View style={styles.viewer}>
        {visible ? (
          <FlatList
            horizontal
            pagingEnabled
            data={photos}
            keyExtractor={(p) => p.id}
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={startIndex ?? 0}
            getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
            onMomentumScrollEnd={(e) =>
              setPage(Math.round(e.nativeEvent.contentOffset.x / width))
            }
            renderItem={({ item }) => (
              <View style={{ width }}>
                {item.url ? (
                  <Image
                    source={{ uri: item.url, cacheKey: item.path }}
                    style={StyleSheet.absoluteFill}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    accessible={false}
                    onError={() => onRetryPhoto(item.path)}
                  />
                ) : (
                  <View style={styles.center}>
                    <Icon name="image" size={Layout.iconSize.xl} color="onImage" />
                  </View>
                )}
              </View>
            )}
          />
        ) : null}
        <View style={[styles.viewerTop, { paddingTop: insets.top + Spacing.two }]}>
          <ThemedText type="caption" themeColor="onImage">
            {`${page + 1} / ${photos.length}`}
          </ThemedText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo viewer"
            onPress={onClose}
            style={styles.close}>
            <Icon name="close" size={Layout.iconSize.md} color="onImage" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  strip: { gap: Spacing.two },
  tile: { width: TILE, height: TILE, borderRadius: Radius.md, overflow: 'hidden' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  viewer: { flex: 1, backgroundColor: '#000000' },
  viewerTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
  },
  close: {
    width: Layout.minTouchTarget,
    height: Layout.minTouchTarget,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
});
