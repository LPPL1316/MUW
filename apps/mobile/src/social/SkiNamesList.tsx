import type { SkiNames, SkiUse } from "@shaperoute/shared-types";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { t } from "../i18n";
import { color, font, fontWeight, space } from "../theme/tokens";
import { useDrawingsDoor } from "./drawingsDoor";

type Props = {
  /** The post of a day of skiing. */
  drawingId: string;
};

/**
 * «Lifts and pistes» on the post of a day of skiing (TASK-375 part D,
 * ADR-0319): the lifts it took and the pistes it skied, by name, each once
 * with how many times, in the order of the day. Whoever can see the post
 * sees them (the user's choice). The names come from the API, found when
 * the day was saved; nothing shows while they come, for a day without
 * names, or when the API does not give them. The texts are the user's,
 * approved on 2026-11-05.
 */
export function SkiNamesList({ drawingId }: Props) {
  const { skiNamesOf } = useDrawingsDoor();
  const [names, setNames] = useState<{ id: string; names: SkiNames } | null>(null);
  useEffect(() => {
    if (skiNamesOf === undefined) {
      return;
    }
    let live = true;
    void skiNamesOf(drawingId).then((found) => {
      if (live && found !== null) {
        setNames({ id: drawingId, names: found });
      }
    });
    return () => {
      live = false;
    };
  }, [drawingId, skiNamesOf]);
  const shown = names !== null && names.id === drawingId ? names.names : null;
  const uses = shown === null ? [] : [...shown.lifts, ...shown.pistes];
  if (uses.length === 0) {
    return null;
  }
  return (
    <View style={styles.list}>
      <Text style={styles.title} accessibilityRole="header">
        {t("Lifts and pistes")}
      </Text>
      {uses.map((use, n) => (
        <Text key={n} style={styles.row} accessibilityLabel={spokenOf(use)}>
          {`${use.name} ×${use.times}`}
        </Text>
      ))}
    </View>
  );
}

/** What VoiceOver says of a row: «×» is not read as «times». */
export function spokenOf(use: SkiUse): string {
  return use.times === 1
    ? t("{name}, once", { name: use.name })
    : t("{name}, {times} times", { name: use.name, times: String(use.times) });
}

const styles = StyleSheet.create({
  list: {
    gap: space.xs,
  },
  title: {
    ...font.body,
    color: color.text,
    fontWeight: fontWeight.medium,
  },
  row: {
    ...font.body,
    color: color.text,
  },
});
