import {
  Fragment,
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Animated, Modal, StyleSheet, useWindowDimensions } from "react-native";

import { fadeTo, springTo } from "./motion";
import { useReduceMotion } from "./useReduceMotion";

type Props = {
  visible: boolean;
  /** Android's back, as the Modal's own. */
  onRequestClose: () => void;
  /** Down and gone: nothing of the sheet is left on screen. */
  onHidden?: () => void;
  /** iOS: the Modal itself is gone, as the Modal's own (TASK-358). */
  onDismiss?: () => void;
  testID?: string;
  children: ReactNode;
};

/**
 * A sheet from the bottom (TASK-388 C, ADR-0329): a clear `Modal` whose
 * content comes up on the spring `smooth` and goes down the same way,
 * instead of the fixed curve of `animationType="slide"`. Closed half way up,
 * it goes back down from where it is, with its speed; opened again on its
 * way down, it comes back up, with its content new. The Modal stays until the sheet is down, so
 * `visible` false plays the way out; `onHidden` follows it. While it goes,
 * its buttons take no more touches. With «Reduce Motion» it only fades.
 */
export function SheetModal({
  visible,
  onRequestClose,
  onHidden,
  onDismiss,
  testID,
  children,
}: Props) {
  const still = useReduceMotion();
  const { height } = useWindowDimensions();
  const [up] = useState(() => new Animated.Value(0));
  // On screen from the moment it opens until it is down.
  const [shown, setShown] = useState(visible);
  // Each opening, a new content: opened again on its way down, it starts
  // from the beginning too, as a sheet just opened.
  const [round, setRound] = useState(0);
  const [was, setWas] = useState(visible);
  if (visible !== was) {
    setWas(visible);
    if (visible) {
      setShown(true);
      setRound(round + 1);
    }
  }
  // The newest `onHidden`, without moving the sheet again.
  const hidden = useRef(onHidden);
  useEffect(() => {
    hidden.current = onHidden;
  }, [onHidden]);

  useLayoutEffect(() => {
    if (!shown) {
      return;
    }
    const to = visible ? 1 : 0;
    const move = still ? fadeTo(up, to) : springTo(up, to, "smooth");
    move.start(({ finished }) => {
      if (finished && !visible) {
        setShown(false);
        hidden.current?.();
      }
    });
    return () => move.stop();
  }, [visible, shown, still, up]);

  const look = still
    ? { opacity: up }
    : {
        transform: [
          {
            translateY: up.interpolate({
              inputRange: [0, 1],
              outputRange: [height, 0],
            }),
          },
        ],
      };
  return (
    <Modal
      visible={shown}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onRequestClose}
      onDismiss={onDismiss}
    >
      <Animated.View
        testID={testID}
        style={[styles.fill, look]}
        pointerEvents={visible ? "auto" : "none"}
      >
        <Fragment key={round}>{children}</Fragment>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
});
