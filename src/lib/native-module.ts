import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/**
 * True when an Expo native module is available in the running binary. Always true on web
 * (the JS implementations are used). Lets us degrade gracefully in a dev build that was made
 * before a native library was added.
 */
export function hasNativeModule(name: string): boolean {
  if (Platform.OS === 'web') return true;
  try {
    return requireOptionalNativeModule(name) != null;
  } catch {
    return false;
  }
}
