import * as Linking from 'expo-linking';
import { Share } from 'react-native';

const MAX_TITLE = 80;

/**
 * Single place that decides what a shared trip link looks like. Today it is the app scheme
 * (onmyway://trip/<id>, exp://... in Expo Go). When a domain exists, set
 * EXPO_PUBLIC_WEB_BASE_URL and set up universal links / app links; nothing else changes.
 */
export function buildTripShareUrl(tripId: string): string {
  const path = `/trip/${tripId}`;
  const base = process.env.EXPO_PUBLIC_WEB_BASE_URL?.trim().replace(/\/+$/, '');
  if (base) return `${base}${path}`;
  return Linking.createURL(path);
}

function shortTitle(title: string): string {
  const trimmed = title.trim();
  return trimmed.length > MAX_TITLE ? `${trimmed.slice(0, MAX_TITLE - 3)}...` : trimmed;
}

/** Opens the OS share sheet. Resolves false only when it could not be opened. */
export async function shareTripLink(tripId: string, title: string): Promise<boolean> {
  // Android ignores `url`, so the link lives in the message on both platforms.
  const message = `${shortTitle(title)} - a trip on onMyWay\n${buildTripShareUrl(tripId)}`;
  try {
    await Share.share({ message }, { dialogTitle: 'Share trip' });
    return true;
  } catch {
    return false;
  }
}
