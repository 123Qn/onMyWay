import { useNavigation } from 'expo-router';
import { useEffect, useRef, type RefObject } from 'react';

type Options = {
  /** True when leaving needs a decision (unsaved changes). Read at removal time. */
  shouldGuard: () => boolean;
  /** Shows the prompt; call `proceed` to let the original navigation action through. */
  onGuard: (proceed: () => void) => void;
};

export type UnsavedGuard = {
  /** Set before a deliberate router.back()/replace so the guard lets it through. */
  leavingRef: RefObject<boolean>;
  /** While true (saving/publishing) every removal is blocked. */
  busyRef: RefObject<boolean>;
};

/** `beforeRemove` guard shared by the create and edit screens. */
export function useUnsavedGuard(options: Options): UnsavedGuard {
  const navigation = useNavigation();
  const leavingRef = useRef(false);
  const busyRef = useRef(false);
  const latest = useRef(options);

  useEffect(() => {
    latest.current = options;
  });

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (leavingRef.current) return;
      if (busyRef.current) {
        e.preventDefault();
        return;
      }
      if (!latest.current.shouldGuard()) return;
      e.preventDefault();
      latest.current.onGuard(() => {
        leavingRef.current = true;
        navigation.dispatch(e.data.action);
      });
    });
  }, [navigation]);

  return { leavingRef, busyRef };
}
