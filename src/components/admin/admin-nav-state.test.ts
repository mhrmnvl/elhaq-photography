import {expect, test} from "bun:test";

import {getAdminBreadcrumbs, isAdminNavActive} from "@/components/admin/admin-nav-state";

test("builds breadcrumbs for dashboard and admin sections", () => {
  expect(getAdminBreadcrumbs("/admin")).toEqual([{label: "Dashboard"}]);
  expect(getAdminBreadcrumbs("/admin/albums")).toEqual([
    {label: "Dashboard", href: "/admin"},
    {label: "Albums"},
  ]);
});

test("adds parent and detail crumbs for nested admin records", () => {
  expect(getAdminBreadcrumbs("/admin/albums/album-1")).toEqual([
    {label: "Dashboard", href: "/admin"},
    {label: "Albums", href: "/admin/albums"},
    {label: "Album details"},
  ]);
  expect(getAdminBreadcrumbs("/admin/messages/message-1")).toEqual([
    {label: "Dashboard", href: "/admin"},
    {label: "Messages", href: "/admin/messages"},
    {label: "Message details"},
  ]);
});

test("adds create album crumb when new parameter or path is present", () => {
  expect(getAdminBreadcrumbs("/admin/albums?new=1")).toEqual([
    {label: "Dashboard", href: "/admin"},
    {label: "Albums", href: "/admin/albums"},
    {label: "Create album"},
  ]);
  expect(getAdminBreadcrumbs("/admin/albums", new URLSearchParams("new=1"))).toEqual([
    {label: "Dashboard", href: "/admin"},
    {label: "Albums", href: "/admin/albums"},
    {label: "Create album"},
  ]);
  expect(getAdminBreadcrumbs("/admin/albums/new")).toEqual([
    {label: "Dashboard", href: "/admin"},
    {label: "Albums", href: "/admin/albums"},
    {label: "Create album"},
  ]);
});

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
