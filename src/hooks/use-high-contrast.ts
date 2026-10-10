import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * True when the OS "increase contrast" setting is on (iOS "Increase Contrast" / darker system
 * colours; Android "High contrast text"). Used to switch card borders to `borderStrong`.
 */
export function useHighContrast(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    let active = true;
    const query =
      Platform.OS === 'ios'
        ? AccessibilityInfo.isDarkerSystemColorsEnabled()
        : AccessibilityInfo.isHighTextContrastEnabled();
    query.then((v) => active && setEnabled(v)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      Platform.OS === 'ios' ? 'darkerSystemColorsChanged' : 'highTextContrastChanged',
      setEnabled,
    );
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  return enabled;
}
