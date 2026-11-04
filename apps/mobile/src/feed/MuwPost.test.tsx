import list from "@shaperoute/shared-types/fixtures/muw-routes.json";
import type { MuwRoute } from "@shaperoute/shared-types";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { translate } from "../i18n/translate";
import { MuwPost } from "./MuwPost";

const ROUTE = list.routes[0] as unknown as MuwRoute;

test("MuW where a runner would be, and the label always under it", async () => {
  await render(<MuwPost route={ROUTE} width={340} onOpen={() => {}} />);
  expect(screen.getByText("MuW")).toBeOnTheScreen();
  expect(screen.getByTestId("muw-label")).toHaveTextContent(
    "Route created by MuW – ride it yourself",
  );
  expect(screen.getByText(/Star · Trento/)).toBeOnTheScreen();
  expect(screen.getByText(/Bike · 22\.3 km · ↑ 341 m/)).toBeOnTheScreen();
});

test("nothing of a run: no person, date, time, pace or reactions", async () => {
  await render(<MuwPost route={ROUTE} width={340} onOpen={() => {}} />);
  const words = screen.getAllByText(/./).map((n) => String(n.props.children));
  const all = words.join(" ");
  expect(all).not.toMatch(/\d{1,2}:\d{2}|\/km|kcal|ago|Like|Comment/);
});

test.each([
  ["running", "Route created by MuW – run it yourself"],
  ["paddling", "Route created by MuW – paddle it yourself"],
])("the label of a route %s", async (activity, label) => {
  await render(
    <MuwPost route={{ ...ROUTE, activity }} width={340} onOpen={() => {}} />,
  );
  expect(screen.getByTestId("muw-label")).toHaveTextContent(label);
});

test("on the water the climb is not said", async () => {
  await render(
    <MuwPost
      route={{ ...ROUTE, activity: "paddling" }}
      width={340}
      onOpen={() => {}}
    />,
  );
  expect(screen.queryByText(/↑/)).toBeNull();
});

test("a tap opens the route", async () => {
  const onOpen = jest.fn();
  await render(<MuwPost route={ROUTE} width={340} onOpen={onOpen} />);
  fireEvent.press(screen.getByTestId("muw-post"));
  expect(onOpen).toHaveBeenCalledWith(ROUTE);
});

test("the labels are approved in every language of the app", () => {
  expect(translate("it", "Route created by MuW – ride it yourself")).toBe(
    "Percorso creato da MuW – pedalalo tu",
  );
  expect(translate("it", "Route created by MuW – run it yourself")).toBe(
    "Percorso creato da MuW – corrilo tu",
  );
  expect(translate("it", "Route created by MuW – paddle it yourself")).toBe(
    "Percorso creato da MuW – pagaialo tu",
  );
});
