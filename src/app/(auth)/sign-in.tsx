import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const passwordRef = useRef<TextInput>(null);

  return (
    <Screen scroll padded="auth" centered>
      <ThemedText type="title" accessibilityRole="header">
        Sign in
      </ThemedText>
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        autoCorrect={false}
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
      />
      {/* TODO step 5: wire to Supabase sign-in, validation, ErrorBanner, loading state. */}
      <Button title="Sign in" onPress={() => {}} disabled fullWidth />
      <Link href="/sign-up" accessibilityRole="link" style={styles.link}>
        <ThemedText type="link">Create an account</ThemedText>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', paddingVertical: Spacing.three },
});
