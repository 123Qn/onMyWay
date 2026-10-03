import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Spacing } from '@/constants/theme';

const COLLAPSED_LINES = 4;
const MAX_LINE_BREAKS = 5;

export type CollapsibleTextProps = {
  text: string;
  /** Longer text (or 5+ line breaks) collapses to 4 lines with a Read more button. */
  maxChars: number;
  /** Use "onSoft" when the text sits on a primarySoft fill (selected stop card). */
  tone?: "default" | "onSoft";
};

export function CollapsibleText({ text, maxChars, tone = "default" }: CollapsibleTextProps) {
  const [expanded, setExpanded] = useState(false);
  const lineBreaks = text.split('\n').length - 1;
  const collapsible = text.length > maxChars || lineBreaks >= MAX_LINE_BREAKS;

  return (
    <View style={styles.container}>
      <ThemedText numberOfLines={collapsible && !expanded ? COLLAPSED_LINES : undefined}>
        {text}
      </ThemedText>
      {collapsible ? (
        <Button
          title={expanded ? 'Show less' : 'Read more'}
          variant="ghost"
          size="sm"
          tone={tone}
          onPress={() => setExpanded((v) => !v)}
          style={styles.toggle}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.one },
  toggle: { alignSelf: 'flex-start' },
});
