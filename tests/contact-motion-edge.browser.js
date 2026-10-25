// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Invoked by Playwright browser_run_code_unsafe.
async (page) => {
  await page.setViewportSize({width: 390, height: 600});
  await page.emulateMedia({reducedMotion: "no-preference"});
  await page.goto("about:blank");
  await page.goto("http://localhost:3000/en/contact#contact-message");
  await page.waitForSelector("#contact-message");
  await page.waitForTimeout(1000);
  if (await page.locator("h1").evaluate((heading) => heading.getBoundingClientRect().top >= 0)) throw Error("Restored-scroll scenario did not start below the heading");
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForFunction(() => [...document.querySelectorAll('.contact-heading-line > span')].every((line) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(line).transform).m42) < 0.5), null, {timeout: 5000});
  const restored = await page.locator(".contact-heading-line > span").evaluateAll((lines) => lines.every((line) => Math.abs(new DOMMatrixReadOnly(getComputedStyle(line).transform).m42) < 0.5));
  if (!restored) throw Error("A heading initially offscreen stays clipped when scrolled into view");

  await page.emulateMedia({reducedMotion: "reduce"});
  await page.goto("about:blank");
  await page.goto("http://localhost:3000/en/contact");
  const submit = page.getByRole("button", {name: "Send enquiry", exact: true});
  await submit.waitFor();
  await submit.hover();
  await submit.focus();
  const rolls = await submit.locator(".contact-submit__clip > span").evaluateAll((spans) => spans.some((span) => getComputedStyle(span).transform !== "none"));
  if (rolls) throw Error("Reduced motion still rolls submit text on hover/focus");

  await page.emulateMedia({reducedMotion: "no-preference"});
  await page.goto("about:blank");
  await page.goto("http://localhost:3000/en/contact#contact-message");
  await page.waitForSelector("[data-contact-motion]");
  await page.emulateMedia({reducedMotion: "reduce"});
  const changed = await page.locator(".contact-heading-line > span").evaluateAll((lines) => lines.every((line) => getComputedStyle(line).transform === "none"));
  if (!changed) throw Error("Changing reduced motion leaves a pending heading clipped");
  await page.emulateMedia({reducedMotion: "no-preference"});
  return {restoredScroll: true, reducedHoverAndFocus: true, changedMotionPreference: true};
}
