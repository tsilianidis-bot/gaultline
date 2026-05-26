import { describe, it, expect } from "vitest";
import { parseThread } from "./xPoster";

describe("xPoster", () => {
  it("parses numbered thread correctly", () => {
    const thread = "1/3 First tweet here\n\n2/3 Second tweet here\n\n3/3 Third tweet here";
    const tweets = parseThread(thread);
    expect(tweets.length).toBe(3);
    expect(tweets[0]).toContain("First tweet");
    expect(tweets[2]).toContain("Third tweet");
  });

  it("falls back to double-newline split when no markers", () => {
    const thread = "First part\n\nSecond part\n\nThird part";
    const tweets = parseThread(thread);
    expect(tweets.length).toBe(3);
  });

  it("handles single tweet", () => {
    const tweet = "Just a single tweet with no markers";
    const tweets = parseThread(tweet);
    expect(tweets.length).toBe(1);
    expect(tweets[0]).toBe(tweet);
  });
});
