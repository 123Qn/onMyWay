import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { Stack, router, useNavigation } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  View,
  type TextInput,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Layout, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUsernameAvailability } from '@/hooks/use-username-availability';
import { getAvatarUrl } from '@/lib/avatar-url';
import { AUTH_COPY, isNetworkError } from '@/lib/auth-errors';
import { MAX_DISPLAY_NAME_LENGTH, validateDisplayName } from '@/lib/auth-validation';
import { randomId } from '@/lib/random-id';
import { supabase } from '@/lib/supabase';
import { USERNAME_MAX, normalizeUsernameInput } from '@/lib/username';
import { useSession } from '@/providers/session-provider';
import type { TablesUpdate } from '@/types/database';

const BIO_MAX = 160;
const AVATAR_SIZE = 512;

type AvatarChoice = { kind: 'unchanged' } | { kind: 'removed' } | { kind: 'picked'; uri: string };
type Banner = { message: string; retryable: boolean };

function normalizeBio(text: string): string | null {
  const v = text.trim().replace(/\n{3,}/g, '\n\n');
  return v.length > 0 ? v : null;
}

/** Best-effort removal of an avatar file; errors are ignored on purpose. */
async function removeAvatarFile(path: string | null | undefined, userId: string) {
  if (!path || !path.startsWith(`${userId}/`)) return;
  try {
    await supabase.storage.from('avatars').remove([path]);
  } catch {
    // Ignored: an orphaned file is harmless.
  }
}

export default function EditProfileScreen() {
  const { session, profile, refreshProfile } = useSession();
  const navigation = useNavigation();
  const theme = useTheme();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatar, setAvatar] = useState<AvatarChoice>({ kind: 'unchanged' });
  const [submitted, setSubmitted] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [photoDenied, setPhotoDenied] = useState(false);
  const [saving, setSaving] = useState(false);

  const savingRef = useRef(false);
  const savedRef = useRef(false);
  /** Path uploaded by a failed save, reused on retry so no duplicate file is created. */
  const uploadedRef = useRef<string | null>(null);
  const nameRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const bioRef = useRef<TextInput>(null);

  const availability = useUsernameAvailability(username, profile?.username);

  const nameError = validateDisplayName(displayName);
  const bioValue = normalizeBio(bio);
  const usernameOk =
    availability.status === 'available' ||
    availability.status === 'unchanged' ||
    availability.status === 'check-failed';
  const valid = !nameError && bio.length <= BIO_MAX && usernameOk;

  const dirty =
    !!profile &&
    (displayName.trim() !== profile.display_name ||
      username !== profile.username ||
      bioValue !== (profile.bio ?? null) ||
      avatar.kind !== 'unchanged');
  const canSave = dirty && valid && !saving;

  // Unsaved-changes guard: covers Cancel, Android back and programmatic dismissals.
  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (savedRef.current) return;
      if (savingRef.current) {
        e.preventDefault();
        return;
      }
      if (!dirty) return;
      e.preventDefault();
      Alert.alert('Discard changes?', 'You have unsaved changes.', [
        { text: 'Keep editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => navigation.dispatch(e.data.action),
        },
      ]);
    });
  }, [navigation, dirty]);

  // A new pick or removal makes an earlier failed upload obsolete.
  const discardUploaded = () => {
    const path = uploadedRef.current;
    uploadedRef.current = null;
    if (path && session) removeAvatarFile(path, session.user.id);
  };

  const pickPhoto = async () => {
    if (saving) return;
    setPhotoDenied(false);
    setBanner(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });
      if (result.canceled) return;
      const ref = await ImageManipulator.manipulate(result.assets[0].uri)
        .resize({ width: AVATAR_SIZE, height: AVATAR_SIZE })
        .renderAsync();
      const saved = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.8 });
      discardUploaded();
      setAvatar({ kind: 'picked', uri: saved.uri });
    } catch {
      let denied = false;
      try {
        const perm = await ImagePicker.getMediaLibraryPermissionsAsync();
        denied = !perm.granted && perm.status === ImagePicker.PermissionStatus.DENIED;
      } catch {
        // Fall through to the generic message.
      }
      if (denied) setPhotoDenied(true);
      else setBanner({ message: 'Could not open your photo. Please try another.', retryable: false });
    }
  };

  const removePhoto = () => {
    if (saving) return;
    discardUploaded();
    setPhotoDenied(false);
    setAvatar({ kind: 'removed' });
  };

  const onSave = async () => {
    setSubmitted(true);
    if (savingRef.current || !session || !profile || !canSave) return;
    const userId = session.user.id;
    savingRef.current = true;
    setSaving(true);
    setBanner(null);
    try {
      const update: TablesUpdate<'profiles'> = {};
      if (displayName.trim() !== profile.display_name) update.display_name = displayName.trim();
      if (username !== profile.username) update.username = username;
      if (bioValue !== (profile.bio ?? null)) update.bio = bioValue;

      if (avatar.kind === 'picked') {
        let path = uploadedRef.current;
        if (!path) {
          const newPath = `${userId}/${randomId()}.jpg`;
          let uploadError: unknown = null;
          try {
            const bytes = await (await fetch(avatar.uri)).arrayBuffer();
            const { error } = await supabase.storage
              .from('avatars')
              .upload(newPath, bytes, { contentType: 'image/jpeg', upsert: false });
            uploadError = error;
          } catch (e) {
            uploadError = e;
          }
          if (uploadError) {
            setBanner({
              message: isNetworkError(uploadError)
                ? AUTH_COPY.network
                : 'Could not upload your photo. Please try again.',
              retryable: true,
            });
            return;
          }
          path = newPath;
          uploadedRef.current = path;
        }
        update.avatar_path = path;
      } else if (avatar.kind === 'removed') {
        update.avatar_path = null;
      }

      const { error: updateError } = await supabase
        .from('profiles')
        .update(update)
        .eq('id', userId);

      if (updateError) {
        if (updateError.code === '23505') {
          availability.markTaken(username);
          discardUploaded();
          usernameRef.current?.focus();
        } else {
          setBanner({
            message: isNetworkError(updateError)
              ? AUTH_COPY.network
              : 'Could not save your profile. Please try again.',
            retryable: true,
          });
        }
        return;
      }

      uploadedRef.current = null;
      if (avatar.kind !== 'unchanged') await removeAvatarFile(profile.avatar_path, userId);
      await refreshProfile();
      savedRef.current = true;
      router.back();
    } catch (e) {
      setBanner({
        message: isNetworkError(e)
          ? AUTH_COPY.network
          : 'Could not save your profile. Please try again.',
        retryable: true,
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const avatarUri =
    avatar.kind === 'picked'
      ? avatar.uri
      : avatar.kind === 'removed'
        ? null
        : getAvatarUrl(profile?.avatar_path);
  const hasPhoto = !!avatarUri;

  return (
    <>
      <Stack.Screen
        options={{
          gestureEnabled: !dirty,
          headerLeft: () => (
            <HeaderTextButton label="Cancel" disabled={saving} onPress={() => router.back()} />
          ),
          headerRight: () => (
            <HeaderTextButton
              label="Save"
              bold
              loading={saving}
              disabled={!canSave}
              onPress={onSave}
            />
          ),
        }}
      />
      <Screen scroll edges={['left', 'right', 'bottom']}>
        {banner ? (
          <ErrorBanner
            message={banner.message}
            onRetry={banner.retryable ? onSave : undefined}
            retrying={saving}
          />
        ) : null}

        <View style={styles.avatarBlock}>
          <View>
            <Avatar
              size="xl"
              uri={avatarUri}
              name={displayName}
              accessibilityLabel="Change profile photo"
              onPress={pickPhoto}
            />
            {saving && avatar.kind === 'picked' ? (
              <View style={[styles.avatarOverlay, { backgroundColor: theme.overlay }]}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <Button
            title="Change photo"
            variant="ghost"
            size="sm"
            onPress={pickPhoto}
            disabled={saving}
          />
          {hasPhoto ? (
            <Button
              title="Remove photo"
              variant="ghost"
              size="sm"
              onPress={removePhoto}
              disabled={saving}
            />
          ) : null}
          {photoDenied ? (
            <ThemedText type="caption" themeColor="textMuted" style={styles.note}>
              Allow photo access in Settings to choose a picture.
            </ThemedText>
          ) : null}
        </View>

        <TextField
          ref={nameRef}
          label="Display name"
          value={displayName}
          onChangeText={(t) => {
            setDisplayName(t);
            setBanner(null);
          }}
          error={submitted || displayName.length > 0 ? nameError : null}
          editable={!saving}
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          showCounter
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          returnKeyType="next"
          onSubmitEditing={() => usernameRef.current?.focus()}
        />
        <TextField
          ref={usernameRef}
          label="Username"
          value={username}
          onChangeText={(t) => {
            setUsername(normalizeUsernameInput(t));
            setBanner(null);
          }}
          error={availability.error}
          helperText={availability.helperText}
          helperTone={availability.status === 'available' ? 'success' : 'muted'}
          helperLoading={availability.status === 'checking'}
          editable={!saving}
          maxLength={USERNAME_MAX}
          showCounter
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="username-new"
          textContentType="username"
          keyboardType="ascii-capable"
          returnKeyType="next"
          onSubmitEditing={() => bioRef.current?.focus()}
        />
        <TextField
          ref={bioRef}
          label="Bio"
          value={bio}
          onChangeText={(t) => {
            setBio(t);
            setBanner(null);
          }}
          helperText="Tell travellers a bit about yourself."
          editable={!saving}
          multiline
          maxLength={BIO_MAX}
          showCounter
          autoCapitalize="sentences"
        />
      </Screen>
    </>
  );
}

type HeaderTextButtonProps = {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  bold?: boolean;
};

function HeaderTextButton({ label, onPress, disabled, loading, bold }: HeaderTextButtonProps) {
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      hitSlop={8}
      style={styles.headerButton}>
      {loading ? (
        <ActivityIndicator />
      ) : (
        <ThemedText
          themeColor="primary"
          type={bold ? 'bodyStrong' : 'default'}
          style={disabled ? styles.headerDisabled : undefined}>
          {label}
        </ThemedText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatarBlock: { alignItems: 'center', gap: Spacing.one },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  note: { textAlign: 'center' },
  headerButton: {
    minHeight: Layout.minTouchTarget,
    minWidth: Layout.minTouchTarget,
    paddingHorizontal: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDisabled: { opacity: 0.4 },
});
