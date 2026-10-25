import { regionOfLocale, toE164 } from "./phoneNumbers";

describe("toE164", () => {
  it("reads an Italian mobile number however it is written", () => {
    for (const written of [
      "+39 333 123 4567",
      "+393331234567",
      "0039 333 1234567",
      "333 123 4567",
      "333-123-4567",
      "(333) 123.45.67",
      "3331234567",
      "‪+39 333 123 4567‬",
      "333 123 4567",
    ]) {
      expect(toE164(written, "IT")).toBe("+393331234567");
    }
  });

  it("keeps the first 0 of an Italian landline", () => {
    expect(toE164("0461 123456", "IT")).toBe("+390461123456");
  });

  it("leaves out the prefix dialled inside the country", () => {
    expect(toE164("0151 12345678", "DE")).toBe("+4915112345678");
    expect(toE164("06 12 34 56 78", "FR")).toBe("+33612345678");
    expect(toE164("07700 900123", "GB")).toBe("+447700900123");
    expect(toE164("06 30 123 4567", "HU")).toBe("+36301234567");
    expect(toE164("8 912 345 67 89", "RU")).toBe("+79123456789");
  });

  it("reads North American numbers with or without the 1", () => {
    expect(toE164("(555) 123-4567", "US")).toBe("+15551234567");
    expect(toE164("1 555 123 4567", "US")).toBe("+15551234567");
    expect(toE164("011 39 333 123 4567", "US")).toBe("+393331234567");
  });

  it("reads Australia's prefix for abroad before the usual 00", () => {
    expect(toE164("0011 39 333 123 4567", "AU")).toBe("+393331234567");
    expect(toE164("0412 345 678", "AU")).toBe("+61412345678");
  });

  it("does not read the digits after a pause or an extension", () => {
    expect(toE164("+39 0461 123456,22", "IT")).toBe("+390461123456");
    expect(toE164("+39 0461 123456 ext. 22", "IT")).toBe("+390461123456");
    expect(toE164("+39 0461 123456;22", "IT")).toBe("+390461123456");
  });

  it("reads a number with its country code in any region, or none", () => {
    expect(toE164("+49 151 12345678", "IT")).toBe("+4915112345678");
    expect(toE164("+49 151 12345678", null)).toBe("+4915112345678");
    expect(toE164("0049 151 12345678", "ZZ")).toBe("+4915112345678");
  });

  it("does not guess the country of a number without its code in an unknown region", () => {
    expect(toE164("333 123 4567", null)).toBeNull();
    expect(toE164("333 123 4567", "ZZ")).toBeNull();
  });

  it("is null for what is not a number", () => {
    for (const written of ["", "112", "*21#", "+0 333 123 4567", "+39 333", "x"]) {
      expect(toE164(written, "IT")).toBeNull();
    }
    expect(toE164("+39 333 123 4567 890 123 45", "IT")).toBeNull();
  });
});

describe("regionOfLocale", () => {
  it("takes the region of the locale", () => {
    expect(regionOfLocale("it_IT")).toBe("IT");
    expect(regionOfLocale("en-US")).toBe("US");
    expect(regionOfLocale("zh_Hans_CN")).toBe("CN");
    expect(regionOfLocale("de_CH@calendar=gregorian")).toBe("CH");
  });

  it("is null without a region", () => {
    expect(regionOfLocale("it")).toBeNull();
    expect(regionOfLocale("")).toBeNull();
  });
});
