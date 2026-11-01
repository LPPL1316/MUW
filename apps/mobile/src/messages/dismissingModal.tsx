import { type ReactNode, useEffect, useRef } from "react";

/**
 * For tests only: a Modal as iOS has it, which says it has gone once
 * `visible` turns false. React Native's own mock of the Modal never does, and
 * what the «+» opens waits for that (AttachButton.tsx, TASK-358).
 */
export default function DismissingModal({
  visible,
  onDismiss,
  children,
}: {
  visible?: boolean;
  onDismiss?: () => void;
  children?: ReactNode;
}) {
  const was = useRef(visible);
  useEffect(() => {
    if (was.current === true && visible !== true) {
      onDismiss?.();
    }
    was.current = visible;
  }, [onDismiss, visible]);
  return visible === true ? children : null;
}
