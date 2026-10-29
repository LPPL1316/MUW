import assert from "node:assert/strict";
import { test } from "node:test";

import newAccount from "../fixtures/new-account-error.json" with { type: "json" };
import request from "../fixtures/provider-sign-in-request.json" with { type: "json" };
import providers from "../fixtures/sign-in-providers.json" with { type: "json" };
import signUp from "../fixtures/sign-up-request.json" with { type: "json" };
import {
  API_ERROR_CODES,
  type NewAccountError,
  type ProviderSignInRequest,
  SIGN_IN_PROVIDERS,
  type SignInProvider,
  type SignInProviders,
} from "../src/index.ts";

// «Continue with Apple» and «Continue with Google» (TASK-322, ADR-0282).
// The same JSON is validated by the API's test_sign_in_providers.py.
function provider(value: string): SignInProvider {
  const found = SIGN_IN_PROVIDERS.find((p) => p === value);
  assert.ok(found, value);
  return found;
}

test("the providers are Apple and Google, each listed once", () => {
  const listed: SignInProviders = { providers: providers.providers.map(provider) };
  assert.deepEqual(listed.providers, ["apple", "google"]);
});

test("a new account sends what a sign-up does, without email and password", () => {
  // JSON reads the language as any string: the app sends one of PushLanguage.
  const sent: ProviderSignInRequest = { ...request, language: "en" };
  assert.ok(sent.id_token.length > 0);
  assert.equal(sent.username, signUp.username);
  assert.equal(sent.at_least_16, true);
  assert.equal(sent.away_email, signUp.away_email);
  assert.equal("email" in sent, false);
  assert.equal("password" in sent, false);
  // Signing in again sends the token alone (Apple: and its code and nonce).
  const again: ProviderSignInRequest = { id_token: sent.id_token };
  assert.deepEqual(Object.keys(again), ["id_token"]);
});

test("the 404 of a new account carries the email to show", () => {
  const answer: NewAccountError = {
    error: { ...newAccount.error, code: "new_account" },
  };
  assert.equal(answer.error.email, "abc123@privaterelay.appleid.com");
  assert.ok(API_ERROR_CODES.includes("new_account"));
  assert.ok(API_ERROR_CODES.includes("provider_unavailable"));
});
