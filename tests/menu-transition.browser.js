// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- Invoked by Playwright browser_run_code_unsafe.
async (page) => {
  const results = [];
  for (const width of [1280, 390]) {
    await page.setViewportSize({width, height: 800});
    await page.goto("http://localhost:3000/en");
    await page.waitForFunction(() => !document.querySelector("[data-photo-wall]").hasAttribute("data-opening"), null, {timeout: 16000});
    for (const action of ["Open menu", "Close menu"]) {
      await page.getByRole("button", {name: action, exact: true}).click();
      const errors = await page.evaluate(async () => {
        const errors = [];
        for (let frame = 0; frame < 18; frame++) {
          await new Promise(requestAnimationFrame);
          const cycles = document.querySelectorAll("[data-gallery-cycle]");
          const period = cycles[1].getBoundingClientRect().top - cycles[0].getBoundingClientRect().top;
          scrollTo({top: period + 80, behavior: "instant"});
          dispatchEvent(new Event("scroll"));
          errors.push(Math.abs(scrollY - 80));
        }
        return errors;
      });
      if (errors.some((error) => error > 1)) throw Error(`Loop uses stale geometry during ${action}: ${JSON.stringify(errors)}`);
    }
    results.push({width, transitionLoopPreserved: true});
  }
  return results;
}
