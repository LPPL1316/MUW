import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

import found from "../fixtures/contacts-people.json" with { type: "json" };
import request from "../fixtures/contacts-people-request.json" with { type: "json" };
import {
  CONTACT_HASHES_MAX,
  type ContactPerson,
  type ContactsPeople,
  type ContactsPeopleRequest,
  FOLLOW_STATES,
} from "../src/index.ts";

// The same JSON is validated by the API's test_contact_people.py (TASK-262 C).
const asked: ContactsPeopleRequest = request;
const answer: ContactsPeople = {
  people: found.people.map((person): ContactPerson => ({
    ...person,
    follow: FOLLOW_STATES.find((state) => state === person.follow) ?? "none",
  })),
};

test("the request holds only hashes: SHA-256 of numbers in E.164, in hex", () => {
  assert.deepEqual(Object.keys(asked), ["hashes"]);
  assert.ok(asked.hashes.length >= 1 && asked.hashes.length <= CONTACT_HASHES_MAX);
  for (const hash of asked.hashes) {
    assert.match(hash, /^[0-9a-f]{64}$/);
  }
  // The numbers of the API's test accounts, never the numbers themselves.
  const sha = (text: string) => createHash("sha256").update(text).digest("hex");
  assert.deepEqual(asked.hashes, [sha("+393331234567"), sha("+15551234567")]);
});

test("a member found from the contacts is a person and where the asker stands", () => {
  for (const person of answer.people) {
    assert.deepEqual(Object.keys(person).sort(), [
      "follow",
      "photo",
      "public_id",
      "username",
    ]);
    assert.ok(FOLLOW_STATES.includes(person.follow));
  }
  assert.equal(answer.people[1]?.follow, found.people[1]?.follow);
});
