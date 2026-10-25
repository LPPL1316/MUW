import { CONTACT_HASHES_MAX } from "@shaperoute/shared-types";
import found from "@shaperoute/shared-types/fixtures/contacts-people.json";
import request from "@shaperoute/shared-types/fixtures/contacts-people-request.json";

import { answers, apiError } from "../account/testing";
import {
  batches,
  CONTACT_BATCHES_MAX,
  findContactsPeople,
  isContactsPeople,
} from "./contactsPeople";

const URL = "http://api";
const TOKEN = "the-token";
const [ada, adam] = found.people;

function hashes(count: number): string[] {
  return Array.from({ length: count }, (_, i) => i.toString(16).padStart(64, "0"));
}

test("the example of the API is what the app reads", () => {
  expect(isContactsPeople(found)).toBe(true);
  expect(isContactsPeople({ people: [] })).toBe(true);
  expect(isContactsPeople({ people: [{ ...ada, follow: "maybe" }] })).toBe(false);
  expect(isContactsPeople({ people: [{ ...ada, follow: undefined }] })).toBe(false);
  expect(isContactsPeople(null)).toBe(false);
});

test("the hashes go in groups the API takes, and only so many groups", () => {
  expect(batches([])).toEqual([]);
  expect(batches(hashes(CONTACT_HASHES_MAX)).map((g) => g.length)).toEqual([
    CONTACT_HASHES_MAX,
  ]);
  expect(batches(hashes(CONTACT_HASHES_MAX + 1)).map((g) => g.length)).toEqual([
    CONTACT_HASHES_MAX,
    1,
  ]);
  expect(batches(hashes(CONTACT_HASHES_MAX * (CONTACT_BATCHES_MAX + 2)))).toHaveLength(
    CONTACT_BATCHES_MAX,
  );
});

test("a look sends only the hashes, with the token, and reads the members", async () => {
  const fetchFn: jest.Mock = answers({ status: 200, body: found });
  const outcome = await findContactsPeople(URL, TOKEN, request.hashes, {
    fetchFn,
    key: null,
  });
  expect(outcome).toEqual({ kind: "ok", value: found });
  const [url, init] = fetchFn.mock.calls[0];
  expect(url).toBe("http://api/people/from-contacts");
  expect(init).toMatchObject({
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  expect(JSON.parse(init.body)).toEqual(request);
});

test("the members of every group are shown once, by name", async () => {
  const fetchFn: jest.Mock = answers(
    { status: 200, body: { people: [adam, ada] } },
    { status: 200, body: { people: [{ ...ada, follow: "following" }] } },
  );
  const outcome = await findContactsPeople(URL, TOKEN, hashes(CONTACT_HASHES_MAX + 3), {
    fetchFn,
    key: null,
  });
  expect(fetchFn).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetchFn.mock.calls[1][1].body).hashes).toHaveLength(3);
  expect(outcome).toEqual({
    kind: "ok",
    value: { people: [{ ...ada, follow: "following" }, adam] },
  });
});

test("a group that fails stops the look and is its answer", async () => {
  const fetchFn: jest.Mock = answers({
    status: 429,
    body: apiError("too_many_requests"),
    headers: { "Retry-After": "600" },
  });
  const outcome = await findContactsPeople(URL, TOKEN, hashes(CONTACT_HASHES_MAX * 2), {
    fetchFn,
    key: null,
  });
  expect(fetchFn).toHaveBeenCalledTimes(1);
  expect(outcome).toMatchObject({ kind: "api_error", code: "too_many_requests" });
});
