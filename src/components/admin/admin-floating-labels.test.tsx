import {expect, mock, test} from "bun:test";
import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";

import {settingsScopes} from "@/lib/settings-scopes";

mock.module("next/navigation", () => ({useRouter: () => ({refresh: () => undefined})}));

const {SettingsForm, emptySiteSettings} = await import("@/components/admin/settings-form");
const {AlbumEditor} = await import("@/components/admin/album-editor");
const {AlbumPhotoList} = await import("@/components/admin/album-photo-list");
const {PrivateLinkForm} = await import("@/components/admin/private-link-form");

function expectFloatingFields(markup: string): void {
  expect(markup).toContain('class="admin-form');

  const fields = [...markup.matchAll(/<div class="contact-field(?: [^"]*)?"([^>]*)>([\s\S]*?)<\/div>/g)];
  const controls = [...markup.matchAll(/data-slot="(?:input|textarea|select-trigger)"/g)];
  expect(fields).toHaveLength(controls.length);

  for (const [, attributes, content] of fields) {
    const id = content.match(/\bid="([^"]+)"/)?.[1];
    expect(id).toBeDefined();
    expect(content).toContain(`for="${id}"`);
    if (content.includes('data-slot="select-trigger"')) expect(attributes).toContain('data-floating="true"');
    else expect(content).toMatch(/placeholder="[^"]*"/);
  }
}

test("settings contact fields retain their content width", () => {
  const brand = renderToStaticMarkup(<SettingsForm initialSettings={emptySiteSettings} featuredAlbums={[]} />);
  const contact = renderToStaticMarkup(<SettingsForm initialSettings={emptySiteSettings} featuredAlbums={[]} initialScope="contact" />);

  for (const [id, markup] of [["settings-instagram", contact], ["settings-whatsapp", contact]] as const) {
    const fields = [...markup.matchAll(/<div class="contact-field(?: [^"]*)?"([^>]*)>([\s\S]*?)<\/div>/g)];
    const field = fields.find(([, , content]) => content.includes(`id="${id}"`))?.[0] ?? "";
    expect(field).toContain("max-w-xl");
  }

  const brandFields = [...brand.matchAll(/<div class="contact-field(?: [^"]*)?"([^>]*)>([\s\S]*?)<\/div>/g)];
  const brandField = brandFields.find(([, , content]) => content.includes('id="settings-brand-name"'))?.[0] ?? "";
  expect(brandField).toContain("w-full");
});

test("admin settings, album, photo alt text, and private links use linked floating labels", () => {
  // Radix only renders the active panel's children, so each scope needs its own render.
  const settingsPanels = settingsScopes.map((scope) =>
    renderToStaticMarkup(<SettingsForm initialSettings={emptySiteSettings} featuredAlbums={[]} initialScope={scope} />)
  );
  const album = renderToStaticMarkup(<AlbumEditor initialAlbum={null} />);
  const photos = renderToStaticMarkup(
    <div className="admin-form">
      <AlbumPhotoList photos={[{mediaId: "media-1", position: 0, alt: {en: "", id: ""}}]} onChange={() => undefined} />
    </div>
  );
  const links = renderToStaticMarkup(<PrivateLinkForm initialLinks={[]} />);

  for (const markup of [...settingsPanels, album, photos, links]) expectFloatingFields(markup);
});
