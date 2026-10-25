// Run with Playwright browser_run_code_unsafe's filename argument against the dev server.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- The browser tool invokes this function expression.
async (page) => {
  const results = [];
  for (const width of [1280, 390]) {
    await page.setViewportSize({width, height: 800});
    await page.goto("http://localhost:3000/en");
    await page.locator("[data-photo-wall]").waitFor({state: "visible"});
    await page.waitForFunction(() => document.querySelectorAll("[data-gallery-cycle]").length >= 3);
    await page.mouse.move(0, 0);
    results.push(await page.evaluate(async () => {
      const wall = document.querySelector("[data-photo-wall]");
      const cycles = wall.querySelectorAll("[data-gallery-cycle]");
      const period = cycles[1].getBoundingClientRect().top - cycles[0].getBoundingClientRect().top;
      const start = wall.getBoundingClientRect().top + scrollY;
      const count = wall.querySelectorAll('[data-slot="photo-tile"]').length;
      for (let i = 0; i < 5; i++) {
        dispatchEvent(new Event("wheel"));
        scrollTo({top: start + period + 100, behavior: "instant"});
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        if (Math.abs(scrollY - start - 100) > 2) throw Error(`Loop failed at ${innerWidth}px`);
      }
      if (wall.querySelectorAll('[data-slot="photo-tile"]').length !== count) throw Error("Gallery grew after looping");
      if (document.documentElement.scrollWidth > innerWidth) throw Error("Horizontal overflow");
      dispatchEvent(new Event("wheel"));
      scrollTo({top: start + period - 5, behavior: "instant"});
      return {width: innerWidth, period, tiles: count};
    }));
    await page.waitForFunction(() => {
      const wall = document.querySelector("[data-photo-wall]");
      const start = wall.getBoundingClientRect().top + scrollY;
      return scrollY >= start && scrollY < start + 200;
    }, null, {timeout: 8000});
    const tile = page.locator('[data-slot="photo-tile"]').first();
    const href = await tile.getAttribute("href");
    const box = await tile.boundingBox();
    await page.mouse.move(box.x + box.width / 2, Math.max(80, box.y + box.height / 2));
    await tile.click();
    await page.waitForURL((url) => url.pathname.endsWith(href));
  }
  return results;
}
