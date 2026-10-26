import assert from "node:assert/strict";
import { test } from "node:test";

import passwordReset from "../fixtures/password-reset-request.json" with { type: "json" };
import session from "../fixtures/session.json" with { type: "json" };
import {
  type AccountEmailService,
  type PasswordResetRequest,
  type Session,
} from "../src/index.ts";

// The same JSON is validated by the API's test_account_email.py (TASK-300).
const reset: PasswordResetRequest = {
  ...passwordReset,
  language: passwordReset.language === "it" ? "it" : undefined,
};
const signedIn: Session = { ...session, user: { ...session.user, role: "user" } };

test("a new account's address waits for its link, and nothing else waits", () => {
  assert.equal(signedIn.user.email_confirmed, false);
  assert.equal(signedIn.user.pending_email, null);
});

test("a new password is asked for with the address alone", () => {
  assert.deepEqual(Object.keys(reset).sort(), ["email", "language"]);
  assert.equal(reset.email, signedIn.user.email);
  // A User of an API older than TASK-300 says nothing of its address.
  const { email_confirmed: _no, pending_email: _none, ...before } = signedIn.user;
  const old: Session = { ...signedIn, user: before };
  assert.equal(old.user.email_confirmed, undefined);
});

test("the server says it sends these emails, and nothing more", () => {
  const on: AccountEmailService = { on: true };
  assert.deepEqual(Object.keys(on), ["on"]);
});
