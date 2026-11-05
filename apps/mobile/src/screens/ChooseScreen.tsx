import { type ReactNode, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { t, tLater } from "../i18n";
import { useStartAddress } from "../location/startAddress";
import { OpenSettings } from "../permissions/OpenSettings";
import { PlaceSearch, type SuggestPlaces } from "../places/PlaceSearch";
import type { LatLon } from "@shaperoute/shared-types";

import type { Place } from "../places/photon";
import type { StartMode } from "../location/startMode";
import { isRecordOnly } from "../settings/sport";
import { useSport } from "../settings/useSport";
import {
  color,
  fontSize,
  fontWeight,
  MIN_TAP_SIZE,
  radius,
  space,
} from "../theme/tokens";
import { TourPartView } from "../tour/TourPartView";
import { TourScrollView } from "../tour/TourScrollView";
import { TOUR_PART } from "../tour/tourSteps";
import { RunNoRouteButton } from "./RunNoRouteButton";
import { Segmented } from "./Segmented";
import { StepTitle } from "./StepTitle";

/** "My position" also asks the GPS again, as the old button did, so it works
 * after the permission is given in Settings. Translated where shown, with
 * t() (TASK-210). */
const START_MODES = [
  { value: "gps", label: tLater("My position") },
  { value: "place", label: tLater("Another place") },
] as const;

type Props = {
  /** Where the route will start, in words (UI.md, «La partenza»). */
  status: string;
  /** Location refused: offer the Settings. */
  denied: boolean;
  /** Start from the GPS, or from a place searched for (TASK-054). */
  mode: StartMode;
  onMode: (mode: StartMode) => void;
  /** Show the search: another place was asked for, or there is no GPS. */
  searching: boolean;
  onPlace: (place: Place) => void;
  /** The GPS position when known: the search prefers places around it. */
  near: LatLon | null;
  /** Places the search offers by itself, above the ones it finds: the lakes
   * and beaches of «Paddle» (TASK-240). */
  suggest?: SuggestPlaces;
  /** What the empty search field says, when not «City or street». */
  searchHint?: string;
  /** «Choose on the map», under the search (TASK-292): the start chosen
   * on the map, without writing a street. */
  onPickOnMap?: () => void;
  mapError: string | null;
  /** Loads the map that could not load again (TASK-259). */
  onMapRetry?: () => void;
  /** Shape and distance (RouteChoice). */
  children: ReactNode;
  /** "Draw route", kept at the foot of the screen. */
  footer: ReactNode;
  /** Starts a run without a route, the track only (TASK-149). */
  onRun?: () => void;
  /** Its button's words: «Bike» has its own (TASK-190). */
  runLabel?: string;
  /** Its button's sign beside the words (TASK-361): a bike rides. */
  runIcon?: string;
};

/**
 * The first screen (TASK-051): where from, what to draw, how far. The map
 * waits underneath, already loading.
 */
export function ChooseScreen({
  status,
  denied,
  mode,
  onMode,
  searching,
  onPlace,
  near,
  suggest,
  searchHint,
  onPickOnMap,
  mapError,
  onMapRetry,
  children,
  footer,
  onRun,
  runLabel = t("Run without a route"),
  runIcon,
}: Props) {
  const insets = useSafeAreaInsets();
  // A day on the snow has no shape to draw (TASK-375, ADR-0319): «Draw» is
  // its recording only; a workout at the gym, its start (TASK-385 part B).
  const sport = useSport();
  const gym = sport === "gym";
  const recordOnly = (isRecordOnly(sport) || gym) && onRun !== undefined;
  // The start by its street (TASK-361): only while the GPS is the start and
  // answers; any other line (searching, refused, a place) says more.
  const onGps = mode === "gps" && !searching && !denied;
  const address = useStartAddress(onGps ? near : null);
  // The button at the foot covers the end of the page: the page ends that
  // much lower, so its last card scrolls into sight (TASK-361).
  const [footerHeight, setFooterHeight] = useState(0);
  return (
    // The km field is low on the screen: the content shrinks so the keyboard
    // does not cover it.
    <KeyboardAvoidingView
      style={[StyleSheet.absoluteFill, styles.screen]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* The page and the button docked on it: the keyboard's padding
          shrinks this box, so the button rides above the keyboard. */}
      <View style={styles.page}>
        {/* The tour of the first opening scrolls it to its parts (TASK-266). */}
        <TourScrollView
          contentContainerStyle={[
            styles.content,
            {
              paddingTop: insets.top + space.lg,
              // The button's height has the safe area in it; before it is
              // measured, the safe area alone.
              paddingBottom: Math.max(footerHeight, insets.bottom) + space.xl,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          testID="draw-page"
        >
          {/* The logo is in the header above, once (TASK-392). */}
          <View style={styles.titleRow}>
            <View style={styles.titleButtons}>
              {/* The whole of it: "Run" alone read as running the route
                drawn below (TASK-158). Outlined: the yellow is the
                route's (TASK-361). */}
              {onRun && !recordOnly && (
                <RunNoRouteButton label={runLabel} icon={runIcon} onPress={onRun} />
              )}
            </View>
          </View>
          {recordOnly ? (
            <RecordDay
              label={runLabel}
              icon={runIcon}
              onPress={onRun}
              hint={gym ? t("No route in the gym: MuW times your workout.") : undefined}
            />
          ) : (
            <>
              <TourPartView name={TOUR_PART.start} style={styles.startCard}>
                <StepTitle number={1} label={t("START")} />
                <Segmented
                  options={START_MODES.map((option) => ({
                    ...option,
                    label: t(option.label),
                  }))}
                  value={mode}
                  onChange={onMode}
                />
                {address !== null ? (
                  <Text
                    style={styles.address}
                    numberOfLines={2}
                    accessibilityLabel={t("Starting from {place}.", { place: address })}
                    testID="start-address"
                  >
                    📍 {address}
                  </Text>
                ) : (
                  <Text style={styles.status}>{status}</Text>
                )}
                {denied && <OpenSettings />}
                {searching && (
                  <PlaceSearch
                    onSelect={onPlace}
                    near={near}
                    suggest={suggest}
                    placeholder={searchHint}
                  />
                )}
                {/* No street to write: the start chosen on the map (TASK-292). */}
                {searching && onPickOnMap && (
                  <Pressable
                    style={styles.linkButton}
                    onPress={onPickOnMap}
                    accessibilityRole="button"
                  >
                    <Text style={styles.link}>{t("Choose on the map")}</Text>
                  </Pressable>
                )}
              </TourPartView>
              {mapError && <MapError onRetry={onMapRetry} />}
              {children}
            </>
          )}
        </TourScrollView>
        {/* Docked over the page's foot: the page's own padding keeps its last
          card above it, however tall the button and the notices get. No
          route, no button for it, on the snow. */}
        {!recordOnly && (
          <View
            style={styles.footerDock}
            testID="draw-footer"
            onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          >
            <TourPartView
              name={TOUR_PART.draw}
              style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}
            >
              {footer}
            </TourPartView>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

/**
 * «Draw» for a sport recorded without a shape (TASK-375, ADR-0319): no start,
 * no shape, no distance, only the yellow «Record your day» and the line
 * that says why; for the gym «Start workout» and its own line (TASK-385
 * part B).
 */
export function RecordDay({
  label,
  icon,
  onPress,
  hint,
}: {
  label: string;
  icon?: string;
  onPress: () => void;
  /** The line under it; absent, the slopes'. */
  hint?: string;
}) {
  return (
    <View style={styles.recordCard} testID="record-day">
      <Pressable
        style={({ pressed }) => [styles.recordButton, pressed && styles.recordPressed]}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="run-no-route"
      >
        {icon !== undefined && (
          <Text style={styles.recordText} importantForAccessibility="no">
            {icon}
          </Text>
        )}
        <Text style={styles.recordText}>{label}</Text>
      </Pressable>
      <Text style={styles.status}>
        {hint ?? t("No shapes on the slopes: MuW records your day.")}
      </Text>
    </View>
  );
}

/**
 * The map page could not load (UI.md, «Quando la mappa non si carica»): the
 * map's own words, without the reason, which is for the log (TASK-259). Under
 * «Draw» the map, and its «Retry», are hidden: the screen offers its own.
 * It goes away once the map loads (TASK-256).
 */
export function MapError({ onRetry }: { reason?: string; onRetry?: () => void }) {
  return (
    <View style={styles.mapError}>
      <Text style={styles.error}>
        {t("The map could not be loaded. Check the network.")}
      </Text>
      {onRetry && (
        <Pressable
          style={styles.linkButton}
          onPress={onRetry}
          accessibilityRole="button"
        >
          <Text style={styles.link}>{t("Retry")}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: color.background,
  },
  content: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xl,
    gap: space.lg,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  titleButtons: {
    flexDirection: "row",
    gap: space.sm,
  },
  startCard: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  status: {
    color: color.textMuted,
    fontSize: fontSize.body,
  },
  address: {
    color: color.text,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  linkButton: {
    minHeight: MIN_TAP_SIZE,
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  // Not yellow: that is the route's. Underlined, so it still reads as a link.
  link: {
    color: color.text,
    fontWeight: fontWeight.bold,
    textDecorationLine: "underline",
  },
  mapError: {
    gap: space.xs,
  },
  recordCard: {
    gap: space.md,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  recordButton: {
    minHeight: MIN_TAP_SIZE,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    borderRadius: radius.pill,
    backgroundColor: color.accent,
  },
  recordPressed: {
    opacity: 0.85,
  },
  recordText: {
    color: color.onAccent,
    fontSize: fontSize.body,
    fontWeight: fontWeight.bold,
  },
  error: {
    color: color.error,
  },
  page: {
    flex: 1,
  },
  footerDock: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    backgroundColor: color.background,
  },
});
