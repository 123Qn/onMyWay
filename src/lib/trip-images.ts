import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;
/** Cover crop is portrait 4:5 (matches the feed card); output is exactly 1280 x 1600. */
export const COVER_ASPECT: [number, number] = [4, 5];
const COVER_WIDTH = 1280;
const COVER_HEIGHT = 1600;

export type PickFailure = { kind: 'cancelled' } | { kind: 'denied' } | { kind: 'failed' };

export type PhotoPick =
  | PickFailure
  | {
      kind: 'ok';
      uris: string[];
      /** The picker returned more assets than free slots; the extras were dropped. */
      truncated: boolean;
      /** Assets that could not be processed. */
      failed: number;
    };

export type CoverPick = PickFailure | { kind: 'ok'; uri: string };

async function isDenied(): Promise<boolean> {
  try {
    const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
    return !perm.granted && perm.status === ImagePicker.PermissionStatus.DENIED;
  } catch {
    return false;
  }
}

type CropRect = { originX: number; originY: number; width: number; height: number };

/**
 * Largest centred rectangle with the cover ratio. Needed because the iOS picker always crops to a
 * square (the `aspect` option is Android only); on Android the image already has the ratio.
 * Returns null when the size is unknown or the image already has the ratio.
 */
export function coverCropRect(width: number, height: number): CropRect | null {
  if (!(width > 0) || !(height > 0)) return null;
  const [rx, ry] = COVER_ASPECT;
  const target = rx / ry;
  const current = width / height;
  if (Math.abs(current - target) < 0.005) return null;
  if (current > target) {
    const w = Math.round(height * target);
    return { originX: Math.round((width - w) / 2), originY: 0, width: w, height };
  }
  const h = Math.round(width / target);
  return { originX: 0, originY: Math.round((height - h) / 2), width, height: h };
}

/** Optionally crops, resizes (long side <= 1600 for photos, exact size for covers) and saves as JPEG 0.8. */
export async function compressToJpeg(
  uri: string,
  size: { width?: number; height?: number } | null,
  crop?: CropRect | null,
): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
  if (crop) context.crop(crop);
  if (size) context.resize(size);
  const ref = await context.renderAsync();
  const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });
  return saved.uri;
}

/** Multi-select pick of up to `maxCount` stop photos, processed one by one. */
export async function pickStopPhotos(maxCount: number): Promise<PhotoPick> {
  if (maxCount <= 0) return { kind: 'cancelled' };
  let assets: ImagePicker.ImagePickerAsset[];
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: maxCount,
      orderedSelection: true,
      quality: 1,
    });
    if (result.canceled) return { kind: 'cancelled' };
    assets = result.assets;
  } catch {
    return (await isDenied()) ? { kind: 'denied' } : { kind: 'failed' };
  }

  const truncated = assets.length > maxCount;
  const uris: string[] = [];
  let failed = 0;
  for (const asset of assets.slice(0, maxCount)) {
    try {
      const long = Math.max(asset.width, asset.height);
      // Unknown dimensions (0) skip the resize rather than risk upscaling.
      const size =
        long > MAX_SIDE
          ? asset.width >= asset.height
            ? { width: MAX_SIDE }
            : { height: MAX_SIDE }
          : null;
      uris.push(await compressToJpeg(asset.uri, size));
    } catch {
      failed += 1;
    }
  }
  return { kind: 'ok', uris, truncated, failed };
}

/** Single pick, cropped 4:5 (picker crop on Android, centred crop on iOS), 1280 x 1600 px. */
export async function pickCover(): Promise<CoverPick> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: COVER_ASPECT,
      quality: 1,
    });
    if (result.canceled) return { kind: 'cancelled' };
    const asset = result.assets[0];
    const crop = coverCropRect(asset.width, asset.height);
    return {
      kind: 'ok',
      uri: await compressToJpeg(asset.uri, { width: COVER_WIDTH, height: COVER_HEIGHT }, crop),
    };
  } catch {
    return (await isDenied()) ? { kind: 'denied' } : { kind: 'failed' };
  }
}
