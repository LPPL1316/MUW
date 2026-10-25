import { toE164 } from "./phoneNumbers";
import { sha256Hex } from "./sha256";

/**
 * What leaves the phone of its contacts (TASK-262 C, ADR-0226): for each
 * number that reads as one, the SHA-256 of it in E.164, each once. Never a
 * name, never a number as written; the numbers that cannot be read stay
 * out.
 */
export function contactHashes(
  numbers: readonly string[],
  region: string | null,
): string[] {
  const kept = new Set<string>();
  for (const written of numbers) {
    const e164 = toE164(written, region);
    if (e164 !== null) {
      kept.add(e164);
    }
  }
  return [...kept].map(sha256Hex);
}
