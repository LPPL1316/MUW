import type { FeedPost } from "@shaperoute/shared-types";
import type { ReactElement } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";

import { drawingName } from "../social/DrawingsGrid";
import type { SamplePost } from "../feed/sampleFeed";
import { space } from "../theme/tokens";
import { DrawingResultCard } from "./DrawingResultCard";
import { SkeletonCard } from "./SkeletonCard";

/** A drawing found: a member's, from the API, or an example of «Feed». */
export type Result =
  { kind: "member"; post: FeedPost } | { kind: "example"; post: SamplePost };

/** The placeholders shown while the first page comes. */
const SKELETONS = 6;
const COLUMNS = 2;

type Props = {
  results: readonly Result[];
  /** The first page is on its way: placeholders where it will be. */
  loading: boolean;
  /** The next page is on its way: two placeholders under the grid. */
  loadingMore: boolean;
  /** The end of the grid is near: the next page, when there is one. */
  onEnd: () => void;
  onPick: (result: Result) => void;
  /** Above the grid: the members found, a note. */
  header?: ReactElement | null;
  /** In place of the grid when nothing was found and nothing is coming. */
  empty: ReactElement;
};

export function resultKey(result: Result): string {
  return `${result.kind}-${result.post.id}`;
}

/** The card of a result: a member's by its title or day, an example's. */
function card(result: Result, width: number, onPick: (result: Result) => void) {
  if (result.kind === "member") {
    const { post } = result;
    return (
      <DrawingResultCard
        title={drawingName(post)}
        author={post.author.username}
        distanceM={post.distance_m}
        line={post.track_preview}
        rotationDeg={post.rotation_deg}
        width={width}
        onPress={() => onPick(result)}
        testID={`result-${post.id}`}
      />
    );
  }
  const { post } = result;
  return (
    <DrawingResultCard
      title={post.title}
      author={post.user}
      distanceM={post.route_m}
      line={post.line}
      rotationDeg={post.rotation_deg}
      width={width}
      onPress={() => onPick(result)}
      testID={`result-${post.id}`}
    />
  );
}

/**
 * The drawings found, two a row (TASK-344): cards with the drawing, its
 * title, who drew it and how long; placeholders while a page comes; the
 * next page as the end comes near.
 */
export function ResultsGrid({
  results,
  loading,
  loadingMore,
  onEnd,
  onPick,
  header,
  empty,
}: Props) {
  const { width: screen } = useWindowDimensions();
  const width = (screen - space.lg * 2 - space.md) / COLUMNS;
  const placeholders =
    loading && results.length === 0 ? SKELETONS : loadingMore ? COLUMNS : 0;
  return (
    <FlatList
      data={results}
      keyExtractor={resultKey}
      numColumns={COLUMNS}
      columnWrapperStyle={styles.row}
      contentContainerStyle={styles.grid}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      renderItem={({ item }) => card(item, width, onPick)}
      onEndReached={onEnd}
      onEndReachedThreshold={0.5}
      ListHeaderComponent={header}
      ListEmptyComponent={placeholders > 0 ? null : empty}
      ListFooterComponent={
        placeholders > 0 ? (
          <View style={[styles.row, styles.skeletons]}>
            {Array.from({ length: placeholders }, (_, i) => (
              <SkeletonCard key={i} width={width} />
            ))}
          </View>
        ) : null
      }
      testID="search-results"
    />
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: space.lg,
    paddingBottom: space.xxl,
    gap: space.md,
  },
  row: {
    gap: space.md,
  },
  skeletons: {
    flexWrap: "wrap",
    rowGap: space.md,
  },
});
