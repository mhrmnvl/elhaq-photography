import {expect, test} from "bun:test";

import {adjacentPhotoIndex, shouldSwipe} from "@/components/lightbox";
import {buildCloudinaryDerivative} from "@/lib/cloudinary-loader";

test("stops at gallery edges instead of looping", () => {
  expect(adjacentPhotoIndex(0, -1, 3)).toBe(0);
  expect(adjacentPhotoIndex(1, 1, 3)).toBe(2);
  expect(adjacentPhotoIndex(2, 1, 3)).toBe(2);
  expect(adjacentPhotoIndex(0, 1, 0)).toBe(0);
});

test("accepts horizontal swipe only", () => {
  expect(shouldSwipe(60, 10)).toBe(true);
  expect(shouldSwipe(10, 60)).toBe(false);
  expect(shouldSwipe(30, 1)).toBe(false);
});

test("builds a bounded Cloudinary derivative from the public asset", () => {
  const asset = {
    id: "media-1",
    cloudName: "demo",
    publicId: "elhaq/uploads/portrait",
    secureUrl: "https://res.cloudinary.com/demo/image/upload/portrait",
    width: 1200,
    height: 800,
    alt: {en: "Portrait", id: "Potret"},
  };

  expect(buildCloudinaryDerivative(asset, 960)).toBe("https://res.cloudinary.com/demo/image/upload/f_auto,q_auto,w_960/elhaq/uploads/portrait");
  expect(() => buildCloudinaryDerivative(asset, 0)).toThrow("INVALID_IMAGE_WIDTH");
  expect(() => buildCloudinaryDerivative({...asset, publicId: "../foreign"}, 960)).toThrow("INVALID_PUBLIC_ID");
});
