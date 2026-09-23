import {expect, test} from "bun:test";

import {getUploadRetryParts, updateUploadItem, uploadOne, type UploadFileState} from "@/components/admin/media-upload";

test("keeps the same intent and uploaded response for a commit retry", () => {
  const intent = {
    intentId: "00000000-0000-4000-8000-000000000001",
    cloudName: "demo",
    apiKey: "key",
    timestamp: 1789992000,
    signature: "intent-signature",
    publicId: "elhaq/uploads/intent-1",
    uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload",
    expiresAt: "2026-09-21T12:10:00.000Z",
  };
  const uploaded = {public_id: intent.publicId, version: 7, signature: "upload-signature"};

  const retry = getUploadRetryParts({intent, uploaded});

  expect(retry.intent).toBe(intent);
  expect(retry.uploaded).toBe(uploaded);
});

test("updates one upload state without removing a successful sibling", () => {
  const items: UploadFileState[] = [
    {id: "failed", name: "failed.jpg", status: "failed", message: "Upload failed", mediaId: null},
    {id: "success", name: "success.jpg", status: "success", message: "Upload complete", mediaId: "media-1"},
  ];

  const next = updateUploadItem(items, "failed", (item) => ({...item, status: "uploading" as const, message: null}));

  expect(next).toHaveLength(2);
  expect(next[0]).toEqual({...items[0], status: "uploading", message: null});
  expect(next[1]).toBe(items[1]);
});

test("uploads one file with the signed image form and commits the returned public ID", async () => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{url: string; init?: RequestInit}> = [];
  const media = {
    id: "media-1",
    cloudName: "demo",
    publicId: "elhaq/uploads/intent-1",
    secureUrl: "https://res.cloudinary.com/demo/image/upload/v7/elhaq/uploads/intent-1.jpg",
    width: 1200,
    height: 800,
    format: "jpg",
    bytes: 100,
    referenceCount: 0,
  };
  const file = new File(["image"], "portrait.jpg", {type: "image/jpeg"});

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    calls.push({url, init});
    if (url === "/api/admin/media") {
      return new Response(JSON.stringify({
        intentId: "00000000-0000-4000-8000-000000000001",
        cloudName: "demo",
        apiKey: "key",
        timestamp: 1789992000,
        signature: "intent-signature",
        publicId: "elhaq/uploads/intent-1",
        uploadUrl: "https://api.cloudinary.com/v1_1/demo/image/upload",
        expiresAt: "2026-09-21T12:10:00.000Z",
      }), {status: 200});
    }
    if (url.startsWith("https://api.cloudinary.com")) {
      const form = init?.body as FormData;
      const uploadedFile = form.get("file");
      expect(uploadedFile).toBeInstanceOf(File);
      expect((uploadedFile as File).name).toBe(file.name);
      expect((uploadedFile as File).type).toBe(file.type);
      expect(form.get("api_key")).toBe("key");
      expect(form.get("timestamp")).toBe("1789992000");
      expect(form.get("public_id")).toBe("elhaq/uploads/intent-1");
      expect(form.get("overwrite")).toBe("false");
      expect(form.get("allowed_formats")).toBe("jpg,png,webp,avif");
      expect(form.get("resource_type")).toBeNull();
      expect(form.get("folder")).toBeNull();
      expect(form.get("signature")).toBe("intent-signature");
      return new Response(JSON.stringify({public_id: "elhaq/uploads/intent-1", version: 7, signature: "upload-signature"}), {status: 200});
    }
    expect(url).toBe("/api/admin/media/commit");
    expect(JSON.parse(String(init?.body))).toEqual({
      intentId: "00000000-0000-4000-8000-000000000001",
      publicId: "elhaq/uploads/intent-1",
      version: 7,
      signature: "upload-signature",
    });
    return new Response(JSON.stringify({status: "created", media}), {status: 201});
  }) as typeof fetch;

  try {
    await expect(uploadOne(file)).resolves.toEqual(media);
  } finally {
    globalThis.fetch = originalFetch;
  }

  expect(calls.map((call) => call.url)).toEqual([
    "/api/admin/media",
    "https://api.cloudinary.com/v1_1/demo/image/upload",
    "/api/admin/media/commit",
  ]);
});
