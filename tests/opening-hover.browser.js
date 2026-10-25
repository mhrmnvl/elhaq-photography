// Run through Playwright browser_run_code_unsafe with the dev server running.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- The browser tool invokes this expression.
async (page) => {
  const results = [];
  for (const width of [1280, 390]) {
    await page.setViewportSize({width, height: 800});
    await page.goto("http://localhost:3000/en");
    await page.waitForFunction(() => document.querySelector('[data-slot="site-intro"]')?.dataset.phase === "waving");
    const progress = [];
    for (let i = 0; i < 6; i++) {
      progress.push(await page.locator('[data-slot="intro-percent"]').innerText());
      await page.waitForTimeout(280);
    }
    if (progress[0] === "100%" || progress.at(-1) === progress[0]) throw Error("Counter does not follow the letters");
    await page.waitForFunction(() => document.querySelector('[data-slot="intro-percent"]')?.textContent === "100%" && document.querySelector('[data-slot="site-intro"]')?.dataset.phase === "waving");
    await page.waitForFunction(() => !document.querySelector('[data-slot="site-intro"]'), null, {timeout: 10000});
    const box = await page.locator('[data-slot="photo-tile"]').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + 100);
    const normal = await page.locator('[data-slot="photo-tile"]').first().evaluate((tile) => getComputedStyle(tile).scale);
    if (normal !== "none" && normal !== "1") throw Error("Hover is active during the opening");
    const samples = [];
    for (let i = 0; i < 23; i++) {
      samples.push(await page.evaluate(() => Math.round(scrollY)));
      await page.waitForTimeout(200);
    }
    await page.waitForFunction(() => !document.querySelector('[data-photo-wall]').hasAttribute("data-opening"));
    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    const end = await page.evaluate(() => ({
      scroll: scrollY,
      tileTop: document.querySelector('[data-slot="photo-tile"]').getBoundingClientRect().top,
      overflow: document.documentElement.scrollWidth > innerWidth,
    }));
    if (Math.abs(end.scroll) > 1 || Math.abs(end.tileTop - 56) > 1 || end.overflow) throw Error(`Wrong resting position: ${JSON.stringify(end)}`);
    if (Math.max(...samples) < 100) throw Error("Hover interrupted the opening scroll");
    if (await page.locator('[data-gallery-tail]').first().isVisible()) throw Error("The last-photo strip did not exit");
    await page.waitForTimeout(2700);
    if (await page.evaluate(() => scrollY) > 1) throw Error("Idle started before four seconds");
    await page.waitForTimeout(1800);
    if (await page.evaluate(() => scrollY) < 1) throw Error("Idle did not start");
    await page.mouse.move(box.x + box.width / 2, 180);
    await page.waitForTimeout(200);
    const paused = await page.evaluate(() => scrollY);
    await page.waitForTimeout(1200);
    if (await page.evaluate(() => scrollY) < paused - 1) throw Error("Idle scrolling moved backwards");
    await page.waitForTimeout(3200);
    if (await page.evaluate(() => scrollY) <= paused) throw Error("Hover prevented idle scrolling after four seconds");
    const stationaryHover = await page.evaluate(() => {
      const tile = document.querySelector('[data-slot="photo-tile"]:hover');
      return tile ? getComputedStyle(tile).scale : "none";
    });
    if (stationaryHover !== "none" && stationaryHover !== "1") throw Error("A stationary cursor activates hover during idle");
    await page.mouse.move(box.x + box.width / 2 + 5, 185);
    await page.waitForTimeout(300);
    const stopped = await page.evaluate(() => scrollY);
    await page.waitForTimeout(900);
    if (Math.abs(await page.evaluate(() => scrollY) - stopped) > 1) throw Error("Pointer movement did not stop idle scrolling");
    results.push({width, progress, peak: Math.max(...samples), end});
  }
  return results;
}
