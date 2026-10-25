// Run with Playwright browser_run_code_unsafe's filename argument against the dev server.
// eslint-disable-next-line @typescript-eslint/no-unused-expressions -- The browser tool invokes this function expression.
async (page) => {
  const out = {};
  await page.setViewportSize({width: 1280, height: 800});
  await page.goto("http://localhost:3000/en");
  await page.waitForFunction(() => document.querySelector(".site-intro__letter--out")?.getBoundingClientRect().width > 0, null, {timeout: 8000});

  out.initial = await page.evaluate(() => {
    const letters = [...document.querySelectorAll(".site-intro__letter--out")];
    const boxes = letters.map((l) => l.getBoundingClientRect());
    const group = document.querySelector(".site-intro__group").getBoundingClientRect();
    const percent = document.querySelector("[data-slot='intro-percent']");
    const text = document.querySelector("[data-slot='intro-text']").getBoundingClientRect();
    return {
      phase: document.querySelector("[data-slot='site-intro']").getAttribute("data-phase"),
      glYphFill: Math.round(((Math.max(...boxes.map((b) => b.right)) - Math.min(...boxes.map((b) => b.left))) / innerWidth) * 100),
      top: Math.round(group.top),
      percentText: percent.textContent,
      percentBelowText: Math.round(percent.getBoundingClientRect().top) > Math.round(text.bottom) - 2,
      oneLine: Math.round(text.height) < 120,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });

  const samples = [];
  const t0 = Date.now();
  await page.goto("http://localhost:3000/en", {waitUntil: "domcontentloaded"});
  const startScroll = await page.evaluate(() => Math.round(scrollY));
  while (Date.now() - t0 < 20000) {
    const s = await page.evaluate(() => {
      const intro = document.querySelector("[data-slot='site-intro']");
      const phase = intro?.getAttribute("data-phase") ?? "gone";
      const text = document.querySelector("[data-slot='intro-text']");
      const slots = [...document.querySelectorAll(".site-intro__slot")];
      const band = text?.getBoundingClientRect();
      const overlap = (el) => {
        if (!band) return 0;
        const r = el.getBoundingClientRect();
        return Math.max(0, Math.min(r.bottom, band.bottom) - Math.max(r.top, band.top));
      };
      let emptySlots = 0;
      let movingSlots = 0;
      for (const slot of slots) {
        const outLetter = slot.querySelector(".site-intro__letter--out");
        const inLetter = slot.querySelector(".site-intro__letter--in");
        const t = getComputedStyle(outLetter).translate;
        if (t && !t.endsWith(" 0%") && !t.endsWith(" 0px")) movingSlots += 1;
        if (Math.max(overlap(outLetter), overlap(inLetter)) < 3) emptySlots += 1;
      }
      return {
        phase,
        scroll: Math.round(scrollY),
        movingSlots,
        emptySlots,
        percent: document.querySelector("[data-slot='intro-percent']")?.textContent ?? null,
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    samples.push({...s, at: Date.now() - t0});
    await page.waitForTimeout(60);
  }

  const waving = samples.filter((s) => s.phase === "waving");
  out.wave = {
    samples: waving.length,
    maxEmptySlots: Math.max(...waving.map((s) => s.emptySlots)),
    maxMovingSlots: Math.max(...waving.map((s) => s.movingSlots)),
    percentAtWaveStart: waving[0]?.percent,
    percentAtWaveEnd: waving.at(-1)?.percent,
    hundredBeforeWaveEnded: waving.some((s) => s.percent === "100%") && waving.at(-1)?.percent === "100%",
    overflowSeen: samples.some((s) => s.overflow),
  };
  out.phases = [...new Set(samples.map((s) => s.phase))];
  out.phaseAt = {waving: samples.find((s) => s.phase === "waving")?.at, leaving: samples.find((s) => s.phase === "leaving")?.at, curtain: samples.find((s) => s.phase === "curtain")?.at, gone: samples.find((s) => s.phase === "gone")?.at};

  // Setelah animasi gulir pembuka selesai, harus kembali ke posisi awal.
  await page.waitForTimeout(5200);
  out.startScroll = startScroll;
  out.scrollAfterOpening = await page.evaluate(() => Math.round(scrollY));

  // Hover: komponen membesar, foto tetap 110%, foto lain turun ke 100%.
  await page.mouse.move(0, 0);
  await page.evaluate(() => window.scrollTo({top: 0, behavior: "instant"}));
  await page.waitForTimeout(600);
  const box = await page.locator('[data-slot="photo-tile"]').first().boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(900);
  out.hover = await page.evaluate(() => {
    const tiles = document.querySelectorAll('[data-slot="photo-tile"]');
    const read = (el) => {
      const img = el.querySelector("img");
      const r = el.getBoundingClientRect();
      return {tileScale: getComputedStyle(el).scale, imgScale: getComputedStyle(img).scale, width: Math.round(r.width), opacity: getComputedStyle(el).opacity};
    };
    return {active: read(tiles[0]), other: read(tiles[1])};
  });
  return out;
}
