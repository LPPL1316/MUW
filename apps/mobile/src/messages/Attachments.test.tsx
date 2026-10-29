import attachmentsExample from "@shaperoute/shared-types/fixtures/message-attachments.json";
import mediaExample from "@shaperoute/shared-types/fixtures/message-media.json";
import messagesExample from "@shaperoute/shared-types/fixtures/messages.json";
import session from "@shaperoute/shared-types/fixtures/session.json";
import type {
  ApiErrorCode,
  Conversation,
  Message,
  MessageAttachment,
  MessagesPage,
  Person,
  Session,
} from "@shaperoute/shared-types";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { AccountState } from "../account/useAccount";
import type { AccountOutcome } from "../api/accounts";
import type { Upload } from "../api/messageMedia";
import { attachmentLabel, duration, messageLine } from "./attachmentText";
import { previewOf } from "./ConversationList";
import { ConversationScreen, fileProblem } from "./ConversationScreen";
import { MessagesContext, type MessagesDoor } from "./messagesDoor";
import type { PickedMessageFile } from "./pickMessageMedia";
import { VideoPoster } from "./VideoPoster";

// Photos and videos in a conversation (TASK-333, ADR-0289): the «+» only
// when the page says what may go (never on a server before, never in a
// request); a file sent first, then its message; a send that failed tried
// again; a photo opened on the whole screen; a video expired said so.

const URL = "http://api";
const signedIn: AccountState = { status: "signedIn", session: session as Session };
const open = { ...(messagesExample as MessagesPage), next: null };
const ada = open.person as Person;
const PLUS = "Add a photo, a video or a drawing";
const PHOTO = {
  kind: "photo",
  uri: "file:///cache/ImageManipulator/a.jpg",
  mimeType: "image/jpeg",
  width: 1080,
  height: 810,
  durationMs: null,
} as const;
const sentPhoto: Message = {
  id: "71c9e4b0-5f38-4d2a-b6e7-3a80d1f2c945",
  text: "The river",
  created_at: "2026-10-29T18:10:00Z",
  mine: true,
  attachment: {
    kind: "photo",
    media_id: mediaExample.id,
    width: 1080,
    height: 810,
    duration_ms: null,
    poster: false,
    expired: false,
    drawing: null,
  },
};

const initialMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

type Asked = { method: string; url: string; body: unknown };

/** A fake API: the page given, a message answered, every call kept. */
function api(
  page: unknown,
  answer: () => Response = () => Response.json(sentPhoto, { status: 201 }),
) {
  const asked: Asked[] = [];
  const fetchFn = jest.fn(async (input: string, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    asked.push({
      method,
      url: input.replace(URL, ""),
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    if (method === "PUT") {
      return new Response(null, { status: 204 });
    }
    if (method === "POST") {
      return answer();
    }
    return Response.json(page);
  });
  return { fetchFn: fetchFn as unknown as typeof fetch, asked };
}

function door(): MessagesDoor {
  return {
    apiUrl: URL,
    account: { state: signedIn, sessionEnded: jest.fn() },
    screen: null,
    openList: jest.fn(),
    openConversation: jest.fn(),
    back: jest.fn(),
    close: jest.fn(),
    unread: { unread: 0, requests: 0 },
    recount: jest.fn(),
  };
}

async function show(
  fetchFn: typeof fetch,
  pick: (kind: "photo" | "video") => Promise<PickedMessageFile> = async () => ({
    kind: "picked",
    file: PHOTO,
  }),
  upload?: Upload,
  ready: string = open.messages[0].text,
) {
  await render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <MessagesContext.Provider value={door()}>
        <ConversationScreen
          person={ada}
          onBack={jest.fn()}
          fetchFn={fetchFn}
          apiKey={null}
          everyMs={3_600_000}
          pick={pick}
          upload={upload}
        />
      </MessagesContext.Provider>
    </SafeAreaProvider>,
  );
  await screen.findByText(ready);
}

const kept = (status = 201, body: unknown = mediaExample) =>
  jest.fn(async () => ({ status, body: JSON.stringify(body), headers: {} }));

// --- When the «+» is there ---

test("a server before the attachments shows no «+»", async () => {
  const { attachments: _none, ...before } = open;
  await show(api(before).fetchFn);
  expect(screen.queryByRole("button", { name: PLUS })).toBeNull();
  // The box writes as before.
  expect(screen.getByLabelText("Message")).toBeOnTheScreen();
});

test("a request, and a page that offers nothing, show no «+»", async () => {
  await show(api({ ...open, state: "first", attachments: null }).fetchFn);
  expect(screen.queryByRole("button", { name: PLUS })).toBeNull();
});

test("a full server offers the photo only", async () => {
  const full = {
    ...open,
    attachments: { ...open.attachments, kinds: ["photo", "drawing"] },
  };
  await show(api(full).fetchFn);
  await fireEvent.press(screen.getByRole("button", { name: PLUS }));
  expect(screen.getByRole("button", { name: "Photo" })).toBeOnTheScreen();
  expect(screen.queryByRole("button", { name: "Video" })).toBeNull();
});

// --- Sending ---

test("a photo goes first, then its message with what was written", async () => {
  const { fetchFn, asked } = api(open);
  const upload = kept();
  await show(fetchFn, undefined, upload);
  await fireEvent.changeText(screen.getByLabelText("Message"), "The river");
  await fireEvent.press(screen.getByRole("button", { name: PLUS }));
  await fireEvent.press(screen.getByRole("button", { name: "Photo" }));
  // The text moved under the photo, ready to go with it.
  expect(screen.getByPlaceholderText("Add a message…").props.value).toBe("The river");
  await fireEvent.press(screen.getByRole("button", { name: "Send" }));
  await waitFor(() => expect(screen.getByText("The river")).toBeOnTheScreen());
  expect(upload).toHaveBeenCalledWith(`${URL}/me/message-media`, PHOTO.uri, {
    httpMethod: "POST",
    mimeType: "image/jpeg",
    headers: expect.objectContaining({
      "Content-Type": "image/jpeg",
      Authorization: `Bearer ${(session as Session).token}`,
    }),
  });
  const posted = asked.filter((a) => a.method === "POST");
  expect(posted).toEqual([
    {
      method: "POST",
      url: `/conversations/${ada.public_id}/messages?with=attachments`,
      body: { text: "The river", attachment: { media_id: mediaExample.id } },
    },
  ]);
  // The box is back, and the photo is in the conversation.
  expect(screen.queryByPlaceholderText("Add a message…")).toBeNull();
  expect(
    screen.getByRole("button", { name: "You: Photo, The river" }),
  ).toBeOnTheScreen();
});

test("a send that failed stays, and a tap tries again", async () => {
  const upload = jest
    .fn<ReturnType<Upload>, Parameters<Upload>>()
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({
      status: 201,
      body: JSON.stringify(mediaExample),
      headers: {},
    });
  await show(api(open).fetchFn, undefined, upload);
  await fireEvent.press(screen.getByRole("button", { name: PLUS }));
  await fireEvent.press(screen.getByRole("button", { name: "Photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Send" }));
  const again = await screen.findByText("Couldn't send. Tap to try again.");
  await fireEvent.press(again);
  await waitFor(() =>
    expect(screen.queryByPlaceholderText("Add a message…")).toBeNull(),
  );
  expect(upload).toHaveBeenCalledTimes(2);
});

test("a video too long or too large is said before anything goes", async () => {
  const answers: PickedMessageFile[] = [{ kind: "too_long" }, { kind: "too_large" }];
  const upload = kept();
  await show(
    api(open).fetchFn,
    async () => answers.shift() ?? { kind: "cancelled" },
    upload,
  );
  await fireEvent.press(screen.getByRole("button", { name: PLUS }));
  await fireEvent.press(screen.getByRole("button", { name: "Video" }));
  expect(
    await screen.findByText(
      "This video is longer than 60 seconds. Choose a shorter one.",
    ),
  ).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: PLUS }));
  await fireEvent.press(screen.getByRole("button", { name: "Video" }));
  expect(
    await screen.findByText(
      "This video is too large: at most 40 MB. Choose a shorter one.",
    ),
  ).toBeOnTheScreen();
  expect(upload).not.toHaveBeenCalled();
});

test("cancelled, the box is as it was", async () => {
  await show(api(open).fetchFn);
  await fireEvent.press(screen.getByRole("button", { name: PLUS }));
  await fireEvent.press(screen.getByRole("button", { name: "Photo" }));
  await fireEvent.press(screen.getByRole("button", { name: "Cancel" }));
  expect(screen.queryByPlaceholderText("Add a message…")).toBeNull();
  expect(screen.getByLabelText("Message")).toBeOnTheScreen();
});

// --- Shown ---

test("a photo opens on the whole screen, and a video expired says so", async () => {
  await show(
    api({ ...(attachmentsExample as MessagesPage), next: null }).fetchFn,
    undefined,
    undefined,
    "The river at 7, see you there",
  );
  expect(screen.getByText("This video has expired.")).toBeOnTheScreen();
  // The expired one cannot be opened.
  expect(
    screen.queryByRole("button", {
      name: "You: This video has expired., Last month's sunrise",
    }),
  ).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Photo" }));
  expect(screen.getByRole("button", { name: "Share" })).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
});

// --- In words ---

test("the list says what a message carries", () => {
  const [drawing, video, photo] = (attachmentsExample as MessagesPage).messages;
  const conversation = (last: Message): Conversation => ({
    person: ada,
    last,
    unread: false,
  });
  expect(previewOf(conversation(photo))).toBe("📷 Photo");
  expect(previewOf(conversation(video))).toBe("You: 🎬 The river at 7, see you there");
  expect(messageLine(drawing)).toBe("🗺️ Drawing");
  expect(messageLine(open.messages[0])).toBe(
    "Yes, but the bridge is closed on Sundays. Take the one after it.",
  );
});

test("VoiceOver hears what a message carries", () => {
  const [drawing, video, photo, expired] = (attachmentsExample as MessagesPage)
    .messages;
  expect(attachmentLabel(photo.attachment as MessageAttachment)).toBe("Photo");
  expect(attachmentLabel(video.attachment as MessageAttachment)).toBe("Video, 0:24");
  expect(attachmentLabel(expired.attachment as MessageAttachment)).toBe(
    "This video has expired.",
  );
  expect(attachmentLabel(drawing.attachment as MessageAttachment)).toBe(
    "Drawing: Heart, 5.1 km",
  );
  expect(duration(58_020)).toBe("0:58");
  expect(duration(60_000)).toBe("1:00");
});

test("what the API refuses of a file is said in words", () => {
  const refused = (code: ApiErrorCode, message = "…"): AccountOutcome<never> => ({
    kind: "api_error",
    code,
    message,
    suggested_distance_m: null,
    retryAfterS: null,
  });
  expect(fileProblem(refused("too_many_requests"), "video")).toBe(
    "Too many videos today. Try again tomorrow.",
  );
  expect(fileProblem(refused("too_many_requests"), "photo")).toBe(
    "Too many photos today. Try again tomorrow.",
  );
  expect(fileProblem(refused("http_error"), "video")).toBe(
    "Videos can't be sent right now. Try again later.",
  );
  expect(
    fileProblem(refused("invalid_request", "A video is at most 60 seconds."), "video"),
  ).toBe("A video is at most 60 seconds.");
  expect(fileProblem({ kind: "unreachable", url: URL }, "photo")).toBeNull();
});

// --- A video's first picture ---

test("a video's first picture is kept in the cache, or the video goes without", async () => {
  const onPoster = jest.fn();
  await render(
    <VideoPoster videoUri="file:///cache/ImagePicker/a.mov" onPoster={onPoster} />,
  );
  const page = screen.getByTestId("video-poster");
  expect(page.props.source).toEqual({ uri: "file:///cache/message-poster.html" });
  expect(page.props.allowingReadAccessToURL).toBe("file:///cache/");
  await fireEvent(page, "message", {
    nativeEvent: { data: JSON.stringify({ type: "poster", jpeg: "/9j/AA==" }) },
  });
  expect(onPoster).toHaveBeenCalledTimes(1);
  expect(onPoster.mock.calls[0][0]).toMatch(
    /^file:\/\/\/cache\/message-poster-\d+\.jpg$/,
  );
  // Told once only.
  await fireEvent(page, "message", {
    nativeEvent: { data: JSON.stringify({ type: "failed" }) },
  });
  expect(onPoster).toHaveBeenCalledTimes(1);

  const without = jest.fn();
  await render(
    <VideoPoster videoUri="file:///cache/ImagePicker/b.mov" onPoster={without} />,
  );
  await fireEvent(screen.getByTestId("video-poster"), "message", {
    nativeEvent: { data: JSON.stringify({ type: "failed" }) },
  });
  expect(without).toHaveBeenCalledWith(null);
});
