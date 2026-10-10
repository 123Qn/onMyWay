import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { AuthScreen } from '@/components/auth/auth-screen';
import { PasswordField } from '@/components/auth/password-field';
import { Slot } from '@/components/auth/slot';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Icon } from '@/components/ui/icon';
import { Spinner } from '@/components/ui/spinner';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  RECOVERY_COPY,
  mapPasswordError,
  mapRecoveryExchangeError,
  type RecoveryLinkProblem,
} from '@/lib/auth-errors';
import { validateNewPassword, validatePasswordMatch } from '@/lib/auth-validation';
import { parseRecoveryParams, parseRecoveryUrl, type RecoveryOutcome } from '@/lib/password-reset';
import { signOutUser } from '@/lib/sign-out';
import { supabase } from '@/lib/supabase';
import { showToast } from '@/lib/toast';
import { useSession } from '@/providers/session-provider';

type Status = 'verifying' | 'form' | 'invalid';
type Banner = { message: string; retryable: boolean };

/** Waits this long for the full URL (fragment) before concluding the link has no code. */
const URL_WAIT_MS = 1200;

export default function ResetPasswordScreen() {
  const theme = useTheme();
  const { beginRecovery, endRecovery } = useSession();
  const params = useLocalSearchParams<{
    code?: string;
    error?: string;
    error_code?: string;
    error_description?: string;
  }>();
  const url = Linking.useLinkingURL();

  const [status, setStatus] = useState<Status>('verifying');
  const [problem, setProblem] = useState<RecoveryLinkProblem>('unknown');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [confirmBlurred, setConfirmBlurred] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const startedRef = useRef(false);
  const submittingRef = useRef(false);
  const unmountedRef = useRef(false);
  /** beginRecovery() was called and endRecovery() has not been yet. */
  const recoveringRef = useRef(false);
  /** This mount completed an exchange, so it owns a recovery session. */
  const ownSessionRef = useRef(false);
  const doneRef = useRef(false);
  const passwordRef = useRef<TextInput>(null);
  const confirmRef = useRef<TextInput>(null);

  const finishRecovery = () => {
    if (recoveringRef.current) {
      recoveringRef.current = false;
      endRecovery();
    }
  };

  // Read the link once and exchange the code. The code is never logged or stored.
  useEffect(() => {
    if (startedRef.current) return;
    let outcome: RecoveryOutcome | null = parseRecoveryParams(params);
    if (!outcome || !('error' in outcome)) {
      // An error in the fragment (not visible to the router) wins over a code.
      const fromUrl = url && url.includes('reset-password') ? parseRecoveryUrl(url) : null;
      if (fromUrl && ('error' in fromUrl || !outcome)) outcome = fromUrl;
    }
    if (!outcome) {
      const timer = setTimeout(() => {
        if (startedRef.current) return;
        startedRef.current = true;
        setProblem('no_code');
        setStatus('invalid');
      }, URL_WAIT_MS);
      return () => clearTimeout(timer);
    }

    startedRef.current = true;
    router.setParams({
      code: undefined,
      error: undefined,
      error_code: undefined,
      error_description: undefined,
    });
    if ('error' in outcome) {
      setProblem(outcome.error);
      setStatus('invalid');
      return;
    }

    const code = outcome.code;
    beginRecovery();
    recoveringRef.current = true;
    supabase.auth
      .exchangeCodeForSession(code)
      .then(({ error }) => {
        if (unmountedRef.current) {
          // Left the screen mid-exchange: do not keep a login nobody asked for.
          if (!error) supabase.auth.signOut().catch(() => {});
          return;
        }
        if (error) {
          setProblem(mapRecoveryExchangeError(error));
          setStatus('invalid');
        } else {
          ownSessionRef.current = true;
          setStatus('form');
        }
      })
      .catch((e) => {
        if (unmountedRef.current) return;
        setProblem(mapRecoveryExchangeError(e));
        setStatus('invalid');
      });
  }, [params, url, beginRecovery]);

  // Abandoned screen: release the guards and drop the recovery session.
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      if (ownSessionRef.current && !doneRef.current) {
        supabase.auth.signOut().catch(() => {});
      }
      if (recoveringRef.current) {
        recoveringRef.current = false;
        endRecovery();
      }
    };
  }, [endRecovery]);

  const passwordError = newError ?? (attempted ? validateNewPassword(password) : null);
  const confirmError =
    attempted || confirmBlurred ? validatePasswordMatch(password, confirm) : null;

  const onSubmit = async () => {
    if (submittingRef.current || status !== 'form') return;
    setAttempted(true);
    setBanner(null);
    if (validateNewPassword(password)) {
      passwordRef.current?.focus();
      return;
    }
    if (validatePasswordMatch(password, confirm)) {
      confirmRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setNewError(null);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        showError(error);
        return;
      }
      doneRef.current = true;
      // Sign out every other device (the account may have been compromised); ignore failure.
      try {
        await supabase.auth.signOut({ scope: 'others' });
      } catch {
        // Best effort.
      }
      finishRecovery();
      setTimeout(() => {
        router.replace('/');
        showToast('Password updated');
      }, 0);
    } catch (e) {
      showError(e);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const showError = (error: unknown) => {
    const mapped = mapPasswordError(error);
    if (mapped.target === 'new') {
      setNewError(mapped.message);
      passwordRef.current?.focus();
    } else if (mapped.target === 'banner' || mapped.target === 'session') {
      setBanner({
        message: mapped.message,
        retryable: mapped.target === 'banner' && mapped.retryable,
      });
    } else {
      setBanner({ message: 'Something went wrong. Please try again.', retryable: false });
    }
  };

  /** Leaves for an (auth) route: any session is dropped first so the guards allow it. */
  const leaveTo = async (path: '/forgot-password' | '/sign-in') => {
    await signOutUser();
    finishRecovery();
    setTimeout(() => router.replace(path), 0);
  };

  const isForm = status === 'form';
  const isInvalid = status === 'invalid';
  const isVerifying = status === 'verifying';

  return (
    <AuthScreen size="short">
      <Slot visible={isInvalid}>
        <View collapsable={false} style={[styles.circle, { backgroundColor: theme.dangerSoft }]}>
          <Icon name="alert" size={28} color="danger" />
        </View>
      </Slot>
      <ThemedText type="title" accessibilityRole="header">
        {isForm ? 'Choose a new password' : isInvalid ? "This link isn't valid" : 'Reset password'}
      </ThemedText>
      <ThemedText themeColor="textMuted" accessibilityLiveRegion="polite">
        {isForm
          ? "Pick a password you haven't used here before."
          : isInvalid
            ? RECOVERY_COPY[problem]
            : 'Checking your link...'}
      </ThemedText>
      <Slot visible={isVerifying}>
        <View collapsable={false} style={styles.spinner}>
          <Spinner size="lg" />
        </View>
      </Slot>
      <Slot visible={banner !== null && isForm} live>
        <ErrorBanner
          message={banner?.message ?? ''}
          onRetry={banner?.retryable ? onSubmit : undefined}
          retrying={submitting}
        />
      </Slot>
      <Slot visible={isForm}>
        <View collapsable={false} style={styles.fields}>
          <PasswordField
            ref={passwordRef}
            label="New password"
            value={password}
            onChangeText={(t) => {
              setPassword(t);
              setNewError(null);
              setBanner(null);
            }}
            error={passwordError}
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
            label="Confirm password"
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
        </View>
      </Slot>
      <Slot visible={isForm}>
        <Button title="Update password" onPress={onSubmit} loading={submitting} size="lg" fullWidth />
      </Slot>
      <Slot visible={isInvalid}>
        <Button
          title="Request a new link"
          onPress={() => leaveTo('/forgot-password')}
          size="lg"
          fullWidth
        />
      </Slot>
      <Slot visible={isInvalid} style={styles.linkRow}>
        <Button title="Back to sign in" variant="ghost" onPress={() => leaveTo('/sign-in')} />
      </Slot>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  circle: {
    width: 64,
    height: 64,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  spinner: { alignItems: 'center', paddingVertical: Spacing.three },
  fields: { gap: Spacing.three },
  linkRow: { alignItems: 'center' },
});
