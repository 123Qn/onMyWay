import { StyleSheet } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { ThemedText } from '@/components/themed-text';
import { EmptyState } from '@/components/ui/empty-state';

export default function FeedScreen() {
  return (
    <Screen tabBarInset>
      <ThemedText type="title" accessibilityRole="header">
        Feed
      </ThemedText>
      <EmptyState
        style={styles.empty}
        icon="map"
        title="No trips yet"
        message="Be the first to share a journey."
        actionLabel="Create your first trip"
        // TODO step 8-10: navigate to the create-trip screen.
        onAction={() => {}}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, justifyContent: 'center' },
});
