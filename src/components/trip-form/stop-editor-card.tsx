import { memo, useCallback, useRef } from 'react';
import { Pressable, StyleSheet, View, type TextInput } from 'react-native';

import { StopPhotoStrip } from './stop-photo-strip';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { IconButton } from '@/components/ui/icon-button';
import { TextField } from '@/components/ui/text-field';
import { FontFamily, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  MAX_PHOTOS_PER_STOP,
  STOP_NAME_MAX,
  TEXT_MAX,
  type StopValue,
} from '@/lib/trip-form';

export type StopEditorCardProps = {
  stop: StopValue;
  /** 0-based position. */
  index: number;
  count: number;
  nameError: string | null;
  remoteUrls: Record<string, string>;
  disabled: boolean;
  picking: boolean;
  onChange: (id: string, patch: Partial<Pick<StopValue, 'name' | 'notes'>>) => void;
  onMove: (id: string, dir: -1 | 1) => void;
  onDelete: (id: string) => void;
  onChangeLocation: (id: string) => void;
  onAddPhotos: (id: string) => void;
  onRemovePhoto: (id: string, photoId: string) => void;
  onLayout: (id: string, y: number) => void;
  registerInput: (key: string, node: TextInput | null) => void;
};

const BADGE = 32;

function StopEditorCardImpl({
  stop,
  index,
  count,
  nameError,
  remoteUrls,
  disabled,
  picking,
  onChange,
  onMove,
  onDelete,
  onChangeLocation,
  onAddPhotos,
  onRemovePhoto,
  onLayout,
  registerInput,
}: StopEditorCardProps) {
  const theme = useTheme();
  const notesRef = useRef<TextInput | null>(null);
  const number = index + 1;
  const { id } = stop;

  const setNameRef = useCallback(
    (node: TextInput | null) => registerInput(`name:${id}`, node),
    [registerInput, id],
  );
  const setNotesRef = useCallback(
    (node: TextInput | null) => {
      notesRef.current = node;
      registerInput(`notes:${id}`, node);
    },
    [registerInput, id],
  );

  const where =
    stop.address && stop.address.trim()
      ? stop.address
      : `${stop.lat.toFixed(5)}, ${stop.lng.toFixed(5)}`;

  return (
    <View onLayout={(e) => onLayout(id, e.nativeEvent.layout.y)}>
      <Card elevation="sm">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={[styles.badge, { backgroundColor: theme.primary }]}>
              <ThemedText type="smallBold" style={{ color: theme.onPrimary }}>
                {number}
              </ThemedText>
            </View>
            <ThemedText type="subheading" accessibilityRole="header" style={styles.title}>
              {`Stop ${number}`}
            </ThemedText>
            <IconButton
              icon="arrow-up"
              accessibilityLabel={`Move stop ${number} up`}
              disabled={disabled || index === 0}
              onPress={() => onMove(id, -1)}
            />
            <IconButton
              icon="arrow-down"
              accessibilityLabel={`Move stop ${number} down`}
              disabled={disabled || index === count - 1}
              onPress={() => onMove(id, 1)}
            />
            <IconButton
              icon="trash"
              color="danger"
              accessibilityLabel={`Delete stop ${number}`}
              disabled={disabled}
              onPress={() => onDelete(id)}
            />
          </View>

          <TextField
            variant="onCard"
            ref={setNameRef}
            label="Stop name"
            value={stop.name}
            onChangeText={(name) => onChange(id, { name })}
            error={nameError}
            editable={!disabled}
            maxLength={STOP_NAME_MAX}
            showCounter={stop.name.length >= 100}
            autoCapitalize="words"
            returnKeyType="next"
            onSubmitEditing={() => notesRef.current?.focus()}
          />

          <View style={styles.locationRow}>
            <Pressable collapsable={false}
              accessibilityRole="button"
              accessibilityLabel={`Location: ${where}. Change location`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => onChangeLocation(id)}
              style={styles.locationText}>
              <Icon name="pin" size={20} color="primary" />
              <ThemedText numberOfLines={2} style={styles.flex}>
                {where}
              </ThemedText>
            </Pressable>
            <Button
              title="Change location"
              variant="ghost"
              size="sm"
              disabled={disabled}
              onPress={() => onChangeLocation(id)}
            />
          </View>

          <TextField
            variant="onCard"
            ref={setNotesRef}
            label="Notes (optional)"
            value={stop.notes}
            onChangeText={(notes) => onChange(id, { notes })}
            editable={!disabled}
            multiline
            maxLength={TEXT_MAX}
            showCounter={stop.notes.length >= 4500}
            autoCapitalize="sentences"
          />

          <View style={styles.photos}>
            <View style={styles.photosHeader}>
              <ThemedText type="small" style={styles.photosLabel}>
                Photos
              </ThemedText>
              <ThemedText type="caption" themeColor="textMuted">
                {`${stop.photos.length}/${MAX_PHOTOS_PER_STOP}`}
              </ThemedText>
            </View>
            <StopPhotoStrip
              photos={stop.photos}
              stopId={id}
              stopNumber={number}
              stopName={stop.name}
              remoteUrls={remoteUrls}
              picking={picking}
              disabled={disabled}
              onAdd={onAddPhotos}
              onRemove={onRemovePhoto}
            />
          </View>
        </View>
      </Card>
    </View>
  );
}

export const StopEditorCard = memo(StopEditorCardImpl);

const styles = StyleSheet.create({
  card: { gap: Spacing.three },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one, flexWrap: 'wrap' },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, minWidth: 80, marginLeft: Spacing.one },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  locationText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 56,
  },
  flex: { flex: 1 },
  photos: { gap: Spacing.one },
  photosHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  photosLabel: { fontFamily: FontFamily.semibold },
});
