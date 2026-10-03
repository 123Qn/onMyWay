import { StyleSheet, View } from 'react-native';

import { Skeleton, SkeletonGroup } from '@/components/ui/skeleton';
import { Radius, Spacing } from '@/constants/theme';

/** Placeholder while a draft or an existing trip loads. */
export function FormSkeleton({ variant }: { variant: 'create' | 'edit' }) {
  return (
    <SkeletonGroup style={styles.root}>
      <View style={styles.cover}>
        <Skeleton height={200} radius={Radius.lg} />
      </View>
      <Skeleton height={72} radius={Radius.md} />
      <Skeleton height={variant === 'edit' ? 120 : 72} radius={Radius.md} />
      {variant === 'edit' ? (
        <>
          <Skeleton height={120} radius={Radius.md} />
          <Skeleton height={220} radius={Radius.lg} />
          <Skeleton height={220} radius={Radius.lg} />
        </>
      ) : (
        <Skeleton height={72} radius={Radius.md} />
      )}
    </SkeletonGroup>
  );
}

const styles = StyleSheet.create({
  root: { gap: Spacing.three },
  cover: { width: '100%' },
});
