import {expect, mock, test} from "bun:test";

const paths: string[] = [];

mock.module("next/cache", () => ({
  revalidatePath: (path: string) => {
    paths.push(path);
  },
}));

const {invalidatePublicPaths} = await import("@/lib/public-revalidation");

test("invalidates every base public path after a public mutation", () => {
  paths.length = 0;

  invalidatePublicPaths();

  expect(paths).toEqual([
    "/en",
    "/id",
    "/en/portfolio",
    "/id/portfolio",
    "/en/about",
    "/id/about",
    "/en/contact",
    "/id/contact",
  ]);
});

test("also invalidates both localized album paths when a slug is supplied", () => {
  paths.length = 0;

  invalidatePublicPaths("published-fixture");

  expect(paths).toEqual([
    "/en",
    "/id",
    "/en/portfolio",
    "/id/portfolio",
    "/en/about",
    "/id/about",
    "/en/contact",
    "/id/contact",
    "/en/portfolio/published-fixture",
    "/id/portfolio/published-fixture",
  ]);
});
