import { describe, expect, it } from "vitest";
import { extractHistoryImages } from "./web-chat-history";

describe("extractHistoryImages", () => {
  it("lifts persisted image refs while preserving the user's caption", () => {
    expect(extractHistoryImages(
      "what is shown?\n@image:/tmp/cat.png\n@image:`/tmp/a photo.webp`\n[screenshot]",
    )).toEqual({
      attachments: [
        { name: "cat.png", path: "/tmp/cat.png", type: "image/png" },
        { name: "a photo.webp", path: "/tmp/a photo.webp", type: "image/webp" },
      ],
      content: "what is shown?\n",
    });
  });

  it("leaves screenshot text alone when there is no persisted image ref", () => {
    expect(extractHistoryImages("caption\n[screenshot]")).toEqual({
      attachments: [],
      content: "caption\n[screenshot]",
    });
  });
});
