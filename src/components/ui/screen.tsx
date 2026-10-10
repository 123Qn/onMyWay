import type { ReactElement, ReactNode, Ref } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Layout, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTabBarInset } from '@/hooks/use-tab-bar-inset';
import { useTheme } from '@/hooks/use-theme';

export type ScreenProps = {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean | 'auth';
  edges?: Edge[];
  /** Defaults to true when `scroll` is false and false otherwise (ScrollView handles insets itself). */
  keyboardAvoiding?: boolean;
  tabBarInset?: boolean;
  centered?: boolean;
  maxWidth?: number;
  contentContainerStyle?: StyleProp<ViewStyle>;
  refreshControl?: ReactElement<RefreshControlProps>;
  /** Forwarded to the internal ScrollView (scroll mode only). */
  scrollRef?: Ref<ScrollView>;
  testID?: string;
};

const DEFAULT_EDGES: Edge[] = ['top', 'left', 'right', 'bottom'];

export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = DEFAULT_EDGES,
  keyboardAvoiding = !scroll,
  tabBarInset = false,
  centered = false,
  maxWidth = MaxContentWidth,
  contentContainerStyle,
  refreshControl,
  scrollRef,
  testID,
}: ScreenProps) {
  const theme = useTheme();
  const tabInset = useTabBarInset();
  const safeEdges = tabBarInset ? edges.filter((e) => e !== 'bottom') : edges;

  const padding = padded === 'auth' ? Spacing.four : padded ? Layout.screenPadding : 0;
  const contentStyle: ViewStyle = {
    padding,
    paddingBottom: padding + (tabBarInset ? tabInset : 0),
    gap: Spacing.three,
    width: '100%',
    maxWidth,
    alignSelf: 'center',
  };

  const body = scroll ? (
    <ScrollView
      ref={scrollRef}
      style={styles.flex}
      refreshControl={refreshControl}
      contentContainerStyle={[
        styles.scrollGrow,
        contentStyle,
        centered && styles.centered,
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle, centered && styles.centered, contentContainerStyle]}>
      {children}
    </View>
  );

  return (
    <View testID={testID} style={[styles.flex, { backgroundColor: theme.background }]}>
      <SafeAreaView style={styles.flex} edges={safeEdges}>
        {keyboardAvoiding ? (
          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            {body}
          </KeyboardAvoidingView>
        ) : (
          body
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollGrow: { flexGrow: 1 },
  centered: { justifyContent: 'center' },
});
