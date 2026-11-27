/**
 * Tests for courtesy replies.
 *
 * A thank-you is not a question, and a thank-you that continues into a question
 * is not a thank-you. Both directions are tested: the phrases that must be
 * answered here, and the messages that must fall through to the pipeline.
 */

import { describe, expect, it } from "vitest";
import { courtesyReply } from "./small-talk";

const INVITE = /tickets, DreamVille, Winter or Brasil/;

function expectGuideReply(reply: string): void {
  expect(reply).toMatch(INVITE);
  expect(reply).not.toMatch(/tomorrowland/i);
  expect(reply).not.toMatch(/\d/);
  expect(reply).not.toMatch(/[£€$]/);
  expect(reply).not.toMatch(/\bI am\b/);
  expect(reply).not.toMatch(/\bwe are\b/i);

  const sentences = reply.match(/[^.!?]+[.!?]+/g);
  expect(sentences).not.toBeNull();
  expect(sentences!.length).toBeGreaterThanOrEqual(1);
  expect(sentences!.length).toBeLessThanOrEqual(2);
  expect(reply.endsWith(".")).toBe(true);
}

describe("courtesyReply matches", () => {
  it.each([
    "thank you",
    "thanks",
    "thanks!",
    "thank you so much",
    "cheers",
    "hello",
    "hi",
    "hey",
    "good morning",
    "goodbye",
    "bye",
    "you're welcome",
    "you are welcome",
    "ok thanks",
  ])("matches %j", (question) => {
    const result = courtesyReply(question);
    expect(result).not.toBeNull();
    expectGuideReply(result!.reply);
  });

  it.each([
    "Thank you",
    "THANKS",
    "  hello  ",
    "thanks!!!",
    "thanks...",
    "Thank you so much!",
    "good morning!",
    "you\u2019re welcome",
    "YOU ARE WELCOME",
    "Ok Thanks",
    "ok, thanks",
    "okay, thanks!",
    "thank-you",
    "bye-bye",
    "hi?",
    "thanks?",
    "hello???",
    "thanks 😊",
    "hello 👋",
    "bye 👋🏻",
    "  Hi  ",
    "Cheers",
    "Goodbye",
    "Good morning",
  ])("matches the same courtesy once case, space and trailing noise are ignored: %j", (question) => {
    const result = courtesyReply(question);
    expect(result).not.toBeNull();
    expectGuideReply(result!.reply);
  });

  it("uses one reply for every spelling of thank you", () => {
    const plain = courtesyReply("thanks")?.reply;
    expect(courtesyReply("Thank you")?.reply).toBe(plain);
    expect(courtesyReply("thank you so much")?.reply).toBe(plain);
    expect(courtesyReply("ok thanks")?.reply).toBe(plain);
  });

  it("treats a curly apostrophe as the same welcome", () => {
    expect(courtesyReply("you\u2019re welcome")?.reply).toBe(courtesyReply("you're welcome")?.reply);
    expect(courtesyReply("you are welcome")?.reply).toBe(courtesyReply("you're welcome")?.reply);
  });
});

describe("courtesyReply does not swallow a question", () => {
  it.each([
    "thank you, what is a Full Madness pass?",
    "thanks for the Pearl rate",
    "hi, how much is a day pass?",
    "thank you so much, what is a day pass?",
    "thank you so much for the info",
    "ok thanks, how much is a day pass?",
    "hello? how much is a day pass?",
    "thanks?? what is a ticket?",
    "hi, how much is a day pass",
    "you're welcome, but what is a Full Madness pass?",
    "you are welcome to Belgium?",
    "good morning, how much is a pass?",
    "thanks a lot for explaining",
    "thank you for the info",
  ])("returns null for a courtesy that continues into a question: %j", (question) => {
    expect(courtesyReply(question)).toBeNull();
  });

  it.each([
    "thanks tickets",
    "thanks ticket",
    "cheers prices",
    "cheers price",
    "thank you DreamVille",
    "thank you dreamville",
    "hello pearl",
    "thanks for the Pearls",
    "goodbye Belgium",
    "hi Winter",
    "hey Brasil",
    "thanks belgium",
    "hello winter",
    "bye brasil",
    "good morning dream-ville",
  ])("returns null when the message names a festival topic: %j", (question) => {
    expect(courtesyReply(question)).toBeNull();
  });

  it.each([
    "thanks 2",
    "hello 10",
    "bye 2027",
    "thank you 1",
    "hi 2!",
    "thanks £20",
    "hello €",
    "cheers $",
    "thanks 2️⃣",
  ])("returns null when the message has a number or a price symbol: %j", (question) => {
    expect(courtesyReply(question)).toBeNull();
  });

  it.each([
    "",
    "   ",
    "???",
    "!!!",
    "😊",
    "ok",
    "yes",
    "please",
    "cool",
    "what is a day pass?",
    "toString",
    "constructor",
    "not a greeting",
  ])("returns null for %j", (question) => {
    expect(courtesyReply(question)).toBeNull();
  });

  it("returns null for a non-string", () => {
    expect(courtesyReply(undefined as unknown as string)).toBeNull();
  });

  it("does not treat a greeting with an emoji in the middle of a question as a courtesy", () => {
    expect(courtesyReply("thanks 😊 what is a day pass?")).toBeNull();
  });
});
