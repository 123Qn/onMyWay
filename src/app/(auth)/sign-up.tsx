import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { AuthScreen } from '@/components/auth/auth-screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { mapSignUpError } from '@/lib/auth-errors';
import {
  MAX_DISPLAY_NAME_LENGTH,
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validateNewPassword,
} from '@/lib/auth-validation';
import { supabase } from '@/lib/supabase';

type Banner = { message: string; retryable: boolean };

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [blurred, setBlurred] = useState({ email: false, password: false, name: false });
  const [serverEmailError, setServerEmailError] = useState<string | null>(null);
  const [serverPasswordError, setServerPasswordError] = useState<string | null>(null);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const submittingRef = useRef(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);
  const nameRef = useRef<TextInput>(null);

  const emailError = serverEmailError ?? (attempted || blurred.email ? validateEmail(email) : null);
  const passwordError =
    serverPasswordError ?? (attempted || blurred.password ? validateNewPassword(password) : null);
  const nameError = attempted || blurred.name ? validateDisplayName(displayName) : null;

  const onSubmit = async () => {
    if (submittingRef.current) return;
    setAttempted(true);
    setBanner(null);

    if (validateEmail(email)) {
      emailRef.current?.focus();
      return;
    }
    if (validateNewPassword(password)) {
      passwordRef.current?.focus();
      return;
    }
    if (validateDisplayName(displayName)) {
      nameRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setServerEmailError(null);
    setServerPasswordError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: normalizeEmail(email),
        password,
        options: { data: { display_name: displayName.trim() } },
      });
      if (error) showError(error);
      else if (!data.session) setNeedsConfirmation(true);
      // With a session, the route guard moves the user on to Choose username.
    } catch (e) {
      showError(e);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const showError = (error: unknown) => {
    const mapped = mapSignUpError(error);
    if (mapped.target === 'email') {
      setServerEmailError(mapped.message);
      emailRef.current?.focus();
    } else if (mapped.target === 'password') {
      setServerPasswordError(mapped.message);
      passwordRef.current?.focus();
    } else {
      setBanner({ message: mapped.message, retryable: mapped.retryable });
    }
  };

  if (needsConfirmation) {
    return (
      <AuthScreen size="short">
        <ThemedText type="title" accessibilityRole="header">
          Check your email
        </ThemedText>
        <ThemedText themeColor="textMuted" accessibilityLiveRegion="polite">
          Check your email to confirm your account.
        </ThemedText>
        <Link href="/sign-in" asChild>
          <Button title="Back to sign in" onPress={() => {}} size="lg" fullWidth />
        </Link>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen size="short">
      <ThemedText type="title" accessibilityRole="header">
        Create your account
      </ThemedText>
      <ThemedText themeColor="textMuted">Share your trips with fellow travellers.</ThemedText>
      {banner ? (
        <ErrorBanner
          message={banner.message}
          onRetry={banner.retryable ? onSubmit : undefined}
          retrying={submitting}
        />
      ) : null}
      <TextField
        variant="onCard"
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setServerEmailError(null);
          setBanner(null);
        }}
        onBlur={() => setBlurred((b) => ({ ...b, email: email.length > 0 }))}
        error={emailError}
        editable={!submitting}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        variant="onCard"
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={(text) => {
          setPassword(text);
          setServerPasswordError(null);
          setBanner(null);
        }}
        onBlur={() => setBlurred((b) => ({ ...b, password: password.length > 0 }))}
        error={passwordError}
        helperText="At least 8 characters."
        editable={!submitting}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => nameRef.current?.focus()}
      />
      <TextField
        variant="onCard"
        ref={nameRef}
        label="Display name"
        value={displayName}
        onChangeText={(text) => {
          setDisplayName(text);
          setBanner(null);
        }}
        onBlur={() => setBlurred((b) => ({ ...b, name: displayName.length > 0 }))}
        error={nameError}
        editable={!submitting}
        maxLength={MAX_DISPLAY_NAME_LENGTH}
        showCounter
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <Button title="Create account" onPress={onSubmit} loading={submitting} size="lg" fullWidth />
      <View style={styles.linkRow}>
        <ThemedText themeColor="textMuted">Already have an account?</ThemedText>
        <Link href="/sign-in" accessibilityRole="link" style={styles.link}>
          <ThemedText type="link">Sign in</ThemedText>
        </Link>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.one,
  },
  link: { paddingVertical: Spacing.three },
});
