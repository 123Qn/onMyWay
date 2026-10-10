import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState, type RefObject } from 'react';
import {
  AccessibilityInfo,
  Alert,
  Keyboard,
  LayoutAnimation,
  type TextInput,
} from 'react-native';

import { useFormScroll, type FormScroll } from '@/hooks/use-form-scroll';
import { randomId, randomUuid } from '@/lib/random-id';
import { takePickResult, type PickedLocation } from '@/lib/pick-location-store';
import {
  MAX_PHOTOS_PER_STOP,
  MAX_STOPS,
  applyPathPatch,
  clearPaths,
  isEmptyForm,
  validateForm,
  type CoverValue,
  type FormErrors,
  type PathPatch,
  type PhotoValue,
  type StopValue,
  type TravelMode,
  type TripFormValues,
  type Visibility,
} from '@/lib/trip-form';
import { pickCover, pickStopPhotos } from '@/lib/trip-images';
import { removePaths } from '@/lib/trip-storage';

type Action =
  | { type: 'replace'; form: TripFormValues }
  | { type: 'title'; value: string }
  | { type: 'description'; value: string }
  | { type: 'visibility'; value: Visibility }
  | { type: 'travelMode'; value: TravelMode }
  | { type: 'cover'; cover: CoverValue | null }
  | { type: 'addStop'; stop: StopValue }
  | { type: 'updateStop'; id: string; patch: Partial<Pick<StopValue, 'name' | 'notes'>> }
  | { type: 'location'; id: string; loc: PickedLocation }
  | { type: 'move'; id: string; dir: -1 | 1 }
  | { type: 'deleteStop'; id: string }
  | { type: 'addPhotos'; id: string; photos: PhotoValue[] }
  | { type: 'removePhoto'; id: string; photoId: string }
  | { type: 'paths'; patch: PathPatch }
  | { type: 'clearPaths'; paths: Set<string> };

function reducer(form: TripFormValues, action: Action): TripFormValues {
  switch (action.type) {
    case 'replace':
      return action.form;
    case 'title':
      return { ...form, title: action.value };
    case 'description':
      return { ...form, description: action.value };
    case 'visibility':
      return { ...form, visibility: action.value };
    case 'travelMode':
      return { ...form, travelMode: action.value };
    case 'cover':
      return { ...form, cover: action.cover };
    case 'addStop':
      if (form.stops.length >= MAX_STOPS) return form;
      return { ...form, stops: [...form.stops, action.stop] };
    case 'updateStop':
      return {
        ...form,
        stops: form.stops.map((s) => (s.id === action.id ? { ...s, ...action.patch } : s)),
      };
    case 'location':
      return {
        ...form,
        stops: form.stops.map((s) => {
          if (s.id !== action.id) return s;
          const { loc } = action;
          // Keep a name the user typed; replace an empty or picker-generated one.
          const replaceName = s.name.trim() === '' || s.name === s.autoName;
          return {
            ...s,
            lat: loc.lat,
            lng: loc.lng,
            address: loc.address,
            name: replaceName ? loc.name : s.name,
            autoName: replaceName ? loc.name : s.autoName,
          };
        }),
      };
    case 'move': {
      const i = form.stops.findIndex((s) => s.id === action.id);
      const j = i + action.dir;
      if (i < 0 || j < 0 || j >= form.stops.length) return form;
      const stops = [...form.stops];
      [stops[i], stops[j]] = [stops[j], stops[i]];
      return { ...form, stops };
    }
    case 'deleteStop':
      return { ...form, stops: form.stops.filter((s) => s.id !== action.id) };
    case 'addPhotos':
      return {
        ...form,
        stops: form.stops.map((s) =>
          s.id === action.id
            ? {
                ...s,
                photos: [...s.photos, ...action.photos].slice(0, MAX_PHOTOS_PER_STOP),
              }
            : s,
        ),
      };
    case 'removePhoto':
      return {
        ...form,
        stops: form.stops.map((s) =>
          s.id === action.id
            ? { ...s, photos: s.photos.filter((p) => p.id !== action.photoId) }
            : s,
        ),
      };
    case 'paths':
      return applyPathPatch(form, action.patch);
    case 'clearPaths':
      return clearPaths(form, action.paths);
  }
}

export type PhotoNotice = { message: string; settings: boolean };

type PendingPick = {
  requestId: string;
  target: { kind: 'add' } | { kind: 'change'; stopId: string };
};

export type TripFormActions = {
  setTitle: (value: string) => void;
  setDescription: (value: string) => void;
  setVisibility: (value: Visibility) => void;
  setTravelMode: (value: TravelMode) => void;
  updateStop: (id: string, patch: Partial<Pick<StopValue, 'name' | 'notes'>>) => void;
  addStop: () => void;
  changeLocation: (id: string) => void;
  moveStop: (id: string, dir: -1 | 1) => void;
  deleteStop: (id: string) => void;
  addPhotos: (id: string) => void;
  removePhoto: (id: string, photoId: string) => void;
  pickCover: () => void;
  removeCover: () => void;
  registerInput: (key: string, node: TextInput | null) => void;
};

export type TripFormController = {
  form: TripFormValues;
  /** Always the latest form, including patches applied synchronously by the publish/save pipelines. */
  formRef: RefObject<TripFormValues>;
  isEmpty: boolean;
  /** Null until the first failed submit, then live. */
  errors: FormErrors | null;
  /** Validates, focuses/scrolls to the first problem and announces. True when valid. */
  validate: () => boolean;
  actions: TripFormActions;
  scroll: FormScroll;
  /** Banner about photos (permission, limits, failures). */
  notice: PhotoNotice | null;
  dismissNotice: () => void;
  /** 'cover', a stop id, or null while the picker or compression is running. */
  picking: string | null;
  replaceForm: (form: TripFormValues) => void;
  applyPaths: (patch: PathPatch) => void;
  discardPaths: (paths: string[]) => void;
};

type Options = {
  initial: TripFormValues;
  /** True for storage paths this client uploaded itself (safe to delete when the photo is removed). */
  isOwnUpload: (path: string) => boolean;
  /** Called after an own upload was deleted (so an edit can forget it). */
  onOwnUploadRemoved?: (path: string) => void;
  /** Blocks every change while a save or publish runs. */
  disabled: boolean;
};

function stopHasContent(s: StopValue): boolean {
  return s.name.trim() !== s.autoName.trim() || s.notes.trim() !== '' || s.photos.length > 0;
}

function announce(message: string) {
  AccessibilityInfo.announceForAccessibility(message);
}

export function useTripForm({
  initial,
  isOwnUpload,
  onOwnUploadRemoved,
  disabled,
}: Options): TripFormController {
  const [form, dispatch] = useReducer(reducer, initial);
  const [submitted, setSubmitted] = useState(false);
  const [notice, setNotice] = useState<PhotoNotice | null>(null);
  const [picking, setPicking] = useState<string | null>(null);
  const scroll = useFormScroll();

  const formRef = useRef(form);
  const opts = useRef({ isOwnUpload, onOwnUploadRemoved, disabled });
  const pendingPick = useRef<PendingPick | null>(null);
  const pickingRef = useRef(false);
  const reduceMotion = useRef(false);
  const inputs = useRef(new Map<string, TextInput>());

  useEffect(() => {
    formRef.current = form;
    opts.current = { isOwnUpload, onOwnUploadRemoved, disabled };
  });

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      reduceMotion.current = v;
    });
  }, []);

  // Result of the location picker, read once when this screen regains focus.
  useFocusEffect(
    useCallback(() => {
      const pending = pendingPick.current;
      if (!pending) return;
      pendingPick.current = null;
      const result = takePickResult(pending.requestId);
      if (!result) return;
      if (pending.target.kind === 'add') {
        if (formRef.current.stops.length >= MAX_STOPS) return;
        const id = randomUuid();
        const number = formRef.current.stops.length + 1;
        dispatch({
          type: 'addStop',
          stop: {
            id,
            name: result.name,
            autoName: result.name,
            notes: '',
            lat: result.lat,
            lng: result.lng,
            address: result.address,
            photos: [],
          },
        });
        announce(`Stop ${number} added`);
        setTimeout(() => scroll.scrollToStop(id), 150);
      } else {
        dispatch({ type: 'location', id: pending.target.stopId, loc: result });
      }
    }, [scroll]),
  );

  const removeOwnFile = useCallback((path: string | null) => {
    if (!path || !opts.current.isOwnUpload(path)) return;
    opts.current.onOwnUploadRemoved?.(path);
    void removePaths([path]);
  }, []);

  const actions = useMemo<TripFormActions>(() => {
    const animate = () => {
      if (!reduceMotion.current) LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    };
    const openPicker = (target: PendingPick['target'], extra?: { lat: number; lng: number }) => {
      if (opts.current.disabled) return;
      Keyboard.dismiss();
      const requestId = randomId();
      pendingPick.current = { requestId, target };
      router.push({
        pathname: '/pick-location',
        params: extra
          ? { requestId, lat: String(extra.lat), lng: String(extra.lng) }
          : { requestId },
      });
    };
    const removeStop = (id: string) => {
      const stop = formRef.current.stops.find((s) => s.id === id);
      if (!stop) return;
      stop.photos.forEach((p) => removeOwnFile(p.path));
      animate();
      dispatch({ type: 'deleteStop', id });
      announce('Stop deleted');
    };

    return {
      setTitle: (value) => dispatch({ type: 'title', value }),
      setDescription: (value) => dispatch({ type: 'description', value }),
      setVisibility: (value) => dispatch({ type: 'visibility', value }),
      setTravelMode: (value) => dispatch({ type: 'travelMode', value }),
      updateStop: (id, patch) => dispatch({ type: 'updateStop', id, patch }),
      addStop: () => {
        if (formRef.current.stops.length >= MAX_STOPS) return;
        openPicker({ kind: 'add' });
      },
      changeLocation: (id) => {
        const stop = formRef.current.stops.find((s) => s.id === id);
        if (!stop) return;
        openPicker({ kind: 'change', stopId: id }, { lat: stop.lat, lng: stop.lng });
      },
      moveStop: (id, dir) => {
        if (opts.current.disabled) return;
        const stops = formRef.current.stops;
        const i = stops.findIndex((s) => s.id === id);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= stops.length) return;
        animate();
        dispatch({ type: 'move', id, dir });
        announce(`Stop moved to position ${j + 1} of ${stops.length}`);
        setTimeout(() => scroll.scrollToStop(id), 150);
      },
      deleteStop: (id) => {
        if (opts.current.disabled) return;
        const stop = formRef.current.stops.find((s) => s.id === id);
        if (!stop) return;
        if (!stopHasContent(stop)) {
          removeStop(id);
          return;
        }
        Alert.alert('Delete this stop?', 'Its notes and photos will be removed from this trip.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => removeStop(id) },
        ]);
      },
      addPhotos: (id) => {
        if (opts.current.disabled || pickingRef.current) return;
        const stop = formRef.current.stops.find((s) => s.id === id);
        if (!stop) return;
        const remaining = MAX_PHOTOS_PER_STOP - stop.photos.length;
        if (remaining <= 0) return;
        Keyboard.dismiss();
        setNotice(null);
        pickingRef.current = true;
        setPicking(id);
        void pickStopPhotos(remaining)
          .then((result) => {
            if (result.kind === 'denied') {
              setNotice({ message: 'Allow photo access in Settings to add photos.', settings: true });
              return;
            }
            if (result.kind === 'failed') {
              setNotice({
                message: 'Could not open your photo. Please try another.',
                settings: false,
              });
              return;
            }
            if (result.kind !== 'ok') return;
            if (result.uris.length > 0) {
              dispatch({
                type: 'addPhotos',
                id,
                photos: result.uris.map((uri) => ({ id: randomUuid(), uri, path: null })),
              });
              announce(result.uris.length === 1 ? 'Photo added' : `${result.uris.length} photos added`);
            }
            if (result.uris.length === 0 && result.failed > 0) {
              setNotice({
                message: 'Could not open your photo. Please try another.',
                settings: false,
              });
            } else if (result.failed > 0) {
              setNotice({ message: 'Some photos could not be added.', settings: false });
            } else if (result.truncated) {
              setNotice({
                message: `Only ${result.uris.length} photos were added. A stop can have up to 5.`,
                settings: false,
              });
            }
          })
          .finally(() => {
            pickingRef.current = false;
            setPicking(null);
          });
      },
      removePhoto: (id, photoId) => {
        if (opts.current.disabled) return;
        const photo = formRef.current.stops
          .find((s) => s.id === id)
          ?.photos.find((p) => p.id === photoId);
        if (!photo) return;
        removeOwnFile(photo.path);
        dispatch({ type: 'removePhoto', id, photoId });
        announce('Photo removed');
      },
      pickCover: () => {
        if (opts.current.disabled || pickingRef.current) return;
        Keyboard.dismiss();
        setNotice(null);
        pickingRef.current = true;
        setPicking('cover');
        void pickCover()
          .then((result) => {
            if (result.kind === 'denied') {
              setNotice({ message: 'Allow photo access in Settings to add photos.', settings: true });
            } else if (result.kind === 'failed') {
              setNotice({
                message: 'Could not open your photo. Please try another.',
                settings: false,
              });
            } else if (result.kind === 'ok') {
              removeOwnFile(formRef.current.cover?.path ?? null);
              dispatch({
                type: 'cover',
                cover: { id: randomUuid(), uri: result.uri, path: null },
              });
            }
          })
          .finally(() => {
            pickingRef.current = false;
            setPicking(null);
          });
      },
      removeCover: () => {
        if (opts.current.disabled) return;
        removeOwnFile(formRef.current.cover?.path ?? null);
        dispatch({ type: 'cover', cover: null });
      },
      registerInput: (key, node) => {
        if (node) inputs.current.set(key, node);
        else inputs.current.delete(key);
      },
    };
  }, [scroll, removeOwnFile]);

  const errors = useMemo(() => (submitted ? validateForm(form) : null), [submitted, form]);

  const validate = useCallback(() => {
    setSubmitted(true);
    const result = validateForm(formRef.current);
    if (result.count === 0) return true;
    const first = result.first;
    if (first === 'stops') {
      scroll.scrollToStops();
    } else if (first) {
      if (first.startsWith('name:')) scroll.scrollToStop(first.slice(5));
      else if (first.startsWith('stop:')) scroll.scrollToStop(first.slice(5));
      inputs.current.get(first)?.focus();
    }
    announce(`Fix ${result.count} problems to continue`);
    return false;
  }, [scroll]);

  const replaceForm = useCallback((next: TripFormValues) => {
    formRef.current = next;
    dispatch({ type: 'replace', form: next });
  }, []);

  const applyPaths = useCallback((patch: PathPatch) => {
    formRef.current = applyPathPatch(formRef.current, patch);
    dispatch({ type: 'paths', patch });
  }, []);

  const discardPaths = useCallback((paths: string[]) => {
    const set = new Set(paths);
    formRef.current = clearPaths(formRef.current, set);
    dispatch({ type: 'clearPaths', paths: set });
  }, []);

  const dismissNotice = useCallback(() => setNotice(null), []);

  return {
    form,
    formRef,
    isEmpty: isEmptyForm(form),
    errors,
    validate,
    actions,
    scroll,
    notice,
    dismissNotice,
    picking,
    replaceForm,
    applyPaths,
    discardPaths,
  };
}
