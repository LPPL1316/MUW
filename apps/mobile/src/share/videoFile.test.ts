/// <reference types="node" />

import { bytesOfBase64, pageMessageOf, samplesOf, videoProblem } from "./videoFile";

describe("bytesOfBase64", () => {
  it("reads every length back, with or without padding", () => {
    for (let length = 0; length < 40; length += 1) {
      const bytes = Array.from({ length }, (_, i) => (i * 37 + 11) & 0xff);
      const text = Buffer.from(bytes).toString("base64");
      expect(Array.from(bytesOfBase64(text))).toEqual(bytes);
      expect(Array.from(bytesOfBase64(text.replace(/=+$/, "")))).toEqual(bytes);
    }
  });

  it("reads every byte value", () => {
    const bytes = Array.from({ length: 256 }, (_, i) => i);
    expect(Array.from(bytesOfBase64(Buffer.from(bytes).toString("base64")))).toEqual(
      bytes,
    );
  });

  it("refuses what is not base64", () => {
    expect(() => bytesOfBase64("ab$d")).toThrow();
  });
});

describe("pageMessageOf", () => {
  it("reads the page's messages and nothing else", () => {
    expect(pageMessageOf('{"type":"ready","codec":null}')).toEqual({
      type: "ready",
      codec: null,
    });
    expect(pageMessageOf("not json")).toBeNull();
    expect(pageMessageOf("[1,2]")).toBeNull();
    expect(pageMessageOf('{"codec":"x"}')).toBeNull();
  });
});

describe("samplesOf", () => {
  it("gives each picture its bytes, its time and whether it is a key", () => {
    const samples = samplesOf({
      type: "chunks",
      list: [
        { key: true, time: 0, data: Buffer.from([1, 2, 3]).toString("base64") },
        { key: false, time: 33_333, data: Buffer.from([4]).toString("base64") },
      ],
    });
    expect(samples.map((s) => [Array.from(s.data), s.time, s.key])).toEqual([
      [[1, 2, 3], 0, true],
      [[4], 33_333, false],
    ]);
  });
});

describe("videoProblem", () => {
  it("says nothing when shared, and why otherwise", () => {
    expect(videoProblem("shared")).toBeNull();
    expect(videoProblem("unsupported")).toBe("This phone cannot make the video.");
    expect(videoProblem("failed")).toBe("The video could not be made. Try again.");
    expect(videoProblem("no_sharing")).toBe("This phone cannot open the share sheet.");
  });
});
