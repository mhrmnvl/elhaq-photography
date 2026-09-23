import {expect, test} from "bun:test";

import en from "@/messages/en.json";
import id from "@/messages/id.json";

const keys = (value: unknown, prefix = ""): string[] => value && typeof value === "object"
  ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => keys(child, prefix ? `${prefix}.${key}` : key))
  : [prefix];

test("English and Indonesian message keys are identical", () => {
  expect(keys(id).sort()).toEqual(keys(en).sort());
});
