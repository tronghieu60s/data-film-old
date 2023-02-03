const fs = require("fs");
const { PathWatchData, PathWatchTempData } = require("./core/const");
const { writeDataToCsv } = require("./core/functions");

async function getWatch(browser, idsUpdate) {
  const page = await browser.newPage();

  browser.on("targetcreated", async (target) => {
    const page = await target.page();
    if (page) page.close();
  });

  const idsTemp =
    fs
      .readFileSync(PathWatchTempData, "utf8")
      .split("\n")
      .filter((item) => item) || [];
  fs.writeFileSync(PathWatchTempData, "");

  idsUpdate = [...idsTemp, ...idsUpdate];
  for (let i = 0; i < idsUpdate.length; i += 1) {
    const [ep, link] = idsUpdate[i]?.split("|");
    if (!link) continue;

    const path = `https://animehay.pro/xem-phim/-${link}.html`;
    await page.goto(path, { timeout: 0, waitUntil: "domcontentloaded" });
    await new Promise((resolve) => setTimeout(resolve, 500));

    const is404 = await page.$(".ah_404");
    if (is404) {
      continue;
    }

    if ((await page.$("#count-second-unlock")) !== null) {
      fs.writeFileSync(PathWatchTempData, `${idsUpdate[i]}\n`, { flag: "a" });
      continue;
    }

    const pageData = await page.evaluate(() => {
      const svHydrax = document.querySelector("#sv_Hydrax");
      svHydrax?.click();

      const movieLinkSelector = document.querySelector("link[rel=canonical]");
      const movieLink = movieLinkSelector?.href || "";
      const movieEpId = movieLink?.split("-").pop().split(".")[0] || "";

      const movieIdSelector = document.querySelector(
        'a[title="Thông tin phim"]'
      );
      const movieId =
        movieIdSelector?.href?.split("-").pop().split(".")[0] || "";

      const movieHdxSelector = document.querySelector("#video-player iframe");
      const movieHdx = movieHdxSelector?.src || "";

      return { movieId, movieEpId, movieLink, movieHdx };
    });

    const epData = { movieEp: ep, ...pageData };

    writeDataToCsv(epData, PathWatchData);
  }

  await page.close();
}

module.exports = getWatch;
