import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Skeleton } from "@/components/ui/skeleton";
import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

export type Stat = {
  key: string;
  /** Plural label ("Trips"); drops the trailing "s" when the value is 1. */
  label: string;
  /** `null` shows a skeleton. */
  value: number | null;
  /** Shows a dash instead of the value (e.g. the stats request failed). */
  unavailable?: boolean;
};

export type StatsRowProps = {
  stats: Stat[];
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function labelFor(stat: Stat): string {
  return stat.value === 1 && stat.label.endsWith("s")
    ? stat.label.slice(0, -1)
    : stat.label;
}

export function StatsRow({ stats, style, testID }: StatsRowProps) {
  const theme = useTheme();

  return (
    <View testID={testID} style={[styles.row, style]}>
      {stats.map((stat, i) => {
        const label = labelFor(stat);
        return (
          <View key={stat.key} style={styles.item}>
            {i > 0 ? (
              <View
                style={[styles.divider, { backgroundColor: theme.border }]}
              />
            ) : null}
            <View
              accessible
              accessibilityLabel={
                stat.unavailable
                  ? `${stat.label}, unavailable`
                  : stat.value === null
                    ? `${stat.label}, loading`
                    : `${stat.value} ${label.toLowerCase()}`
              }
              style={styles.content}
            >
              {stat.unavailable ? (
                <ThemedText type="statValue" themeColor="textMuted">
                  {"�"}
                </ThemedText>
              ) : stat.value === null ? (
                <Skeleton width={32} height={22} />
              ) : (
                <ThemedText type="statValue">{String(stat.value)}</ThemedText>
              )}
              <ThemedText type="caption" themeColor="textMuted">
                {label}
              </ThemedText>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.three,
  },
  item: { flex: 1, flexDirection: "row", alignItems: "center" },
  divider: { width: 1, height: 28 },
  content: { flex: 1, alignItems: "center", gap: Spacing.half },
});

/** Trips / Stops / Photos items: skeleton while loading, dashes when the first load failed. */
export function profileStatItems(
  stats: { trips: number; stops: number; photos: number } | null,
  failed: boolean,
): Stat[] {
  const unavailable = !stats && failed;
  return [
    { key: "trips", label: "Trips", value: stats?.trips ?? null, unavailable },
    { key: "stops", label: "Stops", value: stats?.stops ?? null, unavailable },
    {
      key: "photos",
      label: "Photos",
      value: stats?.photos ?? null,
      unavailable,
    },
  ];
}
