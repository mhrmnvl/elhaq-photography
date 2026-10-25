import {expect, mock, test} from "bun:test";
import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";

import type {SettingsFormProps} from "@/components/admin/settings-form";
import {emptySiteSettings, settingsScopes, type SettingsScope} from "@/lib/settings-scopes";

mock.module("next/navigation", () => ({useRouter: () => ({refresh: () => undefined})}));

const {SettingsForm} = await import("@/components/admin/settings-form");

const scopeMarkers: Record<SettingsScope, {label: string; marker: string}> = {
  brand: {label: "Brand", marker: 'id="settings-brand-name"'},
  home: {label: "Home", marker: 'id="settings-home-headline-en"'},
  about: {label: "About", marker: 'id="settings-about-story-en"'},
  services: {label: "Services", marker: 'id="service-wedding-title-en"'},
  contact: {label: "Contact", marker: 'id="settings-instagram"'},
  featured: {label: "Featured albums", marker: "Only published albums can appear in Selected Stories."},
};

function render(initialScope?: SettingsScope): string {
  return renderToStaticMarkup(<SettingsForm initialSettings={emptySiteSettings} featuredAlbums={[]} initialScope={initialScope} />);
}

// Radix keeps a wrapper div per Content, renders children only for the selected panel, and
// marks inactive wrappers `hidden`. Visibility is therefore Radix's job, not a hand-rolled class.
function panels(markup: string): Array<{scope: string | undefined; hidden: boolean}> {
  return [...markup.matchAll(/<div\b[^>]*role="tabpanel"[^>]*>/g)].map(([tag]) => ({
    scope: tag.match(/data-scope="([a-z]+)"/)?.[1],
    hidden: tag.includes(" hidden"),
  }));
}

function visibleScopes(markup: string): Array<string | undefined> {
  return panels(markup).filter((panel) => !panel.hidden).map((panel) => panel.scope);
}

test("all six labelled tabs exist and only the selected panel keeps its fields", () => {
  const markup = render();

  expect(markup.match(/role="tab"/g)).toHaveLength(settingsScopes.length);
  expect(panels(markup).map((panel) => panel.scope)).toEqual([...settingsScopes]);
  expect(visibleScopes(markup)).toEqual(["brand"]);
  for (const scope of settingsScopes) expect(markup).toContain(`>${scopeMarkers[scope].label}<`);
  expect(markup).toContain(scopeMarkers.brand.marker);
  expect(markup).not.toContain(scopeMarkers.contact.marker);
  // The hand-rolled hiding mechanisms are gone: Radix owns visibility now.
  expect(markup).not.toContain("data-[state=inactive]:hidden");
});

test("initialScope selects the visible panel and names its save button", () => {
  for (const scope of settingsScopes) {
    const markup = render(scope);

    expect(visibleScopes(markup)).toEqual([scope]);
    expect(markup).toContain(scopeMarkers[scope].marker);
    expect(markup).toContain(`Save ${scopeMarkers[scope].label}<`);
  }
});

test("tab triggers use the 44px-class tap target, not the old one", () => {
  const markup = render();

  expect(markup).toContain("min-h-13");
  expect(markup).not.toContain("min-h-11");
});

const logoAssetId = "11111111-1111-4111-8111-111111111111";

test("each media field is a slot that opens the picker dialog", () => {
  expect(render()).toContain("Choose logo");
  expect(render()).toContain("Add logo");
  expect(render("home")).toContain("Add hero photo");
  expect(render("about")).toContain("Add about photo");
  // The always-open library grid is gone; the dialog owns picking.
  expect(render()).not.toContain("Media library");
});

test("the preview itself is the only picker control per slot", () => {
  const markup = render();

  expect(markup.match(/aria-label="Choose logo"/g)).toHaveLength(1);
  expect(markup).not.toContain("Select imagery from your media library");
  expect(markup).not.toContain("asset</h4>");
});

test("a saved asset turns the picture into the change control with an X to remove", () => {
  const markup = renderToStaticMarkup(
    <SettingsForm initialSettings={{...emptySiteSettings, logoMediaId: logoAssetId}} featuredAlbums={[]} />
  );

  // Clicking the preview opens the picker; the X in the corner removes it.
  expect(markup).toContain('aria-label="Choose logo"');
  expect(markup).toContain('aria-label="Remove logo"');
  expect(markup).not.toContain("Change logo");
  expect(markup).not.toContain("No logo selected");
});

test("the brand tab lays the logo out directly beside the name and alternate text without a card wrapper", () => {
  const markup = render();
  const logo = markup.indexOf("Add logo");
  const name = markup.indexOf('id="settings-brand-name"');
  const altEn = markup.indexOf('id="settings-logo-alt-en"');
  const altId = markup.indexOf('id="settings-logo-alt-id"');

  // The brand tab attaches directly without a card wrapper or redundant heading.
  expect(markup).not.toContain("Brand Identity");
  expect(markup).not.toContain("Studio Logo");
  expect(markup.match(/rounded-xl border border-border p-5 sm:p-6 bg-card/g)).toBeNull();
  expect(logo).toBeGreaterThan(-1);
  expect(logo).toBeLessThan(name);
  expect(name).toBeLessThan(altEn);
  expect(altEn).toBeLessThan(altId);
  expect(markup).toContain("English logo alternate text");
  expect(markup).toContain("Indonesian logo alternate text");
});

test("the home tab lays its fields out without card wrappers", () => {
  const markup = render("home");

  expect(markup).not.toContain("Hero Photograph");
  expect(markup).not.toContain("Headlines & Introductions");
  expect(markup.match(/rounded-xl border border-border p-5 sm:p-6 bg-card/g)).toBeNull();
  expect(markup).toContain('id="settings-hero-alt-en"');
  expect(markup).toContain('id="settings-home-headline-en"');
  expect(markup).toContain('id="settings-introduction-en"');
});

test("no tab wraps its fields in a card, so each tab reads as one form", () => {
  for (const scope of settingsScopes) {
    expect(render(scope)).not.toContain("rounded-xl border border-border p-5 sm:p-6 bg-card");
  }
});

test("paired fields share a row instead of stacking one per row", () => {
  const brand = render();

  // Logo alternate text lives in the field column, English beside Indonesian.
  expect(brand).toContain("md:col-span-9 space-y-5");
  expect(brand).toContain('class="grid gap-4 sm:grid-cols-2"');

  const contact = render("contact");

  // Instagram and WhatsApp share a row inside the panel instead of stacking with a dead gap.
  expect(contact).toContain("grid gap-x-5 gap-y-4 sm:grid-cols-2");
  expect(contact).toContain('id="settings-instagram"');
  expect(contact).toContain('id="settings-whatsapp"');
});

test("the small action buttons carry a 44px hit area", () => {
  const withLogo = renderToStaticMarkup(
    <SettingsForm initialSettings={{...emptySiteSettings, logoMediaId: logoAssetId}} featuredAlbums={[]} />
  );

  // The X over the photo plus Save in the footer.
  expect(withLogo.match(/after:h-\[44px\]/g)).toHaveLength(2);
  expect(withLogo.match(/after:inset-x-0/g)).toHaveLength(2);
  // The empty brand panel only has the Save button.
  expect(render().match(/after:h-\[44px\]/g)).toHaveLength(1);
});

test("brand, about, and home put the media left with all their pairs beside it", () => {
  const brand = render();
  const about = render("about");
  const home = render("home");

  for (const [markup, pairs] of [[brand, 1], [about, 2], [home, 4]] as const) {
    // media column | field column holding every pair
    expect(markup).toContain("md:col-span-3");
    expect(markup).toContain("md:col-span-9 space-y-5");
    // Each pair keeps English and Indonesian side by side.
    expect(markup.match(/class="grid gap-4 sm:grid-cols-2"/g)).toHaveLength(pairs);
  }

  // Order: media, then the fields from top to bottom.
  expect(brand.indexOf("settings-brand-name")).toBeLessThan(brand.indexOf("settings-logo-alt-en"));
  expect(about.indexOf("settings-about-alt-en")).toBeLessThan(about.indexOf("settings-about-story-en"));
  expect(home.indexOf("settings-hero-alt-en")).toBeLessThan(home.indexOf("settings-home-headline-en"));
  expect(home.indexOf("settings-home-description-en")).toBeLessThan(home.indexOf("settings-introduction-en"));
});

test("services read as one flow with the service name inside each label", () => {
  const services = render("services");

  // Six pairs, no section legend: the service name is part of the floating label.
  expect(services.match(/class="grid gap-4 sm:grid-cols-2"/g)).toHaveLength(6);
  expect(services).toContain(">English wedding title</label>");
  expect(services).toContain(">Indonesian events description</label>");
  expect(services).toContain(">English other photography description</label>");
  expect(services).not.toContain("<h3");
});

test("featured albums render as a data table with infinite scroll instead of pagination", () => {
  const albums: SettingsFormProps["featuredAlbums"] = Array.from({length: 25}, (_, index) => ({
    id: `album-${index + 1}`,
    title: {en: `Album ${index + 1}`, id: `Album ${index + 1} ID`},
    status: index % 2 === 0 ? "published" : "draft",
  }));
  const markup = renderToStaticMarkup(
    <SettingsForm initialSettings={emptySiteSettings} featuredAlbums={albums} initialScope="featured" />
  );

  expect(markup).toContain("<table");
  expect(markup).toContain(">Album<");
  expect(markup).toContain(">Status<");
  expect(markup).toContain('aria-label="Feature Album 1"');
  // Only the first batch is rendered; the rest waits for the scroll sentinel (20 rows + header).
  expect(markup.match(/data-slot="table-row"/g)).toHaveLength(21);
  expect(markup).toContain("Showing 20 of 25 albums");
  // No pagination controls.
  expect(markup).not.toContain("Rows per page");
  expect(markup).not.toContain("Go to next page");
});

test("tabs read as one continuous field flow without section headings", () => {
  const about = render("about");
  const contact = render("contact");

  expect(about).not.toContain("About Portrait");
  expect(about).not.toContain("Artist Biography");
  expect(contact).not.toContain("Travel Availability");
  expect(contact).not.toContain("Direct Channels");
  // The fields themselves still follow each other in order.
  expect(about.indexOf("settings-about-alt-en")).toBeLessThan(about.indexOf("settings-about-story-en"));
  expect(contact.indexOf("settings-location-en")).toBeLessThan(contact.indexOf("settings-instagram"));
});

test("bilingual pairs float a label that names the language and the field", () => {
  const home = render("home");
  const brand = render();

  // Every pair spells out what the field holds, right after the language.
  expect(home).toContain(">English home description</label>");
  expect(home).toContain(">Indonesian home description</label>");
  expect(home).toContain(">English personal introduction</label>");
  expect(home).toContain(">English home headline</label>");
  expect(brand).toContain(">English logo alternate text</label>");
  // No vague wording and no duplicate group legend.
  expect(home).not.toContain("narrative");
  expect(home).not.toContain("<legend");
});

test("the save button follows the content instead of being pinned", () => {
  const markup = render();
  const footerIndex = markup.indexOf("<footer");
  const spacerIndex = markup.indexOf('aria-hidden="true" class="flex-1"');

  // Same flow as the album editor: the panel scrolls with the shell, the flexible spacer only
  // lifts the footer while there is nothing to scroll.
  expect(markup).toContain("admin-form flex flex-1 flex-col space-y-4");
  expect(spacerIndex).toBeGreaterThan(-1);
  expect(spacerIndex).toBeLessThan(footerIndex);
  // No inner scroll region that would keep the action button glued to the panel floor.
  expect(markup).not.toContain("overflow-y-auto");
});

test("the save footer never pins itself to the viewport", () => {
  const markup = render();
  const footer = markup.match(/<footer[^>]*>/)?.[0] ?? "";

  // No sticky overlay and no negative margin: the shell content area itself ends on the card floor,
  // so the footer lands there for short and long content alike.
  expect(footer).not.toContain("sticky");
  expect(footer).not.toContain("bottom-0");
  expect(footer).not.toContain("-mb-5");
  expect(footer).toContain("rounded-b-xl");
  // It still bleeds to the panel edges and keeps its top border.
  expect(footer).toContain("border-t");
  expect(footer).toContain("-mx-4");
  expect(footer).toContain("sm:-mx-5");
  expect(footer).toContain("px-4");
  expect(footer).toContain("sm:px-5");
});


