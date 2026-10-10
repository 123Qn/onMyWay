import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInput } from 'react-native';

import { AuthScreen } from '@/components/auth/auth-screen';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { mapSignInError } from '@/lib/auth-errors';
import {
  normalizeEmail,
  validateEmail,
  validateSignInPassword,
} from '@/lib/auth-validation';
import { supabase } from '@/lib/supabase';

type Banner = { message: string; retryable: boolean };

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [attempted, setAttempted] = useState(false);
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [banner, setBanner] = useState<Banner | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const emailError = attempted || emailBlurred ? validateEmail(email) : null;
  const passwordError = attempted ? validateSignInPassword(password) : null;

  const onSubmit = async () => {
    if (submittingRef.current) return;
    setAttempted(true);
    setBanner(null);

    if (validateEmail(email)) {
      emailRef.current?.focus();
      return;
    }
    if (validateSignInPassword(password)) {
      passwordRef.current?.focus();
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: normalizeEmail(email),
        password,
      });
      if (error) showError(error);
    } catch (e) {
      showError(e);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const showError = (error: unknown) => {
    const mapped = mapSignInError(error);
    if (mapped.target === 'banner') {
      setBanner({ message: mapped.message, retryable: mapped.retryable });
    }
  };

  return (
    <AuthScreen>
      <ThemedText type="title" accessibilityRole="header">
        Sign in
      </ThemedText>
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
          setBanner(null);
        }}
        onBlur={() => setEmailBlurred(email.length > 0)}
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
          setBanner(null);
        }}
        error={passwordError}
        editable={!submitting}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      <Button title="Sign in" onPress={onSubmit} loading={submitting} size="lg" fullWidth />
      <View style={styles.linkRow}>
        <ThemedText themeColor="textMuted">New here?</ThemedText>
        <Link href="/sign-up" accessibilityRole="link" style={styles.link}>
          <ThemedText type="link">Create an account</ThemedText>
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

