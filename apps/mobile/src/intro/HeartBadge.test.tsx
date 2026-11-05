import { render, screen } from "@testing-library/react-native";
import { StyleSheet, Text } from "react-native";

import { ChooseScreen } from "../screens/ChooseScreen";
import { AppHeader } from "../tabs/AppHeader";
import { color } from "../theme/tokens";
import { HeartBadge, heartSegments } from "./HeartBadge";
import { HEART_BOX, HEART_POINTS, heartHeight } from "./heartLine";

jest.mock(
  "react-native-safe-area-context",
  () => jest.requireActual("react-native-safe-area-context/jest/mock").default,
);

describe("heartSegments", () => {
  const width = 20;
  const line = 2;
  const segments = heartSegments(width, line);
  const scale = width / HEART_BOX.width;

  it("lays one piece per stretch of the route, none cut", () => {
    const stretches = HEART_POINTS.slice(1).filter(
      ([x, y], i) => x !== HEART_POINTS[i][0] || y !== HEART_POINTS[i][1],
    );
    expect(segments).toHaveLength(stretches.length);
  });

  it("joins each piece to the next: the ends meet at the route's points", () => {
    // A turned piece's ends, from its centre, its length and its angle.
    const ends = segments.map((s) => {
      const centreX = s.left + s.width / 2;
      const centreY = s.top + line / 2;
      const half = (s.width - line) / 2;
      const rad = (s.angle * Math.PI) / 180;
      return {
        from: [centreX - half * Math.cos(rad), centreY - half * Math.sin(rad)],
        to: [centreX + half * Math.cos(rad), centreY + half * Math.sin(rad)],
      };
    });
    expect(ends[0].from[0]).toBeCloseTo(HEART_POINTS[0][0] * scale, 6);
    expect(ends[0].from[1]).toBeCloseTo(HEART_POINTS[0][1] * scale, 6);
    for (let i = 1; i < ends.length; i += 1) {
      expect(ends[i].from[0]).toBeCloseTo(ends[i - 1].to[0], 6);
      expect(ends[i].from[1]).toBeCloseTo(ends[i - 1].to[1], 6);
    }
    // Closed: the last piece ends where the first starts.
    expect(ends[ends.length - 1].to[0]).toBeCloseTo(ends[0].from[0], 6);
    expect(ends[ends.length - 1].to[1]).toBeCloseTo(ends[0].from[1], 6);
  });

  it("stays inside the drawing, but for the round ends", () => {
    const height = heartHeight(width);
    for (const s of segments) {
      const centreX = s.left + s.width / 2;
      const centreY = s.top + line / 2;
      expect(centreX).toBeGreaterThanOrEqual(0);
      expect(centreX).toBeLessThanOrEqual(width);
      expect(centreY).toBeGreaterThanOrEqual(0);
      expect(centreY).toBeLessThanOrEqual(height);
    }
  });
});

/** The badge is hidden from screen readers, so the queries must look for it. */
const HIDDEN = { includeHiddenElements: true } as const;

describe("HeartBadge", () => {
  it("is a yellow square with the heart in black, as at the launch", async () => {
    await render(<HeartBadge size={32} />);
    const square = StyleSheet.flatten(
      screen.getByTestId("heart-badge", HIDDEN).props.style,
    );
    expect(square.backgroundColor).toBe(color.accent);
    expect(square.width).toBe(32);
    expect(square.height).toBe(32);
    expect(square.borderRadius).toBeGreaterThan(0);
    expect(square.borderRadius).toBeLessThan(16);
  });

  it("draws the line dark on the yellow, never white", async () => {
    await render(<HeartBadge size={32} />);
    const heart = screen.getByTestId("heart-badge", HIDDEN).children[0];
    if (typeof heart === "string") {
      throw new Error("the badge holds the drawing, not text");
    }
    const pieces = heart.children.filter((child) => typeof child !== "string");
    // Every piece of the route, then the start dot.
    expect(pieces).toHaveLength(heartSegments(1, 1).length + 1);
    for (const piece of pieces.slice(0, -1)) {
      if (typeof piece !== "string") {
        expect(StyleSheet.flatten(piece.props.style).backgroundColor).toBe(
          color.onAccent,
        );
      }
    }
  });

  it("says nothing to a screen reader: the name beside it does", async () => {
    await render(<HeartBadge size={32} />);
    expect(screen.queryAllByRole("image", HIDDEN)).toHaveLength(0);
    expect(screen.getByTestId("heart-badge", HIDDEN)).toBeTruthy();
    expect(screen.queryByTestId("heart-badge")).toBeNull();
  });
});

describe("the logo in the header", () => {
  it("stands just before the name «MuW»", async () => {
    await render(<AppHeader />);
    // The rendered tree: the heart's next sibling is the name.
    type Node = {
      type: string;
      props: Record<string, unknown>;
      children: Child[] | null;
    };
    type Child = Node | string;
    function besideHeart(node: Child): Child | undefined {
      if (typeof node === "string" || node.children === null) {
        return undefined;
      }
      const at = node.children.findIndex(
        (child) => typeof child !== "string" && child.props.testID === "heart-badge",
      );
      if (at >= 0) {
        return node.children[at + 1];
      }
      for (const child of node.children) {
        const found = besideHeart(child);
        if (found !== undefined) {
          return found;
        }
      }
      return undefined;
    }
    const next = besideHeart(screen.toJSON() as Node);
    expect(next).toMatchObject({ type: "Text", children: ["MuW"] });
  });

  it("is read once, as the name", async () => {
    await render(<AppHeader />);
    expect(screen.getByLabelText("MuW")).toBeOnTheScreen();
    expect(screen.queryByTestId("heart-badge")).toBeNull();
  });
});

describe("the top of «Draw»", () => {
  it("leaves the logo to the header: only the run button is there", async () => {
    await render(
      <ChooseScreen
        status="From your position"
        denied={false}
        mode="gps"
        onMode={jest.fn()}
        searching={false}
        onPlace={jest.fn()}
        near={null}
        mapError={null}
        footer={<Text>Draw route</Text>}
        onRun={jest.fn()}
      >
        <Text>Shapes</Text>
      </ChooseScreen>,
    );
    expect(screen.queryByTestId("heart-badge", HIDDEN)).toBeNull();
    expect(screen.queryByText("MuW")).toBeNull();
    expect(screen.getByText("Run without a route")).toBeOnTheScreen();
  });
});
