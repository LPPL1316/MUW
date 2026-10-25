import { type ReactNode, useEffect, useState } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

import { color } from "../theme/tokens";
import { grounding, LENGTH, PARENT, type Pose, type Segment } from "./poses";

/**
 * The stretching figure (TASK-285 part B, ADR-0247): a person drawn with
 * thin turned Views, as the heart of the launch animation is (ADR-0147),
 * with no drawing library. Each segment is a zero-sized frame at its joint,
 * turned by its angle, holding its bar and the segments that hang from it:
 * a limb never changes length while it turns. A new pose is reached in
 * `POSE_MS`, every joint turning the short way round.
 */

/** How long the figure takes to move from one pose to the next. */
export const POSE_MS = 800;

/** The bar's width and the far limbs' fade, as a share of the height. */
const LINE_SHARE = 0.032;
const FAR_OPACITY = 0.45;
/** The arms hang a little below the neck. */
const SHOULDER_SHARE = 0.9;

type Props = {
  pose: Pose;
  /** The figure's height on screen, in pixels. */
  height: number;
  /** Turned round, to do the other side. */
  mirrored?: boolean;
  testID?: string;
};

/** Where the figure comes from and goes to; the same when still. */
type Move = { from: Pose; to: Pose };

/** The angle of `segment` in its parent's frame. */
function relative(segment: Segment, pose: Pose): number {
  const parent = PARENT[segment];
  return parent === null ? pose[segment] : pose[segment] - pose[parent];
}

/** `to` brought within half a turn of `from`: the joint turns the short way. */
export function nearest(from: number, to: number): number {
  let delta = (to - from) % 360;
  if (delta > 180) {
    delta -= 360;
  } else if (delta < -180) {
    delta += 360;
  }
  return from + delta;
}

/** What every limb of one figure shares: its motion and its scale. */
type Frame = { t: Animated.Value; move: Move; height: number; line: number };

function Limb({
  segment,
  frame,
  far = false,
  children,
}: {
  segment: Segment;
  frame: Frame;
  far?: boolean;
  children?: ReactNode;
}) {
  const { t, move, height, line } = frame;
  const from = relative(segment, move.from);
  const to = nearest(from, relative(segment, move.to));
  const rotate = t.interpolate({
    inputRange: [0, 1],
    outputRange: [`${from}deg`, `${to}deg`],
  });
  const length = LENGTH[segment] * height;
  return (
    <Animated.View style={[styles.joint, { transform: [{ rotate }] }]}>
      {segment === "head" ? (
        <View
          style={[
            styles.part,
            {
              left: -length / 2,
              top: 0,
              width: length,
              height: length,
              borderRadius: length / 2,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.part,
            {
              left: -line / 2,
              top: -line / 2,
              width: line,
              height: length + line,
              borderRadius: line / 2,
              opacity: far ? FAR_OPACITY : 1,
            },
          ]}
        />
      )}
      {children !== undefined && (
        <View style={[styles.joint, { top: length }]}>{children}</View>
      )}
    </Animated.View>
  );
}

export function Figure({ pose, height, mirrored = false, testID }: Props) {
  const [t] = useState(() => new Animated.Value(1));
  const [move, setMove] = useState<Move>({ from: pose, to: pose });
  // A new pose: from where the figure is to where it goes, from this render.
  if (pose !== move.to) {
    setMove({ from: move.to, to: pose });
  }

  useEffect(() => {
    if (move.from === move.to) {
      return;
    }
    t.setValue(0);
    const turning = Animated.timing(t, {
      toValue: 1,
      duration: POSE_MS,
      easing: Easing.inOut(Easing.quad),
      useNativeDriver: true,
    });
    turning.start();
    return () => turning.stop();
  }, [move, t]);

  const line = LINE_SHARE * height;
  const limb = { t, move, height, line };

  // The hip rises and falls with the pose: a kneeling figure sits lower.
  const lift = t.interpolate({
    inputRange: [0, 1],
    outputRange: [-grounding(move.from) * height, -grounding(move.to) * height],
  });
  const shoulders = -LENGTH.torso * height * (1 - SHOULDER_SHARE);

  return (
    <View
      style={[styles.stage, { height, transform: [{ scaleX: mirrored ? -1 : 1 }] }]}
      testID={testID}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <Animated.View style={[styles.hip, { transform: [{ translateY: lift }] }]}>
        <Limb segment="thighFar" frame={limb} far>
          <Limb segment="shinFar" frame={limb} far>
            <Limb segment="footFar" frame={limb} far />
          </Limb>
        </Limb>
        <Limb segment="torso" frame={limb}>
          <View style={[styles.joint, { top: shoulders }]}>
            <Limb segment="upperArmFar" frame={limb} far>
              <Limb segment="forearmFar" frame={limb} far />
            </Limb>
          </View>
          <Limb segment="head" frame={limb} />
          <View style={[styles.joint, { top: shoulders }]}>
            <Limb segment="upperArmNear" frame={limb}>
              <Limb segment="forearmNear" frame={limb} />
            </Limb>
          </View>
        </Limb>
        <Limb segment="thighNear" frame={limb}>
          <Limb segment="shinNear" frame={limb}>
            <Limb segment="footNear" frame={limb} />
          </Limb>
        </Limb>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignSelf: "stretch",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  // The hip, at the floor until lifted by the pose.
  hip: {
    width: 0,
    height: 0,
  },
  joint: {
    position: "absolute",
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  },
  part: {
    position: "absolute",
    backgroundColor: color.text,
  },
});
