import { tapTarget } from "./notificationTap";

// A private message's notification opens the conversation with who wrote
// (TASK-319); the data is a follow event's, a profile.

const ada = { public_id: "8c1f7a52-3d4e-4b9a-9f61-2a7c0e5d9b13", username: "Ada_runs" };

test("a message and a message request open the conversation", () => {
  for (const kind of ["message", "message_request"]) {
    expect(tapTarget({ kind, ...ada })).toEqual({
      kind: "conversation",
      person: { ...ada, photo: null },
    });
  }
});

test("a follow event still opens the profile, and a bad id nothing", () => {
  expect(tapTarget({ kind: "follow_request", ...ada })).toEqual({
    kind: "profile",
    person: { ...ada, photo: null },
  });
  expect(tapTarget({ kind: "message", public_id: "nope", username: "x" })).toBeNull();
});
