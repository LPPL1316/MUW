import request from "@shaperoute/shared-types/fixtures/contacts-people-request.json";

import { contactHashes } from "./contactHashes";

test("the same number written in different ways leaves the phone once, hashed", () => {
  const hashes = contactHashes(
    ["+39 333 123 4567", "333 1234567", "0039-333-123-4567", "(555) 123-4567"],
    "IT",
  );
  // The two numbers of the API's example, the second read as Italian.
  expect(hashes).toHaveLength(2);
  expect(hashes[0]).toBe(request.hashes[0]);
  expect(hashes.every((hash) => /^[0-9a-f]{64}$/.test(hash))).toBe(true);
});

test("nothing of a number written as is leaves the phone", () => {
  const hashes = contactHashes(["+39 333 123 4567", "+1 555 123 4567"], "US");
  expect(hashes).toEqual(request.hashes);
  for (const hash of hashes) {
    expect(hash).not.toMatch(/3331234567|5551234567/);
  }
});

test("a number that cannot be read stays out", () => {
  expect(contactHashes(["112", "*21#", "", "333 123 4567"], null)).toEqual([]);
});
