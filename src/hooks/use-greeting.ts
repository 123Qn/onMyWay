import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getGreeting, type Greeting } from '@/lib/greeting';

/**
 * Greeting that is re-evaluated on mount, when the app returns to the foreground and when
 * `refresh()` is called (pull-to-refresh). Deliberately no timer.
 */
export function useGreeting(): { greeting: Greeting; refresh: () => void } {
  const [greeting, setGreeting] = useState<Greeting>(() => getGreeting(new Date()));
  const refresh = useCallback(() => setGreeting(getGreeting(new Date())), []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  return { greeting, refresh };
}
