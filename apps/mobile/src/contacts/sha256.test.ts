import { createHash } from "node:crypto";

import { sha256Hex, utf8 } from "./sha256";

describe("sha256Hex", () => {
  it("gives the values of the standard (FIPS 180-4 examples)", () => {
    expect(sha256Hex("")).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
    expect(sha256Hex("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
    expect(sha256Hex("abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")).toBe(
      "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1",
    );
  });

  it("is the same as Node's for phone numbers and every length around a block", () => {
    const texts = ["+393331234567", "+15551234567", "+4915112345678"];
    for (let length = 50; length <= 130; length++) {
      texts.push("7".repeat(length));
    }
    for (const text of texts) {
      expect(sha256Hex(text)).toBe(createHash("sha256").update(text).digest("hex"));
    }
  });

  it("reads a text as UTF-8, as PostgreSQL's convert_to does", () => {
    for (const text of ["è", "€", "😀 run"]) {
      expect(Array.from(utf8(text))).toEqual(Array.from(Buffer.from(text, "utf8")));
      expect(sha256Hex(text)).toBe(
        createHash("sha256").update(text, "utf8").digest("hex"),
      );
    }
  });
});
