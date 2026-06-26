import { describe, it, expect } from "vitest";
import {
  buildFtsQuery,
  extractUrls,
  hasBroadcastMention,
  parseMentions,
  plainPreview,
} from "./text.js";
import { createChannelSchema, createMessageSchema } from "@slashslack/shared";

describe("parseMentions", () => {
  it("extracts unique user ids from <@id> tokens", () => {
    expect(parseMentions("hi <@3> and <@5> and <@3>")).toEqual([3, 5]);
  });
  it("returns empty for no mentions", () => {
    expect(parseMentions("nothing here")).toEqual([]);
  });
});

describe("hasBroadcastMention", () => {
  it("detects @channel / @everyone / @here", () => {
    expect(hasBroadcastMention("hey @channel ship it")).toBe(true);
    expect(hasBroadcastMention("@everyone")).toBe(true);
    expect(hasBroadcastMention("ping @here")).toBe(true);
  });
  it("ignores emails and partial words", () => {
    expect(hasBroadcastMention("mail me a@b.com")).toBe(false);
    expect(hasBroadcastMention("@channeling is a word")).toBe(false);
  });
});

describe("plainPreview", () => {
  it("replaces mentions and collapses whitespace", () => {
    expect(plainPreview("hey  <@2>   there")).toBe("hey @user there");
  });
  it("truncates long text", () => {
    expect(plainPreview("a".repeat(200)).endsWith("…")).toBe(true);
  });
});

describe("extractUrls", () => {
  it("finds and dedupes urls, capped at 3", () => {
    const body = "see https://a.com and https://a.com and https://b.com https://c.com https://d.com";
    expect(extractUrls(body)).toEqual(["https://a.com", "https://b.com", "https://c.com"]);
  });
});

describe("buildFtsQuery", () => {
  it("quotes each term as a prefix match and strips quotes", () => {
    expect(buildFtsQuery('hello wor"ld')).toBe('"hello"* "world"*');
  });
});

describe("shared zod schemas", () => {
  it("slugifies channel names", () => {
    const parsed = createChannelSchema.parse({ name: "My New Channel" });
    expect(parsed.name).toBe("my-new-channel");
  });
  it("defaults message fields", () => {
    const parsed = createMessageSchema.parse({ channelId: 1 });
    expect(parsed.body).toBe("");
    expect(parsed.attachmentIds).toEqual([]);
  });
});
