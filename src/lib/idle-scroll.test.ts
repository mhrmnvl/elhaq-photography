import {expect, test} from "bun:test";

import {
  INTRO_GALLERY_MS,
  IDLE_DELAY_MS,
  atBottom,
  introGalleryTop,
  nextScrollTop,
} from "@/lib/idle-scroll";

test("advances the scroll position at the given speed", () => {
  expect(nextScrollTop(0, 1000, 60, 1000)).toBe(60);
  expect(nextScrollTop(0, 1000, 60, 500)).toBe(30);
});

test("waits four seconds before idle scrolling", () => {
  expect(IDLE_DELAY_MS).toBe(4000);
});

test("never scrolls past the bottom", () => {
  expect(nextScrollTop(990, 1000, 60, 1000)).toBe(1000);
  expect(nextScrollTop(2000, 1000, 60, 1000)).toBe(1000);
});

test("stays put when there is nothing to scroll or no time passed", () => {
  expect(nextScrollTop(0, 0, 60, 1000)).toBe(0);
  expect(nextScrollTop(0, -50, 60, 1000)).toBe(0);
  expect(nextScrollTop(120, 1000, 60, 0)).toBe(120);
  expect(nextScrollTop(120, 1000, 0, 1000)).toBe(120);
});

test("detects the bottom of the document", () => {
  expect(atBottom(900, 100, 1000)).toBe(true);
  expect(atBottom(899, 100, 1000)).toBe(true);
  expect(atBottom(898, 100, 1000)).toBe(false);
  expect(atBottom(0, 100, 50)).toBe(true);
});

test("moves the opening scroll one full gallery loop, back to where it started", () => {
  const distance = 3300;
  expect(introGalleryTop(0, distance, 0, INTRO_GALLERY_MS)).toBe(0);
  expect(introGalleryTop(0, distance, INTRO_GALLERY_MS, INTRO_GALLERY_MS)).toBe(distance);
  expect(introGalleryTop(0, distance, INTRO_GALLERY_MS * 2, INTRO_GALLERY_MS)).toBe(distance);
  expect(introGalleryTop(120, distance, INTRO_GALLERY_MS / 2, INTRO_GALLERY_MS)).toBe(120 + distance / 2);
});

test("starts and ends the opening scroll gently", () => {
  const distance = 3300;
  const quarter = distance * 0.125;
  expect(introGalleryTop(0, distance, INTRO_GALLERY_MS / 4, INTRO_GALLERY_MS)).toBeLessThan(quarter);
  expect(introGalleryTop(0, distance, (INTRO_GALLERY_MS * 3) / 4, INTRO_GALLERY_MS)).toBeGreaterThan(
    distance - quarter
  );
});

test("arrives immediately when the duration is unusable", () => {
  expect(introGalleryTop(0, 3300, 10, 0)).toBe(3300);
});
