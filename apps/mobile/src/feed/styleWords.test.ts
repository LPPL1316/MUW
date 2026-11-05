import { LANGUAGES } from "../i18n/languages";
import {
  styleDay,
  stylePrice,
  stylePriceLine,
  styleShopLabel,
  styleWords,
} from "./styleWords";

test("the two labels say AI and advertising in every language", () => {
  expect(LANGUAGES.map(({ id }) => styleWords(id).adLabel)).toEqual([
    "Ad · Affiliate links",
    "Werbung · Affiliate-Links",
    "Pubblicità · Link affiliati",
    "Publicidad · Enlaces de afiliado",
    "Publicité · Liens affiliés",
  ]);
  for (const { id } of LANGUAGES) {
    expect(styleWords(id).aiLabel).toMatch(/AI|IA|KI/);
    expect(styleWords(id).lens).toBe("Style");
    expect(styleWords(id).months).toHaveLength(12);
  }
});

test("a price with the day it was read", () => {
  const tag = { price_eur: 84.99, price_seen_on: "2026-11-18" };
  expect(stylePriceLine(tag, "en")).toBe("€84.99 on 18 Nov");
  expect(stylePriceLine(tag, "it")).toBe("84,99 € il 18 nov");
  expect(stylePriceLine(tag, "de")).toBe("84,99 € am 18. Nov.");
  expect(stylePrice(5, "fr")).toBe("5,00 €");
  expect(styleDay("2026-03-01", "es")).toBe("1 mar");
});

test("a price not read in the last 7 days is not said", () => {
  expect(stylePriceLine({ price_eur: null, price_seen_on: null }, "en")).toBe(
    "See price",
  );
  expect(stylePriceLine({ price_eur: null, price_seen_on: null }, "it")).toBe(
    "Vedi il prezzo",
  );
});

test("«Shop» names the shop", () => {
  expect(styleShopLabel("zalando", "en")).toBe("Shop on Zalando");
  expect(styleShopLabel("amazon", "it")).toBe("Compra su Amazon");
  expect(styleShopLabel("decathlon", "de")).toBe("Bei Decathlon kaufen");
});
