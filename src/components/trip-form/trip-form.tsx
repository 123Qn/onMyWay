import { Linking, StyleSheet, View, type TextInput } from 'react-native';
import { useRef, type ReactNode } from 'react';

import { CoverPicker } from './cover-picker';
import { StopEditorCard } from './stop-editor-card';
import { TravelModePicker } from './travel-mode-picker';
import { VisibilityPicker } from './visibility-picker';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Layout, Spacing } from '@/constants/theme';
import type { FormScroll } from '@/hooks/use-form-scroll';
import type { PhotoNotice, TripFormActions } from '@/hooks/use-trip-form';
import {
  MAX_STOPS,
  TEXT_MAX,
  TITLE_MAX,
  type FormErrors,
  type TripFormValues,
} from '@/lib/trip-form';

export type TripFormProps = {
  mode: 'create' | 'edit';
  form: TripFormValues;
  actions: TripFormActions;
  scroll: FormScroll;
  errors: FormErrors | null;
  /** Signed URLs for photos and the cover that already exist on the server. */
  remoteUrls: Record<string, string>;
  disabled: boolean;
  /** 'cover', a stop id or null. */
  picking: string | null;
  notice: PhotoNotice | null;
  onDismissNotice: () => void;
  /** Save / publish error banner and similar, shown above the form. */
  banner?: ReactNode;
  draftNote?: string | null;
  submit: { label: string; loading: boolean; disabled?: boolean; onPress: () => void };
  onSaveDraft?: () => void;
};

export function TripForm({
  mode,
  form,
  actions,
  scroll,
  errors,
  remoteUrls,
  disabled,
  picking,
  notice,
  onDismissNotice,
  banner,
  draftNote,
  submit,
  onSaveDraft,
}: TripFormProps) {
  const descriptionRef = useRef<TextInput | null>(null);
  const atLimit = form.stops.length >= MAX_STOPS;
  const cover = form.cover;
  const coverUri = cover ? (cover.uri ?? (cover.path ? (remoteUrls[cover.path] ?? null) : null)) : null;

  return (
    <View style={styles.root}>
      {draftNote ? (
        <ThemedText type="caption" themeColor="textMuted">
          {draftNote}
        </ThemedText>
      ) : null}
      {banner}
      {notice ? (
        <ErrorBanner
          message={notice.message}
          onRetry={notice.settings ? () => void Linking.openSettings() : undefined}
          retryLabel="Open settings"
          onDismiss={onDismissNotice}
        />
      ) : null}

      <Card style={styles.card}>
        <View style={styles.cardBody}>
          <CoverPicker
            imageUri={coverUri}
            hasCover={!!cover}
            picking={picking === 'cover'}
            disabled={disabled}
            onPick={actions.pickCover}
            onRemove={actions.removeCover}
          />
          <TextField
            variant="onCard"
            ref={(node) => actions.registerInput('title', node)}
            label="Trip title"
            value={form.title}
            onChangeText={actions.setTitle}
            error={errors?.title ?? null}
            editable={!disabled}
            maxLength={TITLE_MAX}
            showCounter
            autoCapitalize="sentences"
            returnKeyType="next"
            onSubmitEditing={() => descriptionRef.current?.focus()}
          />
          <TextField
            variant="onCard"
            ref={(node) => {
              descriptionRef.current = node;
              actions.registerInput('description', node);
            }}
            label="Description (optional)"
            value={form.description}
            onChangeText={actions.setDescription}
            helperText="What is this trip about?"
            editable={!disabled}
            multiline
            maxLength={TEXT_MAX}
            showCounter
            autoCapitalize="sentences"
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <View style={styles.cardBody}>
          <VisibilityPicker value={form.visibility} disabled={disabled} onChange={actions.setVisibility} />
          <TravelModePicker value={form.travelMode} disabled={disabled} onChange={actions.setTravelMode} />
        </View>
      </Card>

      <View
        style={styles.section}
        onLayout={(e) => scroll.onStopsSectionLayout(e.nativeEvent.layout.y)}>
        <View style={styles.stopsHeader}>
          <ThemedText type="heading" accessibilityRole="header">
            Stops
          </ThemedText>
          <ThemedText type="caption" themeColor="textMuted">
            {`${form.stops.length} of ${MAX_STOPS}`}
          </ThemedText>
        </View>

        {form.stops.length === 0 ? (
          <Card>
            <View style={styles.emptyStops}>
              <Icon name="map" size={Layout.iconSize.xl} color="textMuted" />
              <ThemedText type="subheading">No stops yet</ThemedText>
              <ThemedText themeColor="textMuted" style={styles.center}>
                Add the places you will visit, in order.
              </ThemedText>
              <Button title="Add the first stop" disabled={disabled} onPress={actions.addStop} />
            </View>
          </Card>
        ) : (
          <View
            style={styles.cards}
            onLayout={(e) => scroll.onCardsLayout(e.nativeEvent.layout.y)}>
            {form.stops.map((stop, i) => (
              <StopEditorCard
                key={stop.id}
                stop={stop}
                index={i}
                count={form.stops.length}
                nameError={errors?.stopErrors[stop.id]?.name ?? null}
                remoteUrls={remoteUrls}
                disabled={disabled}
                picking={picking === stop.id}
                onChange={actions.updateStop}
                onMove={actions.moveStop}
                onDelete={actions.deleteStop}
                onChangeLocation={actions.changeLocation}
                onAddPhotos={actions.addPhotos}
                onRemovePhoto={actions.removePhoto}
                onLayout={scroll.onCardLayout}
                registerInput={actions.registerInput}
              />
            ))}
          </View>
        )}

        {form.stops.length > 0 ? (
          <>
            <Button
              title="Add stop"
              variant="secondary"
              icon="plus"
              fullWidth
              disabled={disabled || atLimit}
              onPress={actions.addStop}
            />
            {atLimit ? (
              <ThemedText type="caption" themeColor="textMuted">
                {"You've reached the limit of 20 stops."}
              </ThemedText>
            ) : null}
          </>
        ) : null}

        {errors?.stops ? (
          <View style={styles.inlineError} accessibilityRole="alert" accessibilityLiveRegion="polite">
            <Icon name="alert" size={Layout.iconSize.sm} color="danger" />
            <ThemedText type="caption" themeColor="danger" style={styles.flex}>
              {errors.stops}
            </ThemedText>
          </View>
        ) : null}
      </View>

      <View style={styles.bottom}>
        <Button
          title={submit.label}
          size="lg"
          fullWidth
          loading={submit.loading}
          disabled={disabled || !!submit.disabled}
          onPress={submit.onPress}
        />
        {mode === 'create' && onSaveDraft ? (
          <Button
            title="Save draft and close"
            variant="ghost"
            size="sm"
            disabled={disabled}
            onPress={onSaveDraft}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.four },
  section: { gap: Spacing.three },
  card: { width: '100%' },
  cardBody: { gap: Spacing.three },
  stopsHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  cards: { gap: Spacing.three },
  emptyStops: { alignItems: 'center', gap: Spacing.two, paddingVertical: Spacing.three },
  center: { textAlign: 'center' },
  flex: { flex: 1 },
  inlineError: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  bottom: { alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.six },
});
