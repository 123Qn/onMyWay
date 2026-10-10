import { Link, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Platform, StyleSheet, View, type TextInput } from 'react-native';

import { AuthScreen } from '@/components/auth/auth-screen';
import { Slot } from '@/components/auth/slot';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorBanner } from '@/components/ui/error-banner';
import { Icon } from '@/components/ui/icon';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PASSWORD_COPY } from '@/lib/auth-errors';
import { normalizeEmail, validateEmail } from '@/lib/auth-validation';
import { COLLAPSED_TEXT, collapsedA11y } from '@/lib/collapse';
import { formatCooldown, resendRemainingMs, sendResetEmail } from '@/lib/password-reset';

export default function ForgotPasswordScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(typeof params.email === 'string' ? params.email : '');
  const [sent, setSent] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [emailBlurred, setEmailBlurred] = useState(false);
  const [networkError, setNetworkError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const submittingRef = useRef(false);
  const emailRef = useRef<TextInput>(null);

  const remaining = resendRemainingMs(email, now);
  const emailError = !sent && (attempted || emailBlurred) ? validateEmail(email) : null;

  // Tick once a second only while a cooldown is running (timestamp based, so it survives
  // backgrounding).
  useEffect(() => {
    if (remaining <= 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [remaining > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSend = async () => {
    if (submittingRef.current) return;
    setAttempted(true);
    setNetworkError(false);
    if (validateEmail(email)) {
      emailRef.current?.focus();
      return;
    }
    if (resendRemainingMs(email) > 0) return;

    submittingRef.current = true;
    setSubmitting(true);
    try {
      const result = await sendResetEmail(email);
      if (result === 'network') {
        setNetworkError(true);
      } else {
        setNow(Date.now());
        setSent(true);
        if (Platform.OS === 'ios') {
          AccessibilityInfo.announceForAccessibility('Check your email');
        }
      }
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const cooling = remaining > 0;
  const buttonTitle = cooling
    ? `Resend in ${formatCooldown(remaining)}`
    : sent
      ? 'Resend link'
      : 'Send reset link';

  return (
    <AuthScreen size="short">
      <Slot visible={sent}>
        <View collapsable={false} style={[styles.circle, { backgroundColor: theme.primarySoft }]}>
          <Icon name="mail" size={28} color="primary" />
        </View>
      </Slot>
      <ThemedText type="title" accessibilityRole="header">
        {sent ? 'Check your email' : 'Forgot password?'}
      </ThemedText>
      <ThemedText themeColor="textMuted" accessibilityLiveRegion="polite">
        {sent
          ? `If an account exists for ${normalizeEmail(email)}, we've sent a link to reset your password. It expires in 1 hour.`
          : "Enter your email and we'll send you a link to choose a new password."}
      </ThemedText>
      <Slot visible={networkError} live>
        <ErrorBanner
          message={PASSWORD_COPY.network}
          onRetry={onSend}
          retrying={submitting}
        />
      </Slot>
      <TextField
        variant="onCard"
        ref={emailRef}
        label="Email"
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          setNetworkError(false);
        }}
        onBlur={() => setEmailBlurred(email.length > 0)}
        error={emailError}
        editable={!sent && !submitting}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="go"
        onSubmitEditing={onSend}
      />
      <ThemedText
        type="caption"
        themeColor="textMuted"
        {...collapsedA11y(!sent)}
        style={sent ? undefined : { ...COLLAPSED_TEXT, marginBottom: -Spacing.three }}>
        {"Can't find it? Check your spam folder."}
      </ThemedText>
      <Button
        title={buttonTitle}
        variant={sent ? 'secondary' : 'primary'}
        onPress={onSend}
        loading={submitting}
        disabled={cooling}
        size="lg"
        fullWidth
      />
      <View style={styles.linkRow}>
        <Link href="/sign-in" accessibilityRole="link" style={styles.link}>
          <ThemedText type="link">Back to sign in</ThemedText>
        </Link>
      </View>
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
  linkRow: { alignItems: 'center' },
  link: { paddingVertical: Spacing.three },
});
