import { EmptyState } from '@/components/ui/empty-state';
import { Screen } from '@/components/ui/screen';

export default function ActivityScreen() {
  return (
    <Screen centered>
      <EmptyState
        icon="heart"
        title="Notifications are coming soon"
        message="Likes, comments and new followers will show up here."
      />
    </Screen>
  );
}
