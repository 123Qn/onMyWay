import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';

/** Placeholder until step 8 (trip detail). */
export default function TripDetailScreen() {
  return (
    <Screen edges={['left', 'right', 'bottom']} centered>
      <EmptyState icon="map" title="Trip details are coming soon" />
    </Screen>
  );
}
