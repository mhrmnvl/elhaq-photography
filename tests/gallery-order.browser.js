// Run through Playwright browser_run_code_unsafe with the dev server running.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- The browser tool invokes this expression.
async (page) => {
  const results = [];
  for (const width of [1280, 390]) {
    await page.setViewportSize({width, height: 800});
    await page.goto("http://localhost:3000/en");
    await page.waitForFunction(() => document.querySelectorAll("[data-gallery-cycle]").length >= 3);
    await page.waitForTimeout(150);
    const read = () => page.locator("[data-gallery-cycle]").evaluateAll((cycles) => cycles.map((cycle) =>
      [...cycle.querySelectorAll('[data-slot="photo-tile"] img')].map((img) => img.src).join("|")));
    const initial = await read();
    if (initial.some((order) => order !== initial[0])) throw Error("Opening orders differ");
    await page.waitForFunction(() => document.querySelector("[data-photo-wall]").dataset.opening === "finishing", null, {timeout: 15000});
    if ((await read())[0] !== initial[0]) throw Error("Opening changed the first row");
    await page.waitForFunction(() => !document.querySelector("[data-photo-wall]").hasAttribute("data-opening"));
    await page.waitForTimeout(150);
    const normal = await read();
    if (normal[0] !== initial[0] || normal[1] === initial[0]) throw Error("Randomization started at the wrong time");
    await page.evaluate(() => {
      dispatchEvent(new Event("wheel"));
      const cycles = document.querySelectorAll("[data-gallery-cycle]");
      const period = cycles[1].getBoundingClientRect().top - cycles[0].getBoundingClientRect().top;
      scrollTo({top: period + 100, behavior: "instant"});
    });
    await page.waitForTimeout(150);
    if ((await read())[0] !== normal[1]) throw Error("Visible order changed at the loop boundary");
    results.push({width, openingPreserved: true, nextLoopRandom: true});
  }
  return results;
}
