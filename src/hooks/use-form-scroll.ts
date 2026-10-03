import { useMemo, useRef, type RefObject } from 'react';
import type { ScrollView } from 'react-native';

import { Spacing } from '@/constants/theme';

export type FormScroll = {
  scrollRef: RefObject<ScrollView | null>;
  onStopsSectionLayout: (y: number) => void;
  onCardsLayout: (y: number) => void;
  onCardLayout: (stopId: string, y: number) => void;
  scrollToStop: (stopId: string) => void;
  scrollToStops: () => void;
};

/** Tracks the y offsets reported by onLayout so the form can scroll to a stop card or the Stops section. */
export function useFormScroll(): FormScroll {
  const scrollRef = useRef<ScrollView>(null);
  const stopsY = useRef(0);
  const cardsY = useRef(0);
  const cardY = useRef(new Map<string, number>());

  return useMemo<FormScroll>(
    () => ({
      scrollRef,
      onStopsSectionLayout: (y) => {
        stopsY.current = y;
      },
      onCardsLayout: (y) => {
        cardsY.current = y;
      },
      onCardLayout: (stopId, y) => {
        cardY.current.set(stopId, y);
      },
      scrollToStop: (stopId) => {
        const y = cardY.current.get(stopId);
        if (y === undefined) return;
        scrollRef.current?.scrollTo({
          y: Math.max(0, stopsY.current + cardsY.current + y - Spacing.three),
          animated: true,
        });
      },
      scrollToStops: () => {
        scrollRef.current?.scrollTo({
          y: Math.max(0, stopsY.current - Spacing.three),
          animated: true,
        });
      },
    }),
    [],
  );
}
