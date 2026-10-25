import type { ReactNode } from "react";
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
import { HeartBadge } from "../intro/HeartBadge";
import { OpenSettings } from "../permissions/OpenSettings";
import { PlaceSearch, type SuggestPlaces } from "../places/PlaceSearch";
import type { LatLon } from "@shaperoute/shared-types";

import type { Place } from "../places/photon";
import type { StartMode } from "../location/startMode";
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
import { Segmented } from "./Segmented";

/** "My position" also asks the GPS again, as the old button did, so it works
 * after the permission is given in Settings. Translated where shown, with
 * t() (TASK-210). */
const START_MODES = [
  { value: "gps", label: tLater("My position") },
  { value: "place", label: tLater("Another place") },
] as const;

/** The heart beside the name: as tall as the title's letters and a little more. */
const BADGE_SIZE = 32;

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
}: Props) {
  const insets = useSafeAreaInsets();
  return (
    // The km field is low on the screen: the content shrinks so the keyboard
    // does not cover it.
    <KeyboardAvoidingView
      style={[StyleSheet.absoluteFill, styles.screen]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* The tour of the first opening scrolls it to its parts (TASK-266). */}
      <TourScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + space.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.titleRow}>
          <View style={styles.brand}>
            {/* The heart of the launch on its yellow, as a logo (TASK-221). */}
            <HeartBadge size={BADGE_SIZE} />
            <Text style={styles.title}>MuW</Text>
          </View>
          <View style={styles.titleButtons}>
            {onRun && (
              <Pressable
                style={styles.run}
                onPress={onRun}
                accessibilityRole="button"
                accessibilityLabel={runLabel}
              >
                {/* The whole of it: "Run" alone read as running the route
                    drawn below (TASK-158). */}
                <Text style={styles.runText}>{runLabel}</Text>
              </Pressable>
            )}
          </View>
        </View>
        <TourPartView name={TOUR_PART.start} style={styles.startCard}>
          <Text style={styles.label}>{t("START")}</Text>
          <Segmented
            options={START_MODES.map((option) => ({
              ...option,
              label: t(option.label),
            }))}
            value={mode}
            onChange={onMode}
          />
          <Text style={styles.status}>{status}</Text>
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
      </TourScrollView>
      <TourPartView
        name={TOUR_PART.draw}
        style={[styles.footer, { paddingBottom: insets.bottom + space.sm }]}
      >
        {footer}
      </TourPartView>
    </KeyboardAvoidingView>
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
    justifyContent: "space-between",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
  },
  title: {
    color: color.text,
    fontSize: fontSize.title,
    fontWeight: fontWeight.bold,
  },
  titleButtons: {
    flexDirection: "row",
    gap: space.sm,
  },
  // Yellow, the user's choice (TASK-220, ADR-0183): the one control yellow
  // without being the route's. Dark text on it, as on every yellow.
  run: {
    minHeight: MIN_TAP_SIZE,
    paddingHorizontal: space.md,
    borderRadius: radius.pill,
    justifyContent: "center",
    backgroundColor: color.accent,
  },
  runText: {
    color: color.onAccent,
    fontSize: fontSize.body,
    fontWeight: fontWeight.semibold,
  },
  startCard: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.lg,
    backgroundColor: color.surface,
  },
  label: {
    color: color.textMuted,
    fontSize: fontSize.label,
    fontWeight: fontWeight.semibold,
    letterSpacing: 1.2,
  },
  status: {
    color: color.textMuted,
    fontSize: fontSize.body,
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
  error: {
    color: color.error,
  },
  footer: {
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: color.border,
    backgroundColor: color.background,
  },
});
