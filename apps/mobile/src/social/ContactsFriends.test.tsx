import found from "@shaperoute/shared-types/fixtures/contacts-people.json";
import request from "@shaperoute/shared-types/fixtures/contacts-people-request.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Session } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { Linking } from "react-native";

import { answers, apiError } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { ContactsFriends } from "./ContactsFriends";

jest.mock("expo-contacts");
// The stand-in's own controls: __mocks__/expo-contacts.ts.
const contacts = jest.requireMock("expo-contacts") as {
  phone: {
    now: { granted: boolean; canAskAgain: boolean };
    answer: { granted: boolean; canAskAgain: boolean };
    contacts: string[][];
    asked: number;
    read: number;
  };
  resetPhone: () => void;
};
const { phone } = contacts;

const URL = "http://api";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const [ada, adam] = found.people;
const FIND = "Find friends in your contacts";

async function show(
  fetchFn: jest.Mock,
  {
    state = signedIn,
    onPick = jest.fn(),
    built = true,
  }: { state?: AccountState; onPick?: jest.Mock; built?: boolean } = {},
) {
  const sessionEnded = jest.fn();
  await render(
    <ContactsFriends
      apiUrl={URL}
      account={{ state, sessionEnded }}
      onPick={onPick}
      region={() => "IT"}
      available={() => built}
      fetchFn={fetchFn}
      apiKey={null}
    />,
  );
  return sessionEnded;
}

beforeEach(() => {
  contacts.resetPhone();
});

test("the contacts are asked for only at the tap", async () => {
  const fetchFn = answers({ status: 200, body: found });
  phone.contacts = [["+39 333 123 4567"]];
  await show(fetchFn);
  expect(screen.getByText(FIND)).toBeTruthy();
  expect(phone.asked).toBe(0);
  expect(phone.read).toBe(0);
  expect(fetchFn).not.toHaveBeenCalled();

  await fireEvent.press(screen.getByText(FIND));
  expect(phone.asked).toBe(1);
  expect(phone.read).toBe(1);
  expect(await screen.findByText(ada.username)).toBeTruthy();
});

test("only the hashes of the numbers leave the phone, each once", async () => {
  const fetchFn = answers({ status: 200, body: found });
  phone.contacts = [
    ["+39 333 123 4567", "333 1234567"],
    ["0039 333-123-4567"],
    ["+1 (555) 123-4567"],
    ["112"],
  ];
  await show(fetchFn);
  await fireEvent.press(screen.getByText(FIND));
  await screen.findByText(ada.username);
  expect(fetchFn).toHaveBeenCalledTimes(1);
  const [url, init] = fetchFn.mock.calls[0];
  const body = String(init?.body);
  expect(url).toBe("http://api/people/from-contacts");
  expect(JSON.parse(body)).toEqual(request);
  expect(body).not.toMatch(/333|555|112/);
});

test("each member found has «Follow» as it stands, and opens its profile", async () => {
  const onPick = jest.fn();
  const fetchFn = answers(
    { status: 200, body: found },
    { status: 200, body: { follow: "requested" } },
  );
  phone.contacts = [["333 123 4567"]];
  await show(fetchFn, { onPick });
  await fireEvent.press(screen.getByText(FIND));
  await screen.findByText(ada.username);
  // Ada: none; Adam: requested, as the API said.
  expect(screen.getByText("Follow")).toBeTruthy();
  expect(screen.getByText("Requested")).toBeTruthy();

  await fireEvent.press(screen.getByText("Follow"));
  expect(fetchFn.mock.calls[1][0]).toBe(`http://api/users/${ada.public_id}/follow`);
  expect(await screen.findAllByText("Requested")).toHaveLength(2);

  await fireEvent.press(screen.getByLabelText(adam.username));
  expect(onPick).toHaveBeenCalledWith(
    expect.objectContaining({ public_id: adam.public_id }),
  );
});

test("nobody found says so", async () => {
  const fetchFn = answers({ status: 200, body: { people: [] } });
  phone.contacts = [["+44 7700 900123"]];
  await show(fetchFn);
  await fireEvent.press(screen.getByText(FIND));
  expect(await screen.findByText("None of your contacts is on MuW yet.")).toBeTruthy();
});

test("contacts without a number send nothing", async () => {
  const fetchFn = answers();
  phone.contacts = [[], ["*21#"]];
  await show(fetchFn);
  await fireEvent.press(screen.getByText(FIND));
  expect(await screen.findByText("No phone numbers in your contacts.")).toBeTruthy();
  expect(fetchFn).not.toHaveBeenCalled();
});

test("a no sends nothing and lets the person ask again", async () => {
  const fetchFn = answers();
  phone.answer = { granted: false, canAskAgain: true };
  phone.contacts = [["333 123 4567"]];
  await show(fetchFn);
  await fireEvent.press(screen.getByText(FIND));
  expect(await screen.findByText("MuW cannot see your contacts.")).toBeTruthy();
  expect(phone.read).toBe(0);
  expect(fetchFn).not.toHaveBeenCalled();
  expect(screen.getByText(FIND)).toBeTruthy();
  expect(screen.queryByText("Open Settings")).toBeNull();
});

test("a no for good shows «Open Settings»", async () => {
  const openSettings = jest.spyOn(Linking, "openSettings").mockResolvedValue();
  phone.now = { granted: false, canAskAgain: false };
  await show(answers());
  await fireEvent.press(screen.getByText(FIND));
  expect(await screen.findByText("MuW cannot see your contacts.")).toBeTruthy();
  expect(phone.asked).toBe(0);
  expect(screen.queryByText(FIND)).toBeNull();
  await fireEvent.press(screen.getByText("Open Settings"));
  expect(openSettings).toHaveBeenCalled();
});

test("an API without the look says so", async () => {
  const fetchFn = answers({ status: 404, body: apiError("http_error", "Not Found") });
  phone.contacts = [["333 123 4567"]];
  await show(fetchFn);
  await fireEvent.press(screen.getByText(FIND));
  expect(
    await screen.findByText("This server cannot look in your contacts yet."),
  ).toBeTruthy();
});

test("an ended session is told to the account", async () => {
  const fetchFn = answers({ status: 401, body: apiError("session_expired") });
  phone.contacts = [["333 123 4567"]];
  const sessionEnded = await show(fetchFn);
  await fireEvent.press(screen.getByText(FIND));
  await screen.findByText("Your session has ended. Log in again.");
  expect(sessionEnded).toHaveBeenCalledWith(session.token);
});

test("nobody signed in: nothing, the search says to log in", async () => {
  await show(answers(), { state: { status: "signedOut", notice: null } });
  expect(screen.queryByText(FIND)).toBeNull();
});

test("an app built without expo-contacts (the store's 1.0) shows nothing of it", async () => {
  const fetchFn = answers();
  await show(fetchFn, { built: false });
  expect(screen.queryByText("FROM YOUR CONTACTS")).toBeNull();
  expect(screen.queryByText(FIND)).toBeNull();
  expect(phone.asked).toBe(0);
  expect(phone.read).toBe(0);
  expect(fetchFn).not.toHaveBeenCalled();
});
