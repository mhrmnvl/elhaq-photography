import {expect, test} from "bun:test";
import * as React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import {NextIntlClientProvider} from "next-intl";

import {ContactForm} from "@/components/contact-form";
import {Input} from "@/components/ui/input";
import {Checkbox} from "@/components/ui/checkbox";
import {readFile} from "node:fs/promises";
import {Select, SelectTrigger, SelectValue} from "@/components/ui/select";
import {Textarea} from "@/components/ui/textarea";
import messages from "@/messages/en.json";

test("select items position the checkmark indicator on the left like GitLab", async () => {
  const selectSource = await readFile(new URL("./select.tsx", import.meta.url), "utf8");

  expect(selectSource).toContain("pl-8");
  expect(selectSource).toContain("pr-3");
  expect(selectSource).toContain("left-2.5");
  expect(selectSource).not.toContain("right-3");
  expect(selectSource).toContain("data-highlighted:bg-accent");
  expect(selectSource).toContain("data-[state=checked]:bg-accent");
  expect(selectSource).toContain("data-[state=checked]:font-medium");
  expect(selectSource).toContain("data-[state=checked]:border-ring");
  expect(selectSource).toContain("border-transparent");
});

test("select content renders an arrow linking the popover to the trigger", async () => {
  const selectSource = await readFile(new URL("./select.tsx", import.meta.url), "utf8");

  expect(selectSource).toContain("SelectArrow");
  expect(selectSource).toContain('data-slot="select-arrow"');
  expect(selectSource).toContain("fill-popover");
  expect(selectSource).toContain("stroke-border");
  expect(selectSource).toContain("[&>span:has(svg)]:!visible");
});

test("select trigger meets the compact control size", () => {
  const markup = renderToStaticMarkup(
    <Select>
      <SelectTrigger><SelectValue /></SelectTrigger>
    </Select>
  );

  expect(markup).toContain("data-[size=default]:h-9");
});

test("text fields and select trigger keep visible focus without shadow rings", () => {
  const input = renderToStaticMarkup(<Input />);
  const textarea = renderToStaticMarkup(<Textarea />);
  const trigger = renderToStaticMarkup(
    <Select><SelectTrigger><SelectValue /></SelectTrigger></Select>
  );

  for (const markup of [input, textarea, trigger]) {
    expect(markup).not.toContain("ring-");
    expect(markup).toContain("focus-visible:border-ring");
  }
});

test("checkbox focus and invalid states do not add shadow rings", () => {
  const markup = renderToStaticMarkup(<Checkbox />);

  expect(markup).not.toContain("focus-visible:ring-2");
  expect(markup).not.toContain("aria-invalid:ring");
});

test("contact form keeps every floating label associated with its control", () => {
  const markup = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ContactForm locale="en" />
    </NextIntlClientProvider>
  );
  const fields = [...markup.matchAll(/<div class="contact-field(?: [^"]*)?"[^>]*>([\s\S]*?)<\/div>/g)];
  const ids = [
    "contact-name",
    "contact-email",
    "contact-whatsapp",
    "contact-event-type",
    "contact-event-date",
    "contact-event-location",
    "contact-message",
  ];

  expect(fields).toHaveLength(ids.length);
  for (const id of ids) {
    const field = fields.find(([, content]) => content.includes(`id="${id}"`))?.[1];
    expect(field).toContain(`for="${id}"`);
  }
});

test("contact form keeps the shared component styling with no page-specific override", () => {
  const markup = renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <ContactForm locale="en" />
    </NextIntlClientProvider>
  );
  const formClass = markup.match(/<form [^>]*class="([^"]*)"/)?.[1] ?? "";

  expect(formClass).toContain("contact-form");
  // Formulir kontak memakai komponen apa adanya, tanpa kelas gaya khusus halaman.
  expect(formClass).not.toContain("contact-form--ruled");
  expect(markup).not.toContain("contact-form--ruled");
});

test("tabs line variant renders full-width bottom border separator and underline trigger", async () => {
  const {Tabs, TabsList, TabsTrigger, TabsContent} = await import("@/components/ui/tabs");
  const markup = renderToStaticMarkup(
    <Tabs defaultValue="active" variant="line">
      <TabsList>
        <TabsTrigger value="active">Active</TabsTrigger>
        <TabsTrigger value="inactive">Inactive</TabsTrigger>
      </TabsList>
      <TabsContent value="active">Active content</TabsContent>
      <TabsContent value="inactive">Inactive content</TabsContent>
    </Tabs>
  );

  expect(markup).toContain('data-variant="line"');
  expect(markup).toContain("border-b border-border");
  expect(markup).toContain("-mb-px");
  expect(markup).toContain("border-b-2");
  expect(markup).toContain("data-[state=active]:border-foreground");
  expect(markup).toContain("Active");
  expect(markup).toContain("Inactive");
});
