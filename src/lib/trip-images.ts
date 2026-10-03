import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

const MAX_SIDE = 1600;
const JPEG_QUALITY = 0.8;

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

/** Resizes (long side <= 1600 for photos, or an exact width for covers) and saves as JPEG 0.8. */
export async function compressToJpeg(
  uri: string,
  size: { width?: number; height?: number } | null,
): Promise<string> {
  const context = ImageManipulator.manipulate(uri);
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

/** Single pick, cropped 16:9 at pick time, 1600 px wide. */
export async function pickCover(): Promise<CoverPick> {
  try {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 1,
    });
    if (result.canceled) return { kind: 'cancelled' };
    return { kind: 'ok', uri: await compressToJpeg(result.assets[0].uri, { width: MAX_SIDE }) };
  } catch {
    return (await isDenied()) ? { kind: 'denied' } : { kind: 'failed' };
  }
}
