import { Stack, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, Keyboard, StyleSheet, View } from 'react-native';

import { FormSkeleton } from '@/components/trip-form/form-skeleton';
import {
  PublishProgress,
  type PublishFailure,
} from '@/components/trip-form/publish-progress';
import { TripForm } from '@/components/trip-form/trip-form';
import { ErrorBanner } from '@/components/ui/error-banner';
import { HeaderTextButton } from '@/components/ui/header-text-button';
import { Screen } from '@/components/ui/screen';
import { useTripDraft } from '@/hooks/use-trip-draft';
import { useTripForm } from '@/hooks/use-trip-form';
import { useUnsavedGuard } from '@/hooks/use-unsaved-guard';
import { formatRelativeLong } from '@/lib/format-date';
import { randomUuid } from '@/lib/random-id';
import { clearDraft, type TripDraft } from '@/lib/trip-drafts';
import { TRIP_ERROR_COPY, isRetryable, tripErrorMessage } from '@/lib/trip-errors';
import { emitTripEvent } from '@/lib/trip-events';
import { emptyForm, isEmptyForm, pendingUploads } from '@/lib/trip-form';
import {
  discardPublishedTrip,
  publishTrip,
  type PublishProgress as Progress,
} from '@/lib/trip-publish';
import { useSession } from '@/providers/session-provider';

type Banner = { message: string; retry?: () => void };
type Overlay = 'publish' | 'discard' | null;

const PARTIAL_NOTICE =
  'This trip was partly published and is still private. Publish to finish, or discard it.';

const NO_URLS: Record<string, string> = {};

export default function NewTripScreen() {
  const { session } = useSession();
  const userId = session?.user.id ?? null;

  const [tripId, setTripId] = useState<string | null>(null);
  const tripIdRef = useRef<string | null>(null);
  const [decided, setDecided] = useState(false);
  const resolvedRef = useRef(false);
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [photoProgress, setPhotoProgress] = useState<{ done: number; total: number } | null>(null);
  const [failure, setFailure] = useState<PublishFailure | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const publishingRef = useRef(false);
  const promptedRef = useRef(false);

  const controller = useTripForm({
    initial: emptyForm(),
    // Everything with a path in a draft was uploaded by this client for this trip.
    isOwnUpload: () => true,
    disabled: overlay !== null,
  });
  const { form, formRef } = controller;

  // Ready once the stored draft was read and either none exists or the user chose what to do.
  const draft = useTripDraft(userId, form, tripId, decided, overlay === 'discard');
  const resolved = draft.ready;
  const draftLoaded = draft.loaded;
  const draftValue = draft.draft;
  useEffect(() => {
    resolvedRef.current = resolved;
  }, [resolved]);

  const guard = useUnsavedGuard({
    shouldGuard: () => {
      if (!resolvedRef.current) return false;
      if (!isEmptyForm(formRef.current) || tripIdRef.current !== null) return true;
      // Nothing worth keeping: make sure no stale draft survives (the debounce may not have run).
      void draft.clear();
      return false;
    },
    onGuard: (proceed) => {
      Alert.alert('Save this trip as a draft?', 'You can finish it later.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: () => void discardAndLeave(proceed) },
        {
          text: 'Save draft',
          onPress: () => {
            void draft.flush().then(proceed);
          },
        },
      ]);
    },
  });
  const { leavingRef, busyRef } = guard;

  const running = overlay !== null && !failure;
  useEffect(() => {
    busyRef.current = running;
  }, [busyRef, running]);

  // Android back: blocked while running, "Back to editing" in the failure state.
  useEffect(() => {
    if (overlay === null) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (failure && overlay === 'publish') setOverlay(null);
      return true;
    });
    return () => sub.remove();
  }, [overlay, failure]);

  const setTrip = useCallback((id: string | null) => {
    tripIdRef.current = id;
    setTripId(id);
  }, []);

  const finishResolve = useCallback(() => {
    resolvedRef.current = true;
    setDecided(true);
  }, []);

  /** Deletes the half-published trip (files, then row). Resolves true when nothing is left. */
  const discardTrip = useCallback(async (): Promise<boolean> => {
    const id = tripIdRef.current;
    if (!id || !userId) return true;
    return discardPublishedTrip(userId, id);
  }, [userId]);

  const discardAndLeave = async (proceed: () => void) => {
    setBanner(null);
    if (tripIdRef.current) setOverlay('discard');
    const ok = await discardTrip();
    setOverlay(null);
    if (ok) {
      await draft.clear();
      proceed();
    } else {
      setBanner({
        message: TRIP_ERROR_COPY.discard,
        retry: () => void discardAndLeave(proceed),
      });
    }
  };

  const resume = useCallback(
    (d: TripDraft) => {
      controller.replaceForm(d.form);
      setTrip(d.tripId);
      finishResolve();
    },
    [controller, setTrip, finishResolve],
  );

  // Draft restore: one prompt after the first read.
  useEffect(() => {
    if (!draftLoaded || promptedRef.current || !userId) return;
    promptedRef.current = true;
    const d = draftValue;
    if (!d) return; // `resolved` is derived: no draft means a fresh form.
    if (isEmptyForm(d.form) && d.tripId === null) {
      void clearDraft(userId).then(finishResolve);
      return;
    }
    const title = d.form.title.trim();
    const message =
      `You have an unfinished trip${title ? ` "${title}"` : ''}, saved ${formatRelativeLong(d.savedAt)}.` +
      (d.tripId ? ' It was partly published.' : '');
    Alert.alert(
      'Resume your draft?',
      message,
      [
        {
          text: 'Discard draft',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              if (d.tripId) {
                setOverlay('discard');
                const ok = await discardPublishedTrip(userId, d.tripId);
                setOverlay(null);
                if (!ok) {
                  // Keep the draft so nothing is lost; the user can retry from the banner.
                  resume(d);
                  setBanner({
                    message: TRIP_ERROR_COPY.discard,
                    retry: () =>
                      void discardAndLeave(() => {
                        leavingRef.current = true;
                        router.back();
                      }),
                  });
                  return;
                }
              }
              await clearDraft(userId);
              finishResolve();
            })();
          },
        },
        { text: 'Resume', onPress: () => resume(d) },
      ],
      { cancelable: false },
    );
    // discardAndLeave is recreated each render; the prompt only runs once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftLoaded, draftValue, userId, finishResolve, resume]);

  const runPublish = async () => {
    if (!userId || publishingRef.current || !resolved) return;
    Keyboard.dismiss();
    if (!controller.validate()) return;
    publishingRef.current = true;
    setBanner(null);
    setFailure(null);
    setProgress({ step: 'trip', done: 0, total: 0 });
    setOverlay('publish');

    let id = tripIdRef.current;
    if (!id) {
      id = randomUuid();
      setTrip(id);
    }
    // The tripId must be on disk before the insert so a crash can still find the row.
    await draft.persistNow(formRef.current, id);

    const pending = pendingUploads(formRef.current).length;
    setPhotoProgress(pending > 0 ? { done: 0, total: pending } : null);
    const tripToPublish = id;
    const result = await publishTrip({
      userId,
      tripId: tripToPublish,
      form: formRef.current,
      onProgress: (p) => {
        setProgress(p);
        if (p.step === 'photos') setPhotoProgress({ done: p.done, total: p.total });
      },
      onFormPatch: (patch) => {
        controller.applyPaths(patch);
        void draft.persistNow(formRef.current, tripToPublish);
      },
    });
    publishingRef.current = false;

    if (result.ok) {
      await draft.clear();
      leavingRef.current = true;
      emitTripEvent({ type: 'created', id: tripToPublish });
      router.replace(`/trip/${tripToPublish}`);
      return;
    }
    setFailure({
      step: result.step,
      message: tripErrorMessage(result.kind, result.step === 'photos'),
      canRetry: isRetryable(result.kind),
    });
  };

  const confirmDiscardPublished = () => {
    Alert.alert(
      'Discard this trip?',
      'This deletes the partly published trip and its uploaded photos from your account.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            const previous = failure;
            void (async () => {
              setOverlay('discard');
              const ok = await discardTrip();
              if (ok) {
                await draft.clear();
                leavingRef.current = true;
                router.back();
              } else {
                setOverlay('publish');
                setFailure({
                  step: previous?.step ?? 'trip',
                  message: TRIP_ERROR_COPY.discard,
                  canRetry: false,
                });
              }
            })();
          },
        },
      ],
    );
  };

  const saveDraftAndClose = async () => {
    await draft.flush();
    leavingRef.current = true;
    router.back();
  };

  const busy = overlay !== null;
  const showPartial = tripId !== null && !banner;

  const header = (
    <Stack.Screen
      options={{
        gestureEnabled: false,
        headerLeft: () => (
          <HeaderTextButton label="Cancel" disabled={busy} onPress={() => router.back()} />
        ),
        headerRight: () => (
          <HeaderTextButton
            label="Publish"
            bold
            loading={running && overlay === 'publish'}
            disabled={busy || !resolved}
            onPress={() => void runPublish()}
          />
        ),
      }}
    />
  );

  if (!resolved) {
    return (
      <Screen scroll edges={['left', 'right', 'bottom']}>
        {header}
        <FormSkeleton variant="create" />
      </Screen>
    );
  }

  return (
    <View style={styles.flex}>
      {header}
      <Screen scroll scrollRef={controller.scroll.scrollRef} edges={['left', 'right', 'bottom']}>
        <TripForm
          mode="create"
          form={form}
          actions={controller.actions}
          scroll={controller.scroll}
          errors={controller.errors}
          remoteUrls={NO_URLS}
          disabled={busy}
          picking={controller.picking}
          notice={controller.notice}
          onDismissNotice={controller.dismissNotice}
          draftNote={draft.saved ? 'Draft saved on this device' : null}
          banner={
            banner ? (
              <ErrorBanner message={banner.message} onRetry={banner.retry} />
            ) : showPartial ? (
              <ErrorBanner message={PARTIAL_NOTICE} />
            ) : null
          }
          submit={{
            label: 'Publish trip',
            loading: running && overlay === 'publish',
            onPress: () => void runPublish(),
          }}
          onSaveDraft={() => void saveDraftAndClose()}
        />
      </Screen>
      {overlay === 'discard' ? (
        <PublishProgress variant="discard" />
      ) : overlay === 'publish' ? (
        <PublishProgress
          variant="publish"
          progress={progress}
          photos={photoProgress}
          failure={failure}
          onRetry={() => void runPublish()}
          onBack={() => {
            setOverlay(null);
            setFailure(null);
          }}
          onDiscard={confirmDiscardPublished}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
});
