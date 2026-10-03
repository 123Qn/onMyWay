import { useColorScheme } from '@/hooks/use-color-scheme';

/** True when the effective colour scheme is dark. */
export function useIsDark(): boolean {
  return useColorScheme() === 'dark';
}
