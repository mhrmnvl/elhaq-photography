import {expect, test} from "bun:test";

import {mergeMediaItems} from "@/components/admin/media-picker";
import type {AdminMediaAsset} from "@/lib/domain";

function media(id: string): AdminMediaAsset {
  return {
    id,
    cloudName: "demo",
    publicId: `elhaq/uploads/${id}`,
    secureUrl: `https://res.cloudinary.com/demo/image/upload/${id}.jpg`,
    width: 1200,
    height: 800,
    format: "jpg",
    bytes: 100,
    referenceCount: 0,
  };
}

test("keeps an upload completed during an in-flight media request", () => {
  const existing = media("existing");
  const uploaded = media("uploaded");

  expect(mergeMediaItems([existing, uploaded], [existing], new Set([existing.id]))).toEqual([existing, uploaded]);
});

test("lets a later authoritative response remove omitted media", () => {
  const existing = media("existing");
  const deleted = media("deleted");
  const requestItemIds = new Set([existing.id, deleted.id]);

  expect(mergeMediaItems([existing, deleted], [existing], requestItemIds)).toEqual([existing]);
  expect(mergeMediaItems([existing, deleted], [], requestItemIds)).toEqual([]);
});
