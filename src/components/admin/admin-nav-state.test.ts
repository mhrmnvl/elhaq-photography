import {expect, test} from "bun:test";

import {isAdminNavActive} from "@/components/admin/admin-nav-state";

test("Dashboard matches only the exact admin route", () => {
  expect(isAdminNavActive("/admin", "/admin")).toBe(true);
  expect(isAdminNavActive("/admin/albums", "/admin")).toBe(false);
});

test("detail routes activate their parent navigation item", () => {
  expect(isAdminNavActive("/admin/albums/album-1", "/admin/albums")).toBe(true);
  expect(isAdminNavActive("/admin/messages/message-1", "/admin/messages")).toBe(true);
});

test("a similar route prefix does not activate the item", () => {
  expect(isAdminNavActive("/admin/messages-old", "/admin/messages")).toBe(false);
});
