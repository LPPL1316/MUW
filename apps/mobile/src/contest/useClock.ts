import { useEffect, useState } from "react";

/** How often the phone's clock is read again: the last day turns into «Ends
 * today», and the end into «Ended», while the contest is on the screen. */
const CLOCK_MS = 60_000;

/** The phone's clock, read again every minute. */
export function useClock(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), CLOCK_MS);
    return () => clearInterval(timer);
  }, []);
  return now;
}
