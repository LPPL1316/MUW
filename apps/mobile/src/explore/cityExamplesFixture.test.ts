import type { LatLon } from "@shaperoute/shared-types";
import fixture from "@shaperoute/shared-types/fixtures/city-examples.json";

import {
  drawOrderOf,
  EXAMPLE_WORDS,
  requestOf,
  RUN_EXAMPLES,
  wordOrder,
  wordRequestOf,
} from "./exampleRoutes";

/**
 * A city's examples as the app asks them, in the file the API's
 * draw_examples --all asks too (TASK-316, test_draw_examples_all.py): the
 * API keeps an answer only for the same request, so the two must be one.
 */
test("the examples of a city are the requests of the shared file", () => {
  const city = { label: "Caldonazzo", point: fixture.start as LatLon };
  const asked = [
    ...drawOrderOf(RUN_EXAMPLES).map((shape) => requestOf(city, shape, RUN_EXAMPLES)),
    ...wordOrder(EXAMPLE_WORDS).map((word) => wordRequestOf(city, word, RUN_EXAMPLES)),
  ];
  expect(asked).toEqual(fixture.requests);
});
