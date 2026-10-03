import { Link } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, type TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';

export default function SignUpScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const passwordRef = useRef<TextInput>(null);
  const usernameRef = useRef<TextInput>(null);
  const displayNameRef = useRef<TextInput>(null);

  return (
    <Screen scroll padded="auth" centered>
      <ThemedText type="title" accessibilityRole="header">
        Sign up
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
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="next"
        onSubmitEditing={() => usernameRef.current?.focus()}
      />
      <TextField
        ref={usernameRef}
        label="Username"
        value={username}
        onChangeText={setUsername}
        maxLength={30}
        autoCapitalize="none"
        autoComplete="username-new"
        autoCorrect={false}
        helperText="3-30 chars: a-z, 0-9, _"
        returnKeyType="next"
        onSubmitEditing={() => displayNameRef.current?.focus()}
      />
      <TextField
        ref={displayNameRef}
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={50}
        autoComplete="name"
        autoCapitalize="words"
        showCounter
        returnKeyType="done"
      />
      {/* TODO step 5: wire to Supabase sign-up, validation, ErrorBanner, loading state. */}
      <Button title="Create account" onPress={() => {}} disabled fullWidth />
      <Link href="/sign-in" accessibilityRole="link" style={styles.link}>
        <ThemedText type="link">Back to sign in</ThemedText>
      </Link>
    </Screen>
  );
}

const styles = StyleSheet.create({
  link: { alignSelf: 'center', paddingVertical: Spacing.three },
});
