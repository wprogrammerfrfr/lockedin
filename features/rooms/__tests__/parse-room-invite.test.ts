import { describe, expect, it } from "vitest";
import {
  parseRoomCodeFromPayload,
  roomInviteUrl,
} from "@/features/rooms/parse-room-invite";

describe("parseRoomCodeFromPayload", () => {
  it("accepts bare 6-digit codes", () => {
    expect(parseRoomCodeFromPayload("482910")).toBe("482910");
  });

  it("parses /rooms/{code} URLs", () => {
    expect(
      parseRoomCodeFromPayload("https://lockedin.app/rooms/123456"),
    ).toBe("123456");
    expect(parseRoomCodeFromPayload("/rooms/654321/")).toBe("654321");
  });

  it("returns null for invalid input", () => {
    expect(parseRoomCodeFromPayload("")).toBeNull();
    expect(parseRoomCodeFromPayload("12345")).toBeNull();
  });
});

describe("roomInviteUrl", () => {
  it("builds a stable invite path", () => {
    expect(roomInviteUrl("https://lockedin.app/", "111222")).toBe(
      "https://lockedin.app/rooms/111222",
    );
  });
});
