import { useCallback, useEffect, useState } from 'react';

import { supabase } from '@/lib/supabase';
import { validateUsername, type UsernameValidation } from '@/lib/username';

const DEBOUNCE_MS = 400;

export type UsernameStatus =
  | 'idle'
  | 'invalid'
  | 'checking'
  | 'available'
  | 'taken'
  | 'check-failed'
  | 'unchanged';

type Availability = { value: string; state: 'available' | 'taken' | 'failed' };

export type UsernameAvailability = {
  status: UsernameStatus;
  validation: UsernameValidation;
  /** Inline error text for the field (invalid / taken), else null. */
  error: string | null;
  /** Muted or success helper text for the field, else undefined. */
  helperText: string | undefined;
  /** Records that saving `value` hit the unique constraint (23505). */
  markTaken: (value: string) => void;
};

/**
 * Validates a username and (debounced 400 ms) checks availability. The query is only a hint;
 * the DB unique constraint is the source of truth. When `value === currentUsername` the status
 * is 'unchanged' and no query runs.
 */
export function useUsernameAvailability(
  value: string,
  currentUsername?: string,
): UsernameAvailability {
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [justTaken, setJustTaken] = useState<string | null>(null);

  const validation = validateUsername(value);
  const unchanged = currentUsername !== undefined && value === currentUsername;
  const needsCheck = validation.status === 'ok' && !unchanged;

  // The cleanup invalidates stale responses and the pending timer.
  useEffect(() => {
    if (!needsCheck) return;
    let active = true;
    const timer = setTimeout(async () => {
      let state: Availability['state'];
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .eq('username', value)
          .maybeSingle();
        state = error ? 'failed' : data ? 'taken' : 'available';
      } catch {
        state = 'failed';
      }
      if (active) setAvailability({ value, state });
    }, DEBOUNCE_MS);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [value, needsCheck]);

  const markTaken = useCallback((taken: string) => setJustTaken(taken), []);

  let status: UsernameStatus;
  if (unchanged) status = 'unchanged';
  else if (validation.status === 'idle') status = 'idle';
  else if (validation.status === 'invalid') status = 'invalid';
  else if (justTaken === value) status = 'taken';
  else if (availability?.value === value) {
    status = availability.state === 'failed' ? 'check-failed' : availability.state;
  } else status = 'checking';

  let helperText: string | undefined;
  let error: string | null = null;
  switch (status) {
    case 'idle':
      helperText = '3-30 characters: letters, numbers and underscores.';
      break;
    case 'unchanged':
      helperText = 'This is your current username.';
      break;
    case 'invalid':
      error = validation.status === 'invalid' ? validation.message : null;
      break;
    case 'checking':
      helperText = 'Checking availability...';
      break;
    case 'available':
      helperText = `@${value} is available.`;
      break;
    case 'taken':
      error =
        justTaken === value
          ? `@${value} was just taken. Try another.`
          : `@${value} is already taken. Try another.`;
      break;
    case 'check-failed':
      helperText = "Couldn't check availability. You can still try to save.";
      break;
  }

  return { status, validation, error, helperText, markTaken };
}
