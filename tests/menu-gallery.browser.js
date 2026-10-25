// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Invoked by Playwright browser_run_code_unsafe.
async (page) => {
  const results = [];
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({width, height: 800});
    await page.goto("http://localhost:3000/en");
    await page.waitForFunction(() => {
      const wall = document.querySelector("[data-photo-wall]");
      return wall && !wall.hasAttribute("data-opening");
    }, null, {timeout: 16000});
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    const firstTop = await page.locator('[data-slot="photo-tile"]').first().evaluate((tile) => tile.getBoundingClientRect().top);
    await page.getByRole("button", {name: "Open menu", exact: true}).click();
    await page.waitForTimeout(500);
    const open = await page.evaluate(() => {
      const panel = document.querySelector("#site-menu");
      const trigger = document.querySelector('button[aria-controls="site-menu"]');
      const languages = [...panel.querySelectorAll('a[aria-label^="Language:"]')];
      const links = [...panel.querySelector('nav').querySelectorAll('a')];
      const navigation = panel.querySelector('nav').getBoundingClientRect();
      const language = languages[0].closest('nav').getBoundingClientRect();
      return {
        height: panel.getBoundingClientRect().height,
        bottom: panel.getBoundingClientRect().bottom,
        photoTop: document.querySelector('[data-slot="photo-tile"]').getBoundingClientRect().top,
        locked: getComputedStyle(document.documentElement).overflowY === "hidden" || document.querySelector("main").hasAttribute("inert"),
        overflow: document.documentElement.scrollWidth > innerWidth,
        triggerText: [...trigger.querySelectorAll("span")].some((span) => getComputedStyle(span).display !== "none" && span.textContent.trim().toLowerCase() === "menu"),
        triggerWidth: trigger.getBoundingClientRect().width,
        languageBoxes: languages.some((link) => getComputedStyle(link).backgroundColor !== "rgba(0, 0, 0, 0)"),
        languageBelow: language.top >= navigation.bottom,
        navigationCentered: Math.abs((navigation.left + navigation.right) / 2 - innerWidth / 2) < 1,
        languageCentered: !panel.querySelector('a[target="_blank"]') && Math.abs((language.left + language.right) / 2 - innerWidth / 2) < 1,
        uppercase: getComputedStyle(links[0]).textTransform === "uppercase",
        linkFontSize: parseFloat(getComputedStyle(links[0]).fontSize),
        linkPositions: links.map((link) => ({x: link.getBoundingClientRect().x, y: link.getBoundingClientRect().y})),
      };
    });
    if (open.locked || open.height >= 500 || open.photoTop <= firstTop + 20 || open.photoTop < open.bottom - 1) throw Error(`Menu does not push an unlocked gallery: ${JSON.stringify(open)}`);
    if (open.overflow || open.languageBoxes || open.triggerWidth < 44 || (width < 640 && open.triggerText)) throw Error(`Menu layout failed: ${JSON.stringify(open)}`);
    if (!open.languageBelow || !open.navigationCentered || open.uppercase) throw Error(`Centered menu placement failed: ${JSON.stringify(open)}`);
    if (open.linkFontSize > 18) throw Error(`Menu typography dominates the brand: ${open.linkFontSize}px`);
    if (open.linkPositions.some((link) => link.y !== open.linkPositions[0].y)) throw Error(`Navigation is not one row: ${JSON.stringify(open.linkPositions)}`);
    const start = await page.evaluate(() => scrollY);
    await page.waitForTimeout(3200);
    if (Math.abs(await page.evaluate(() => scrollY) - start) > 1) throw Error("Idle started too early");
    await page.waitForTimeout(1800);
    if (await page.evaluate(() => scrollY) <= start) throw Error("Open menu blocks idle scrolling");
    await page.mouse.move(width - 30, 650);
    const manualStart = await page.evaluate(() => scrollY);
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(350);
    if (await page.evaluate(() => scrollY) <= manualStart) throw Error("Open menu blocks manual scrolling");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(450);
    if (await page.getByRole("button", {name: "Open menu", exact: true}).getAttribute("aria-expanded") !== "false") throw Error("Escape does not close menu");
    await page.getByRole("button", {name: "Open menu", exact: true}).click();
    await page.waitForTimeout(400);
    await page.locator('#site-menu a[aria-label="Language: Bahasa Indonesia"]').click();
    await page.waitForURL("**/id");
    if (width === 320) {
      await page.waitForFunction(() => {
        const wall = document.querySelector("[data-photo-wall]");
        return wall && !wall.hasAttribute("data-opening");
      }, null, {timeout: 16000});
      await page.locator('button[aria-controls="site-menu"]').click();
      await page.waitForTimeout(450);
      const fits = await page.locator("#site-menu nav").first().evaluate((nav) => {
        const links = [...nav.querySelectorAll("a")];
        return nav.getBoundingClientRect().width <= innerWidth - 48 && links.every((link) => link.querySelector("span").getBoundingClientRect().height < 24);
      });
      if (!fits) throw Error("Indonesian menu does not fit one row at 320px");
    }
    results.push({width, pushesGallery: true, idleAndManualScroll: true, languageNavigation: true});
  }
  return results;
}
