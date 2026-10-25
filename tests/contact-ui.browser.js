// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Invoked by Playwright browser_run_code_unsafe.
async (page) => {
  const results = [];
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({width, height: 800});
    await page.emulateMedia({reducedMotion: "no-preference"});
    await page.goto("http://localhost:3000/en/contact");
    await page.waitForSelector("#contact-name");
    await page.waitForSelector("[data-contact-motion]");
    const entrance = await page.evaluate(() => ({headingOffset: new DOMMatrixReadOnly(getComputedStyle(document.querySelector('.contact-heading-line > span')).transform).m42, row: Number(getComputedStyle(document.querySelector('.contact-form__row')).opacity)}));
    if (entrance.headingOffset < 1 && entrance.row > 0.98) throw Error("Contact entrance already appeared fully visible before animating");
    await page.waitForFunction(() => [...document.querySelectorAll('.contact-heading-line > span')].every((line) => line.hasAttribute("data-contact-visible") && Math.abs(new DOMMatrixReadOnly(getComputedStyle(line).transform).m42) < 0.5));
    const timing = await page.evaluate(() => ({
      headingMs: parseFloat(getComputedStyle(document.querySelector('.contact-heading-line > span')).animationDuration) * 1000,
      fields: [...document.querySelectorAll('.contact-form__row[data-contact-visible]')].map((row) => ({delay: parseFloat(getComputedStyle(row).animationDelay) * 1000, duration: parseFloat(getComputedStyle(row).animationDuration) * 1000})),
    }));
    if (timing.headingMs < 1200 || timing.fields.some((field, index) => field.duration > 400 || (index > 0 && field.delay < timing.fields[index - 1].delay + timing.fields[index - 1].duration - 5))) throw Error(`Contact animations have wrong speed or overlap: ${JSON.stringify(timing)}`);
    const layout = await page.evaluate(() => {
      const input = document.querySelector("#contact-name");
      const heading = document.querySelector("h1");
      const style = getComputedStyle(input);
      return {
        boxed: style.borderTopWidth !== "0px" || style.borderLeftWidth !== "0px" || style.borderRadius !== "0px",
        controlHeight: input.getBoundingClientRect().height,
        headingWeight: getComputedStyle(heading).fontWeight,
        headingLines: heading.querySelectorAll(".contact-heading-line").length,
        headingVisible: [...heading.querySelectorAll('.contact-heading-line > span')].every((line) => line.hasAttribute("data-contact-visible") && Math.abs(new DOMMatrixReadOnly(getComputedStyle(line).transform).m42) < 0.5),
        overflow: document.documentElement.scrollWidth > innerWidth,
        motionReady: Boolean(document.querySelector("[data-contact-motion]")),
        footer: Boolean(document.querySelector("footer")),
        solidHeader: getComputedStyle(document.querySelector("header")).position === "sticky" && getComputedStyle(document.querySelector("header")).backgroundColor === "rgb(246, 241, 233)" && !document.querySelector("header.site-header--knockout"),
      };
    });
    if (!layout.boxed || layout.controlHeight < 35.5 || layout.headingWeight !== "400" || layout.headingLines !== 2 || !layout.headingVisible || layout.overflow || !layout.motionReady || layout.footer || !layout.solidHeader) throw Error(`Existing contact styling or reveal failed: ${JSON.stringify(layout)}`);
    const labelBefore = await page.locator('label[for="contact-name"]').evaluate((label) => label.getBoundingClientRect().top);
    await page.getByLabel("Name", {exact: true}).fill("UI check");
    await page.waitForTimeout(200);
    const labelAfter = await page.locator('label[for="contact-name"]').evaluate((label) => label.getBoundingClientRect().top);
    if (labelAfter >= labelBefore) throw Error("Name label no longer floats");
    await page.locator("#contact-event-type").click();
    await page.getByRole("option", {name: "Other photography", exact: true}).click();
    if (!(await page.locator("#contact-event-type").innerText()).includes("Other photography")) throw Error("Event selector did not update");
    const emptyDateLabel = await page.locator('label[for="contact-event-date"]').evaluate((label) => label.getBoundingClientRect().top - label.closest(".contact-field").getBoundingClientRect().top);
    if (emptyDateLabel < 5) throw Error("Empty date label floats before interaction");
    await page.locator("#contact-event-date").click();
    await page.getByRole("grid").waitFor();
    await page.keyboard.press("Escape");
    const submit = page.getByRole("button", {name: "Send enquiry", exact: true});
    await submit.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1100);
    await submit.hover();
    await page.waitForTimeout(450);
    const rolls = await submit.locator(".contact-submit__clip > span").first().evaluate((span) => getComputedStyle(span).transform !== "none");
    if (!rolls) throw Error("Submit hover does not roll its text");
    await submit.click();
    if (!(await page.locator('.contact-form div[role="alert"]').innerText()).includes("Check")) throw Error("Empty contact fields no longer validate");
    await page.waitForFunction(() => [...document.querySelectorAll('.contact-form__row')].every((row) => row.getBoundingClientRect().top >= innerHeight || Number(getComputedStyle(row).opacity) > 0.99), null, {timeout: 12000});
    const end = await page.evaluate(() => ({overflow: document.documentElement.scrollWidth > innerWidth, hiddenFields: [...document.querySelectorAll(".contact-form__row")].filter((row) => row.getBoundingClientRect().top < innerHeight && getComputedStyle(row).opacity === "0").length}));
    if (end.overflow || end.hiddenFields) throw Error(`Contact reveal hid usable content: ${JSON.stringify(end)}`);
    results.push({width, floatingLabels: true, formControls: true, validation: true, motion: true});
  }
  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto("http://localhost:3000/id/contact");
  await page.waitForSelector("#contact-name");
  const reduced = await page.evaluate(() => ({overflow: document.documentElement.scrollWidth > innerWidth, hidden: [...document.querySelectorAll("[data-contact-reveal]")].some((node) => getComputedStyle(node).opacity === "0"), motionReady: Boolean(document.querySelector("[data-contact-motion]"))}));
  if (reduced.overflow || reduced.hidden || reduced.motionReady) throw Error(`Reduced-motion content is not immediately usable: ${JSON.stringify(reduced)}`);
  await page.emulateMedia({reducedMotion: "no-preference"});
  return {results, reducedMotion: true};
}
