/**
 * Just enough XML for the files of other apps (TASK-312): GPX and TCX are
 * plain lists of points, and only numbers and times are read from them, so
 * a few patterns do instead of a parser, which would be a new dependency.
 * Every element name may come with a namespace prefix («gpx:trkpt»).
 */

/** Characters of a name's prefix: «ns3:», «gpxtpx:». */
const PREFIX = "(?:[\\w.-]+:)?";

/** The elements called `name`, in order: their attributes as written, and
 * what is inside them ("" for one closed at once, `<trkpt … />`). */
export function* elements(
  xml: string,
  name: string,
): Generator<{ attributes: string; body: string }> {
  const pattern = new RegExp(
    `<${PREFIX}${name}(?=[\\s/>])([^>]*?)(?:/>|>([\\s\\S]*?)</${PREFIX}${name}\\s*>)`,
    "g",
  );
  for (const found of xml.matchAll(pattern)) {
    yield { attributes: found[1], body: found[2] ?? "" };
  }
}

/** The text of the first element called `name` inside `xml`; null when
 * there is none. Entities are not read: numbers and times have none. */
export function childText(xml: string, name: string): string | null {
  const pattern = new RegExp(`<${PREFIX}${name}(?=[\\s>])[^>]*>([^<]*)<`);
  const found = pattern.exec(xml);
  return found === null ? null : found[1].trim();
}

/** The value of the attribute `name` among `attributes`; null without it. */
export function attribute(attributes: string, name: string): string | null {
  const pattern = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`);
  const found = pattern.exec(attributes);
  return found === null ? null : (found[1] ?? found[2]).trim();
}

/** A number written in the file, or NaN; "" is not 0. */
export function numberOf(text: string | null): number {
  return text === null || text === "" ? Number.NaN : Number(text);
}
