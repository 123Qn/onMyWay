import { forwardRef } from 'react';
import type { TextInput } from 'react-native';

import { TextField, type TextFieldProps } from '@/components/ui/text-field';
import { MIN_PASSWORD_LENGTH } from '@/lib/auth-validation';

export type PasswordFieldProps = Omit<TextFieldProps, 'secureTextEntry' | 'variant'> & {
  /** Shows the live "At least 8 characters" rule line (turns green with a check once met). */
  showRule?: boolean;
};

/** Password input on a card: secure entry with a show/hide toggle and the optional rule line. */
export const PasswordField = forwardRef<TextInput, PasswordFieldProps>(function PasswordField(
  { showRule = false, value, ...rest },
  ref,
) {
  const met = value.length >= MIN_PASSWORD_LENGTH;
  return (
    <TextField
      variant="onCard"
      ref={ref}
      value={value}
      secureTextEntry
      autoCapitalize="none"
      autoCorrect={false}
      helperText={showRule ? 'At least 8 characters' : undefined}
      helperTone={met ? 'success' : 'muted'}
      {...rest}
    />
  );
});
