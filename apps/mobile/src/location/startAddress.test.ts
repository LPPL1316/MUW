import type { LatLon } from "@shaperoute/shared-types";
import { act, renderHook } from "@testing-library/react-native";

import {
  type Address,
  addressLine,
  metresBetween,
  useStartAddress,
} from "./startAddress";

jest.mock("expo-location", () => ({ reverseGeocodeAsync: jest.fn() }));

const empty: Address = {
  street: null,
  streetNumber: null,
  name: null,
  city: null,
  district: null,
  subregion: null,
};

test("the street and the town, no house number", () => {
  expect(
    addressLine({
      ...empty,
      street: "Via Roma",
      streetNumber: "12",
      city: "Levico Terme",
    }),
  ).toBe("Via Roma, Levico Terme");
});

test("without a street, the place's name; without a town, the district", () => {
  expect(addressLine({ ...empty, name: "Parco Asburgico", district: "Levico" })).toBe(
    "Parco Asburgico, Levico",
  );
  // iOS names a point by its house number alone: not a name.
  expect(addressLine({ ...empty, name: "12", city: "Trento" })).toBe("Trento");
  expect(addressLine({ ...empty, street: "Trento", city: "Trento" })).toBe("Trento");
  expect(addressLine(empty)).toBeNull();
});

test("metres between two close points", () => {
  expect(metresBetween([46.0, 11.0], [46.001, 11.0])).toBeCloseTo(111, 0);
});

const levico: LatLon = [46.0122, 11.2986];

test("asks once, and not again for a GPS that moves a few metres", async () => {
  const geocode = jest.fn(async () => [
    { ...empty, street: "Via Roma", city: "Levico" },
  ]);
  const { result, rerender } = await renderHook(
    ({ point }: { point: LatLon | null }) => useStartAddress(point, geocode),
    { initialProps: { point: levico } },
  );
  await act(async () => {});
  expect(result.current).toBe("Via Roma, Levico");
  await rerender({ point: [levico[0] + 0.0002, levico[1]] });
  await act(async () => {});
  expect(geocode).toHaveBeenCalledTimes(1);
  // 220 m further: a new question.
  await rerender({ point: [levico[0] + 0.002, levico[1]] });
  await act(async () => {});
  expect(geocode).toHaveBeenCalledTimes(2);
});

test("no answer, or no start: no name", async () => {
  const geocode = jest.fn(async () => {
    throw new Error("no network");
  });
  const { result, rerender } = await renderHook(
    ({ point }: { point: LatLon | null }) => useStartAddress(point, geocode),
    { initialProps: { point: levico as LatLon | null } },
  );
  await act(async () => {});
  expect(result.current).toBeNull();
  await rerender({ point: null });
  expect(result.current).toBeNull();
});
