import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, StyleSheet, View, type TextInput } from 'react-native';

import { PasswordField } from '@/components/auth/password-field';
import { Slot } from '@/components/auth/slot';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { PASSWORD_COPY, mapPasswordError } from '@/lib/auth-errors';
import {
  validateNewPassword,
  validatePasswordMatch,
  validateSignInPassword,
} from '@/lib/auth-validation';
import { sendResetEmail } from '@/lib/password-reset';
import { signOutUser } from '@/lib/sign-out';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { useSession } from '@/providers/session-provider';

type Banner = { message: string; retryable: boolean };

export default function ChangePasswordScreen() {
  const { session } = useSession();
  const email = session?.user.email ?? '';

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [code, setCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [confirmBlurred, setConfirmBlurred] = useState(false);
  const [currentServerError, setCurrentServerError] = useState<string | null>(null);
  const [newServerError, setNewServerError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const currentRef = useRef<TextInput>(null);
  const nextRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const sameAsCurrent = next.length > 0 && next === current;
  const currentError =
    currentServerError ?? (attempted ? validateSignInPassword(current) : null);
  const newError =
    newServerError ??
    (attempted
      ? (validateNewPassword(next) ??
        (sameAsCurrent ? PASSWORD_COPY.samePassword : null))
      : null);
  const confirmError =
    attempted || confirmBlurred ? validatePasswordMatch(next, confirm) : null;

  const showError = (error: unknown) => {
    const mapped = mapPasswordError(error);
    switch (mapped.target) {
      case 'current':
        setCurrentServerError(mapped.message);
        currentRef.current?.focus();
        break;
      case 'new':
        setNewServerError(mapped.message);
        nextRef.current?.focus();
        break;
      case 'banner':
        setBanner({ message: mapped.message, retryable: mapped.retryable });
        break;
      case 'session':
        showToast(mapped.message);
        void signOutUser();
        break;
      case 'reauth':
        // Fallback path: "Secure password change" wants a emailed 6-digit code.
        setNeedsCode(true);
        supabase.auth.reauthenticate().catch(() => {});
        break;
    }
  };

  const onSubmit = async () => {
    if (submittingRef.current || !session) return;
    setAttempted(true);
    setBanner(null);
    if (validateSignInPassword(current)) {
      currentRef.current?.focus();
      return;
    }
    if (validateNewPassword(next) || sameAsCurrent) {
      nextRef.current?.focus();
      return;
    }
    if (validatePasswordMatch(next, confirm)) {
      confirmRef.current?.focus();
      return;
    }
    if (needsCode && code.trim().length === 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    setCurrentServerError(null);
    setNewServerError(null);
    try {
      // Re-authenticate: proves the old password and refreshes the session.
      const signIn = await supabase.auth.signInWithPassword({ email, password: current });
      if (signIn.error) {
        showError(signIn.error);
        return;
      }
      const { error } = await supabase.auth.updateUser(
        needsCode ? { password: next, nonce: code.trim() } : { password: next },
      );
      if (error) {
        showError(error);
        return;
      }
      try {
        await supabase.auth.signOut({ scope: 'others' });
      } catch {
        // Best effort.
      }
      router.back();
      showToast('Password updated');
    } catch (e) {
      showError(e);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const sendLink = async () => {
    if (!email) return;
    const result = await sendResetEmail(email);
    if (result === 'network') setBanner({ message: PASSWORD_COPY.network, retryable: false });
    else showToast('Check your email for a reset link.');
  };

  const onForgot = () => {
    if (submitting || !email) return;
    Alert.alert('Reset by email?', `We'll email a link to ${email}. You'll stay signed in.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send link', onPress: () => void sendLink() },
    ]);
  };

  return (
    <Screen scroll edges={['left', 'right', 'bottom']}>
      <Card style={styles.card}>
        <View collapsable={false} style={styles.fields}>
          <Slot visible={banner !== null} live gap={Spacing.three}>
            <ErrorBanner
              message={banner?.message ?? ''}
              onRetry={banner?.retryable ? onSubmit : undefined}
              retrying={submitting}
            />
          </Slot>
          <PasswordField
            ref={currentRef}
            label="Current password"
            value={current}
            onChangeText={(t) => {
              setCurrent(t);
              setCurrentServerError(null);
              setBanner(null);
            }}
            error={currentError}
            revealed={revealed}
            onRevealedChange={setRevealed}
            editable={!submitting}
            autoComplete="current-password"
            textContentType="password"
            returnKeyType="next"
            onSubmitEditing={() => nextRef.current?.focus()}
          />
          <PasswordField
            ref={nextRef}
            label="New password"
            value={next}
            onChangeText={(t) => {
              setNext(t);
              setNewServerError(null);
              setBanner(null);
            }}
            error={newError}
            showRule
            revealed={revealed}
            onRevealedChange={setRevealed}
            editable={!submitting}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="next"
            onSubmitEditing={() => confirmRef.current?.focus()}
          />
          <PasswordField
            ref={confirmRef}
            label="Confirm new password"
            value={confirm}
            onChangeText={(t) => {
              setConfirm(t);
              setBanner(null);
            }}
            onBlur={() => setConfirmBlurred(confirm.length > 0)}
            error={confirmError}
            revealed={revealed}
            onRevealedChange={setRevealed}
            editable={!submitting}
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="go"
            onSubmitEditing={onSubmit}
          />
          <Slot visible={needsCode}>
            <TextField
              variant="onCard"
              label="Verification code"
              value={code}
              onChangeText={setCode}
              helperText="We emailed you a 6-digit code to confirm it's you."
              editable={!submitting}
              keyboardType="number-pad"
              autoComplete="one-time-code"
              textContentType="oneTimeCode"
              returnKeyType="go"
              onSubmitEditing={onSubmit}
            />
          </Slot>
          <Button title="Update password" onPress={onSubmit} loading={submitting} size="lg" fullWidth />
          <View style={styles.linkRow}>
            <Button
              title="Forgot your current password?"
              variant="ghost"
              size="sm"
              onPress={onForgot}
              disabled={submitting}
            />
          </View>
          <ThemedText type="caption" themeColor="textMuted" style={styles.note}>
            Other devices will be signed out after you change your password.
          </ThemedText>
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: Spacing.two },
  fields: { gap: Spacing.three },
  linkRow: { alignItems: 'center' },
  note: { textAlign: 'center' },
});
