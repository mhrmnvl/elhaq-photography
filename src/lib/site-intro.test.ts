import {expect, test} from "bun:test";

import {
  INTRO_CURTAIN_MS,
  INTRO_CYCLES,
  INTRO_LETTER_DELAY_MS,
  INTRO_LETTER_MS,
  introPercent,
  introTimeline,
  introWavePeriod,
  splitBrandWords,
} from "@/lib/site-intro";

test("reports a full percentage when there is nothing to load", () => {
  expect(introPercent(0, 0)).toBe(100);
});

test("computes progress from resolved versus total", () => {
  expect(introPercent(0, 4)).toBe(0);
  expect(introPercent(1, 4)).toBe(25);
  expect(introPercent(1, 3)).toBe(33);
  expect(introPercent(2, 4)).toBe(50);
  expect(introPercent(4, 4)).toBe(100);
});

test("never reports below zero or above a hundred", () => {
  expect(introPercent(-5, 4)).toBe(0);
  expect(introPercent(9, 4)).toBe(100);
});

test("splits the brand into words of letters so it can wrap between words", () => {
  expect(splitBrandWords("Elhaq Photography")).toEqual([
    ["E", "l", "h", "a", "q"],
    ["P", "h", "o", "t", "o", "g", "r", "a", "p", "h", "y"],
  ]);
});

test("collapses extra whitespace and survives an empty brand", () => {
  expect(splitBrandWords("  Elhaq   Photography  ")).toEqual([
    ["E", "l", "h", "a", "q"],
    ["P", "h", "o", "t", "o", "g", "r", "a", "p", "h", "y"],
  ]);
  expect(splitBrandWords("")).toEqual([]);
});

test("spaces the letter wave exactly one letter apart", () => {
  expect(introWavePeriod(17)).toBe(16 * INTRO_LETTER_DELAY_MS + INTRO_LETTER_MS);
  expect(introWavePeriod(0)).toBe(0);
  expect(introWavePeriod(-3)).toBe(0);
});

test("overlaps successive letters like a rolling ribbon", () => {
  expect(INTRO_LETTER_DELAY_MS).toBeLessThan(INTRO_LETTER_MS);
});

test("runs one wave pass so every letter moves exactly once", () => {
  const timeline = introTimeline(17);
  expect(timeline.wave).toBe(0);
  expect(INTRO_CYCLES).toBe(1);
  expect(timeline.leave).toBe(introWavePeriod(17));
  expect(16 * INTRO_LETTER_DELAY_MS + INTRO_LETTER_MS).toBeLessThanOrEqual(timeline.leave);
});

test("lifts the curtain as soon as the complete word has returned", () => {
  const timeline = introTimeline(17);
  expect(timeline.curtain).toBe(timeline.leave);
  expect(timeline.done).toBe(timeline.curtain + INTRO_CURTAIN_MS);
  expect(timeline.curtain).toBe(introWavePeriod(17));
  expect(timeline.curtain).toBeLessThan(timeline.done);
});

test("survives a brand with no letters", () => {
  const timeline = introTimeline(0);
  expect(timeline.leave).toBe(0);
  expect(timeline.done).toBeGreaterThan(timeline.leave);
});
