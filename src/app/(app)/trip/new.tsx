import { router } from 'expo-router';

import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';

/** Placeholder until step 10 (create trip). */
export default function NewTripScreen() {
  return (
    <Screen centered>
      <EmptyState
        icon="map"
        title="Creating trips is coming soon"
        actionLabel="Close"
        onAction={() => router.back()}
      />
    </Screen>
  );
}
