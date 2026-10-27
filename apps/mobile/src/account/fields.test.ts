import signUpRequest from "@shaperoute/shared-types/fixtures/sign-up-request.json";

import { checkSignIn, checkSignUp, type SignUpFields } from "./fields";

const FIELDS: SignUpFields = {
  email: signUpRequest.email,
  username: signUpRequest.username,
  password: signUpRequest.password,
  atLeast16: true,
  noAwayEmail: false,
};

test("good fields make the contract's request, trimmed", () => {
  expect(checkSignUp(FIELDS)).toEqual({ ok: true, request: signUpRequest });
  expect(
    checkSignUp({
      ...FIELDS,
      email: `  ${FIELDS.email} `,
      username: ` ${FIELDS.username}`,
    }),
  ).toEqual({ ok: true, request: signUpRequest });
  // The box «Don't send me these emails» ticked; the app's language goes
  // either way, for the emails (TASK-284).
  expect(checkSignUp({ ...FIELDS, noAwayEmail: true })).toEqual({
    ok: true,
    request: { ...signUpRequest, away_email: false },
  });
});

test.each([
  [{ email: "runner" }, "Enter an email address, like name@example.com."],
  [{ email: "runner@example" }, "Enter an email address, like name@example.com."],
  [
    { email: `${"a".repeat(250)}@x.it` },
    "Enter an email address, like name@example.com.",
  ],
  [{ username: "ab" }, "A username is 3 to 20 letters, digits, _ or . (no spaces)."],
  [
    { username: "run ner" },
    "A username is 3 to 20 letters, digits, _ or . (no spaces).",
  ],
  [
    { username: "a".repeat(21) },
    "A username is 3 to 20 letters, digits, _ or . (no spaces).",
  ],
  [{ password: "short" }, "A password is at least 8 characters."],
  [{ password: "x".repeat(129) }, "A password is at most 128 characters."],
  [{ atLeast16: false }, "You must be at least 16 to sign up."],
])("signing up with %j says: %s", (change, problem) => {
  expect(checkSignUp({ ...FIELDS, ...change })).toEqual({ ok: false, problem });
});

test("the first wrong field is the one told", () => {
  expect(
    checkSignUp({
      email: "",
      username: "",
      password: "",
      atLeast16: false,
      noAwayEmail: false,
    }),
  ).toEqual({
    ok: false,
    problem: "Enter an email address, like name@example.com.",
  });
});

test("logging in only needs both fields: the API judges them", () => {
  expect(checkSignIn({ email: " Runner@Example.com ", password: "x" })).toEqual({
    ok: true,
    request: { email: "Runner@Example.com", password: "x" },
  });
  expect(checkSignIn({ email: " ", password: "x" })).toEqual({
    ok: false,
    problem: "Enter the email of your account.",
  });
  expect(checkSignIn({ email: "a@b.it", password: "" })).toEqual({
    ok: false,
    problem: "Enter your password.",
  });
});
