import { supabase } from '@/lib/supabase';

/** Public URL of an avatar in the public 'avatars' bucket, or null when there is no avatar. */
export function getAvatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}
