import { forwardRef, useCallback, useRef, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';

import { Icon } from './icon';
import { IconButton } from './icon-button';

import { Spinner } from '@/components/ui/spinner';
import { ThemedText } from '@/components/themed-text';
import { FontFamily, Layout, Radius, Spacing, Typography, shadow } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TextFieldProps = Omit<TextInputProps, 'style' | 'value' | 'onChangeText'> & {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  helperText?: string;
  showCounter?: boolean;
  /** Colour of the helper text; 'success' also shows a check icon. */
  helperTone?: 'muted' | 'success';
  /** Shows a small spinner before the helper text (e.g. while checking availability). */
  helperLoading?: boolean;
  /** 'onCard' uses surfaceMuted fill (inside white cards). */
  variant?: 'default' | 'onCard';
  containerStyle?: StyleProp<ViewStyle>;
};

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  {
    label,
    value,
    onChangeText,
    error,
    helperText,
    secureTextEntry = false,
    maxLength,
    showCounter = false,
    helperTone = 'muted',
    helperLoading = false,
    multiline = false,
    editable = true,
    variant = 'default',
    containerStyle,
    onFocus,
    onBlur,
    ...rest
  },
  forwardedRef,
) {
  const theme = useTheme();
  const inputRef = useRef<TextInput | null>(null);
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const setRefs = useCallback(
    (node: TextInput | null) => {
      inputRef.current = node;
      if (typeof forwardedRef === 'function') forwardedRef(node);
      else if (forwardedRef) forwardedRef.current = node;
    },
    [forwardedRef],
  );

  const hasError = !!error;
  const borderColor = hasError ? theme.danger : focused ? theme.primary : theme.borderStrong;
  const focusRing = { ...shadow(theme, 'sm'), shadowColor: theme.primary, shadowOpacity: 0.15, shadowRadius: 4, shadowOffset: { width: 0, height: 0 } };
  const counterAtLimit = maxLength !== undefined && value.length >= maxLength;
  
  return (
    <View style={[styles.container, containerStyle]}>
      <Pressable collapsable={false} accessible={false} onPress={() => inputRef.current?.focus()}>
        <ThemedText type="small" style={styles.label}>
          {label}
        </ThemedText>
      </Pressable>

      <View
        style={[
          styles.inputRow,
          {
            backgroundColor: variant === 'onCard' ? theme.surfaceMuted : theme.surface,
            borderColor,
            borderWidth: focused || hasError ? 2 : 1.5,
          },
          focused && !hasError && Platform.OS === 'ios' && focusRing,
          !editable && styles.disabled,
        ]}>
        <TextInput
          {...rest}
          ref={setRefs}
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
          multiline={multiline}
          editable={editable}
          secureTextEntry={secureTextEntry && !revealed}
          accessibilityLabel={label}
          accessibilityHint={helperText}
          placeholderTextColor={theme.textMuted}
          selectionColor={theme.primary}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            styles.input,
            { color: theme.text },
            multiline && styles.multiline,
          ]}
        />
        {secureTextEntry ? (
          <IconButton
            icon={revealed ? 'eye-off' : 'eye'}
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            onPress={() => setRevealed((v) => !v)}
            disabled={!editable}
            style={styles.toggle}
          />
        ) : null}
      </View>

      {error || helperText || (showCounter && maxLength !== undefined) ? (
        <View style={styles.bottomRow}>
          {hasError ? (
            <View
              style={styles.errorRow}
              accessibilityRole="alert"
              accessibilityLiveRegion="polite">
              <Icon name="alert" size={Layout.iconSize.sm} color="danger" />
              <ThemedText type="caption" themeColor="danger" style={styles.flex}>
                {error}
              </ThemedText>
            </View>
          ) : helperText ? (
            <View style={styles.helperRow} accessibilityLiveRegion="polite">
              {helperLoading ? <Spinner color="textMuted" /> : null}
              {helperTone === 'success' ? (
                <Icon name="check" size={Layout.iconSize.sm} color="success" />
              ) : null}
              <ThemedText
                type="caption"
                themeColor={helperTone === 'success' ? 'success' : 'textMuted'}
                style={styles.flex}>
                {helperText}
              </ThemedText>
            </View>
          ) : (
            <View style={styles.flex} />
          )}
          {showCounter && maxLength !== undefined ? (
            <ThemedText type="caption" themeColor={counterAtLimit ? 'danger' : 'textMuted'}>
              {`${value.length}/${maxLength}`}
            </ThemedText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  label: { fontFamily: FontFamily.semibold },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: Layout.inputHeight,
    borderRadius: Radius.md,
  },
  input: {
    flex: 1,
    padding: Spacing.three,
    fontSize: Typography.body.fontSize,
    lineHeight: Typography.body.lineHeight,
    fontFamily: Typography.body.fontFamily,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  toggle: { marginRight: Spacing.one },
  disabled: { opacity: 0.5 },
  bottomRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  helperRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  errorRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  flex: { flex: 1 },
});
