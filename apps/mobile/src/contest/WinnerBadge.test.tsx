import publicProfile from "@shaperoute/shared-types/fixtures/public-profile.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type { Session, User } from "@shaperoute/shared-types";
import { render, screen } from "@testing-library/react-native";

import { answers } from "../account/testing";
import type { AccountState } from "../account/useAccount";
import { ProfileHome } from "../profile/ProfileHome";
import { UserProfilePage } from "../profile/UserProfilePage";

/**
 * The «Winner» badge on the profiles (TASK-299 part B): under the name of
 * who won a contest, `contest_wins` 1 or more, on one's own «Profile» and
 * on another member's; none at 0, nor from an API older than the contest.
 * The badge itself is in ProfileHeader.test.tsx.
 */

const SESSION = session as Session;
const signedIn: AccountState = { status: "signedIn", session: SESSION };

async function own(user: User) {
  await render(
    <ProfileHome
      user={user}
      favorites={2}
      activities={5}
      onOpen={jest.fn()}
      onEdit={jest.fn()}
    />,
  );
}

async function another(body: unknown) {
  await render(
    <UserProfilePage
      apiUrl="http://api"
      account={{ state: signedIn, sessionEnded: jest.fn() }}
      publicId={publicProfile.public_id}
      fetchFn={answers({ status: 200, body }) as jest.Mock}
      apiKey={null}
    />,
  );
  await screen.findByText("Ada_runs");
}

test("one's own profile has the badge with a contest won", async () => {
  await own({ ...SESSION.user, contest_wins: 1 });
  expect(screen.getByLabelText("Winner")).toBeOnTheScreen();
});

test("one's own profile has none without one, or from an older API", async () => {
  await own({ ...SESSION.user, contest_wins: 0 });
  expect(screen.queryByLabelText("Winner")).toBeNull();
  const { contest_wins: _wins, ...older } = SESSION.user;
  await own(older);
  expect(screen.queryByLabelText("Winner")).toBeNull();
});

test("another member's profile has the badge with contests won", async () => {
  await another({ ...publicProfile, contest_wins: 2 });
  expect(screen.getByLabelText("Winner")).toBeOnTheScreen();
});

test("another member's profile has none without one, or from an older API", async () => {
  await another({ ...publicProfile, contest_wins: 0 });
  expect(screen.queryByLabelText("Winner")).toBeNull();
  const { contest_wins: _wins, ...older } = publicProfile;
  await another(older);
  expect(screen.queryByLabelText("Winner")).toBeNull();
});
