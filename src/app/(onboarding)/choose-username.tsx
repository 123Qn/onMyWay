import { useRef, useState } from 'react';
import { type TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useUsernameAvailability } from '@/hooks/use-username-availability';
import { AUTH_COPY, isNetworkError } from '@/lib/auth-errors';
import { signOutUser } from '@/lib/sign-out';
import { supabase } from '@/lib/supabase';
import {
  USERNAME_MAX,
  normalizeUsernameInput,
  suggestUsername,
  validateUsername,
} from '@/lib/username';
import { useSession } from '@/providers/session-provider';

type Banner = { message: string; retryable: boolean; action: 'save' | 'signOut' };

export default function ChooseUsernameScreen() {
  const { session, profile, refreshProfile } = useSession();
  const [value, setValue] = useState(() => suggestUsername(profile?.display_name));
  const [banner, setBanner] = useState<Banner | null>(null);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const savingRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

  const { status, error, helperText, markTaken } = useUsernameAvailability(value);

  const canSave = (status === 'available' || status === 'check-failed') && !saving && !signingOut;

  const onSave = async () => {
    if (savingRef.current || !session) return;
    // Re-check client-side validity at save time; never send an invalid value.
    if (validateUsername(value).status !== 'ok') return;
    savingRef.current = true;
    setSaving(true);
    setBanner(null);
    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username: value })
        .eq('id', session.user.id);
      if (updateError) {
        if (updateError.code === '23505') {
          markTaken(value);
          inputRef.current?.focus();
        } else {
          setBanner({
            message: isNetworkError(updateError)
              ? AUTH_COPY.network
              : 'Could not save your username. Please try again.',
            retryable: true,
            action: 'save',
          });
        }
        return;
      }
      // Refetch so the route guard flips to the app.
      await refreshProfile();
    } catch (e) {
      setBanner({
        message: isNetworkError(e)
          ? AUTH_COPY.network
          : 'Could not save your username. Please try again.',
        retryable: true,
        action: 'save',
      });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const onSignOut = async () => {
    if (signingOut || saving) return;
    setSigningOut(true);
    setBanner(null);
    const result = await signOutUser();
    if (result === 'failed') {
      setBanner({
        message: 'Could not sign out. Please try again.',
        retryable: true,
        action: 'signOut',
      });
    }
    setSigningOut(false);
  };

  return (
    <Screen scroll padded="auth" centered>
      <ThemedText type="title" accessibilityRole="header">
        Choose your username
      </ThemedText>
      <ThemedText themeColor="textMuted">
        This is how other travellers will find you. You can change it later in your profile.
      </ThemedText>
      {banner ? (
        <ErrorBanner
          message={banner.message}
          onRetry={banner.action === 'save' ? onSave : onSignOut}
          retrying={banner.action === 'save' ? saving : signingOut}
        />
      ) : null}
      <TextField
        ref={inputRef}
        label="Username"
        value={value}
        onChangeText={(text) => {
          setValue(normalizeUsernameInput(text));
          setBanner(null);
        }}
        error={error}
        helperText={helperText}
        helperTone={status === 'available' ? 'success' : 'muted'}
        helperLoading={status === 'checking'}
        editable={!saving}
        maxLength={USERNAME_MAX}
        showCounter
        autoFocus
        selectTextOnFocus
        autoCapitalize="none"
        autoCorrect={false}
        spellCheck={false}
        autoComplete="username-new"
        textContentType="username"
        keyboardType="ascii-capable"
        returnKeyType="done"
        onSubmitEditing={() => {
          if (canSave) onSave();
        }}
      />
      <Button
        title="Save and continue"
        onPress={onSave}
        loading={saving}
        disabled={!canSave && !saving}
        fullWidth
      />
      <Button
        title="Sign out"
        variant="ghost"
        onPress={onSignOut}
        loading={signingOut}
        disabled={saving}
        fullWidth
      />
    </Screen>
  );
}
