import list from "@shaperoute/shared-types/fixtures/recommended-routes.json";
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

import { CARD_SHARE, RecommendedRow } from "./RecommendedRow";
import type { RecommendedRoute } from "./recommendedRoutes";

const routes = list.routes as RecommendedRoute[];
const TRENTO: [number, number] = [46.067, 11.1215];

/** A card that says which route and how wide. */
const card = (route: RecommendedRoute, width: number) => (
  <Text key={route.id}>{`${route.id} @${width}`}</Text>
);

function answering(response: Response | Error) {
  return jest.fn((_url: RequestInfo | URL, _init?: RequestInit) =>
    response instanceof Error ? Promise.reject(response) : Promise.resolve(response),
  );
}

test("signed in: the routes the API recommends, in its order, in one row", async () => {
  const reversed = [...routes].reverse();
  const fetchFn = answering(Response.json({ routes: reversed }));
  await render(
    <RecommendedRow
      apiUrl="http://api"
      near={TRENTO}
      width={300}
      card={card}
      readToken={() => "tok"}
      fetchFn={fetchFn}
    />,
  );
  expect(await screen.findByText("RECOMMENDED")).toBeOnTheScreen();
  const width = Math.round(300 * CARD_SHARE);
  const shown = screen.getAllByText(/ @/).map((node) => String(node.props.children));
  expect(shown).toEqual(reversed.map((r) => `${r.id} @${width}`));
  const [url, init] = fetchFn.mock.calls[0];
  expect(String(url)).toContain("/recommended?lat=46.07&lon=11.12");
  expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer tok");
});

test("signed out: no row, and the API is not asked", async () => {
  const fetchFn = answering(Response.json(list));
  await render(
    <RecommendedRow
      apiUrl="http://api"
      near={TRENTO}
      width={300}
      card={card}
      readToken={() => null}
      fetchFn={fetchFn}
    />,
  );
  expect(screen.queryByText("RECOMMENDED")).toBeNull();
  expect(fetchFn).not.toHaveBeenCalled();
});

test.each([
  ["no API", null, TRENTO],
  ["no point", "http://api", null],
] as const)("%s: no row, and nothing asked", async (_, apiUrl, near) => {
  const fetchFn = answering(Response.json(list));
  await render(
    <RecommendedRow
      apiUrl={apiUrl}
      near={near}
      width={300}
      card={card}
      readToken={() => "tok"}
      fetchFn={fetchFn}
    />,
  );
  expect(screen.queryByText("RECOMMENDED")).toBeNull();
  expect(fetchFn).not.toHaveBeenCalled();
});

test.each([
  ["no network", new TypeError("Network request failed")],
  ["the session ended", Response.json({ error: { code: "x" } }, { status: 401 })],
  ["an API without the row", Response.json({ detail: "Not Found" }, { status: 404 })],
  ["nothing near", Response.json({ routes: [] })],
])("%s: no row, nothing breaks", async (_, response) => {
  const fetchFn = answering(response);
  await render(
    <RecommendedRow
      apiUrl="http://api"
      near={TRENTO}
      width={300}
      card={card}
      readToken={() => "tok"}
      fetchFn={fetchFn}
    />,
  );
  await waitFor(() => expect(fetchFn).toHaveBeenCalled());
  expect(screen.queryByText("RECOMMENDED")).toBeNull();
  expect(screen.queryByText(/ @/)).toBeNull();
});
