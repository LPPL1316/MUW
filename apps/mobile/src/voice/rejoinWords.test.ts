import { LANGUAGES } from "../i18n/languages";
import { PHRASEBOOKS, wordsOf } from "./words";

/**
 * Off the route, where it is (TASK-303): the distance as the turns say it,
 * rounded to 10 m or, with miles, in feet; the way as the nearest of the
 * eight points of the compass.
 */

test("in each language, the route's distance and its way", () => {
  expect(wordsOf("en", "km").routeAt(118, 45)).toBe(
    "The route is 120 metres away, to the north-east.",
  );
  expect(wordsOf("it", "km").routeAt(118, 45)).toBe(
    "Il percorso riprende a 120 metri verso nord-est.",
  );
  expect(wordsOf("es", "km").routeAt(118, 45)).toBe(
    "La ruta sigue a 120 metros, hacia el noreste.",
  );
  expect(wordsOf("fr", "km").routeAt(118, 45)).toBe(
    "Le parcours reprend à 120 mètres, direction nord-est.",
  );
  expect(wordsOf("de", "km").routeAt(118, 45)).toBe(
    "Die Route ist 120 Meter entfernt, Richtung Nordosten.",
  );
});

test("with miles, in feet", () => {
  expect(wordsOf("en", "mi").routeAt(118, 180)).toBe(
    "The route is 400 feet away, to the south.",
  );
  expect(wordsOf("it", "mi").routeAt(118, 180)).toBe(
    "Il percorso riprende a 400 piedi verso sud.",
  );
  expect(wordsOf("es", "mi").routeAt(118, 180)).toBe(
    "La ruta sigue a 400 pies, hacia el sur.",
  );
  expect(wordsOf("fr", "mi").routeAt(118, 180)).toBe(
    "Le parcours reprend à 400 pieds, direction sud.",
  );
  expect(wordsOf("de", "mi").routeAt(118, 180)).toBe(
    "Die Route ist 400 Fuß entfernt, Richtung Süden.",
  );
});

test("the nearest point of the compass, all round", () => {
  const words = wordsOf("en", "km");
  const way = (deg: number) => /to the (.*)\.$/.exec(words.routeAt(100, deg))?.[1];
  expect(way(0)).toBe("north");
  expect(way(22)).toBe("north");
  expect(way(23)).toBe("north-east");
  expect(way(90)).toBe("east");
  expect(way(135)).toBe("south-east");
  expect(way(200)).toBe("south");
  expect(way(225)).toBe("south-west");
  expect(way(270)).toBe("west");
  expect(way(315)).toBe("north-west");
  expect(way(359)).toBe("north");
  expect(way(-90)).toBe("west");
});

test("every language has the eight points, all different", () => {
  expect(Object.keys(PHRASEBOOKS)).toHaveLength(LANGUAGES.length);
  for (const { compass } of Object.values(PHRASEBOOKS)) {
    expect(compass).toHaveLength(8);
    expect(new Set(compass).size).toBe(8);
  }
});
