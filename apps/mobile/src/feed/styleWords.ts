import type { StyleGender, StyleTag, StyleTheme } from "@shaperoute/shared-types";

import { appLanguage } from "../i18n/language";
import type { Language } from "../i18n/languages";

/**
 * The words of MuW Style (TASK-384, ADR-0326), as the user approved them on
 * 2026-11-04 in five languages (`docs/tasks/TASK-384.md`, «Testi
 * approvati»). Kept here, not in the tables of `t`: those go by the English
 * text, and «Running», «Bike» or «Women» are already other words there.
 */
type Words = {
  aiLabel: string;
  adLabel: string;
  /** `{store}`: Zalando, Amazon, Decathlon. */
  shop: string;
  /** `{price}` formatted, `{date}` day and month. */
  priceOn: string;
  seePrice: string;
  photoLine: string;
  linkLine: string;
  lens: string;
  themes: Readonly<Record<StyleTheme, string>>;
  genders: Readonly<Record<StyleGender, string>>;
  empty: string;
  settingTitle: string;
  settingNote: string;
  /** Short names of the months, January first: for `{date}`. */
  months: readonly string[];
};

const WORDS: Readonly<Record<Language, Words>> = {
  en: {
    aiLabel: "AI-generated",
    adLabel: "Ad · Affiliate links",
    shop: "Shop on {store}",
    priceOn: "{price} on {date}",
    seePrice: "See price",
    photoLine:
      "The photo is AI-generated: the item shown is similar, not the exact product.",
    linkLine:
      "If you buy through this link, MuW earns a commission. The price for you stays the same.",
    lens: "Style",
    themes: {
      running: "Running",
      trail: "Trail",
      bike: "Bike",
      gym: "Gym",
      athleisure: "Athleisure",
    },
    genders: { women: "Women", men: "Men" },
    empty: "No Style posts yet.",
    settingTitle: "Style posts in the Feed",
    settingNote: "Outfits made with AI, with links to shops. They stay in Style.",
    months: [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ],
  },
  it: {
    aiLabel: "Generata con l'AI",
    adLabel: "Pubblicità · Link affiliati",
    shop: "Compra su {store}",
    priceOn: "{price} il {date}",
    seePrice: "Vedi il prezzo",
    photoLine:
      "La foto è generata con l'AI: il capo che vedi è simile, non è esattamente il prodotto.",
    linkLine:
      "Se compri da questo link, MuW riceve una commissione. Per te il prezzo non cambia.",
    lens: "Style",
    themes: {
      running: "Corsa",
      trail: "Trail",
      bike: "Bici",
      gym: "Palestra",
      athleisure: "Tempo libero",
    },
    genders: { women: "Donna", men: "Uomo" },
    empty: "Ancora nessun post Style.",
    settingTitle: "Post Style nel Feed",
    settingNote: "Outfit fatti con l'AI, con i link ai negozi. Restano in Style.",
    months: [
      "gen",
      "feb",
      "mar",
      "apr",
      "mag",
      "giu",
      "lug",
      "ago",
      "set",
      "ott",
      "nov",
      "dic",
    ],
  },
  de: {
    aiLabel: "KI-generiert",
    adLabel: "Werbung · Affiliate-Links",
    shop: "Bei {store} kaufen",
    priceOn: "{price} am {date}",
    seePrice: "Preis ansehen",
    photoLine:
      "Das Foto ist KI-generiert: Das gezeigte Teil ist ähnlich, nicht genau das Produkt.",
    linkLine:
      "Wenn du über diesen Link kaufst, erhält MuW eine Provision. Für dich bleibt der Preis gleich.",
    lens: "Style",
    themes: {
      running: "Laufen",
      trail: "Trail",
      bike: "Rad",
      gym: "Gym",
      athleisure: "Freizeit",
    },
    genders: { women: "Damen", men: "Herren" },
    empty: "Noch keine Style-Beiträge.",
    settingTitle: "Style-Beiträge im Feed",
    settingNote: "Mit KI erstellte Outfits, mit Links zu Shops. Sie bleiben in Style.",
    months: [
      "Jan.",
      "Feb.",
      "März",
      "Apr.",
      "Mai",
      "Juni",
      "Juli",
      "Aug.",
      "Sept.",
      "Okt.",
      "Nov.",
      "Dez.",
    ],
  },
  fr: {
    aiLabel: "Générée par IA",
    adLabel: "Publicité · Liens affiliés",
    shop: "Acheter sur {store}",
    priceOn: "{price} le {date}",
    seePrice: "Voir le prix",
    photoLine:
      "La photo est générée par IA : l'article montré est similaire, pas exactement le produit.",
    linkLine:
      "Si tu achètes via ce lien, MuW reçoit une commission. Pour toi, le prix ne change pas.",
    lens: "Style",
    themes: {
      running: "Course",
      trail: "Trail",
      bike: "Vélo",
      gym: "Salle",
      athleisure: "Loisirs",
    },
    genders: { women: "Femme", men: "Homme" },
    empty: "Pas encore de posts Style.",
    settingTitle: "Posts Style dans le Feed",
    settingNote:
      "Des tenues créées par IA, avec des liens vers les boutiques. Elles restent dans Style.",
    months: [
      "janv.",
      "févr.",
      "mars",
      "avr.",
      "mai",
      "juin",
      "juil.",
      "août",
      "sept.",
      "oct.",
      "nov.",
      "déc.",
    ],
  },
  es: {
    aiLabel: "Generada con IA",
    adLabel: "Publicidad · Enlaces de afiliado",
    shop: "Comprar en {store}",
    priceOn: "{price} el {date}",
    seePrice: "Ver el precio",
    photoLine:
      "La foto está generada con IA: la prenda que ves es parecida, no es exactamente el producto.",
    linkLine:
      "Si compras desde este enlace, MuW recibe una comisión. Para ti el precio no cambia.",
    lens: "Style",
    themes: {
      running: "Correr",
      trail: "Trail",
      bike: "Bici",
      gym: "Gimnasio",
      athleisure: "Tiempo libre",
    },
    genders: { women: "Mujer", men: "Hombre" },
    empty: "Todavía no hay publicaciones Style.",
    settingTitle: "Publicaciones Style en el Feed",
    settingNote: "Outfits creados con IA, con enlaces a tiendas. Siguen en Style.",
    months: [
      "ene",
      "feb",
      "mar",
      "abr",
      "may",
      "jun",
      "jul",
      "ago",
      "sept",
      "oct",
      "nov",
      "dic",
    ],
  },
};

/** The words of Style in `language`, the app's when none is given. */
export function styleWords(language: Language = appLanguage()): Words {
  return WORDS[language];
}

/** The name of the shop, as the shop writes it. */
export const STORE_NAMES: Readonly<Record<StyleTag["retailer"], string>> = {
  zalando: "Zalando",
  amazon: "Amazon",
  decathlon: "Decathlon",
};

/** «84.99» as a price: «€84.99» in English, «84,99 €» in the others. */
export function stylePrice(eur: number, language: Language = appLanguage()): string {
  const amount = eur.toFixed(2);
  return language === "en" ? `€${amount}` : `${amount.replace(".", ",")} €`;
}

/** «2026-11-18» as a day and a month: «18 Nov», «18 nov», «18. Nov.». */
export function styleDay(day: string, language: Language = appLanguage()): string {
  const [, month, date] = day.split("-").map(Number);
  const name = WORDS[language].months[month - 1] ?? "";
  return language === "de" ? `${date}. ${name}` : `${date} ${name}`;
}

/** What the sheet says of the price: when it was read, or «See price». */
export function stylePriceLine(
  tag: Pick<StyleTag, "price_eur" | "price_seen_on">,
  language: Language = appLanguage(),
): string {
  const words = WORDS[language];
  if (tag.price_eur === null || tag.price_seen_on === null) {
    return words.seePrice;
  }
  return words.priceOn
    .replace("{price}", stylePrice(tag.price_eur, language))
    .replace("{date}", styleDay(tag.price_seen_on, language));
}

/** «Shop on Zalando», in the app's language. */
export function styleShopLabel(
  retailer: StyleTag["retailer"],
  language: Language = appLanguage(),
): string {
  return WORDS[language].shop.replace("{store}", STORE_NAMES[retailer]);
}
