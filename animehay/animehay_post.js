const fs = require("fs");
const papa = require("papaparse");
const { PathPostData, PathPostTempData } = require("./core/const");

const prevData = papa
  .parse(fs.readFileSync(PathPostData, { flag: "r", encoding: "utf8" }), {
    header: true,
    skipEmptyLines: true,
  })
  .data.reduce(
    (obj, item) => Object.assign(obj, { [item.movieId]: { ...item } }),
    {}
  );

async function getPost(browser, idsUpdate) {
  const ids = [];
  const page = await browser.newPage();

  const idsTemp = fs.readFileSync(PathPostTempData, "utf8").split("\n");
  fs.writeFileSync(PathPostTempData, "");

  idsUpdate = [...idsTemp, ...idsUpdate];
  for (let i = 0; i < idsUpdate.length; i += 1) {
    const link = idsUpdate[i];
    const path = `https://animehay.pro/thong-tin-phim/-${link}.html`;
    await page.goto(path);

    const pageData = await page.evaluate(() => {
      const movieLinkSelector = document.querySelector("link[rel=canonical]");
      const movieLink = movieLinkSelector?.href || "";
      const movieId = movieLink?.split("-").pop().split(".")[0] || "";

      const movieNameSelector = document.querySelector(".heading_movie");
      const movieName = movieNameSelector?.innerText || "";

      const movieOriginalNameSelector = document.querySelector(
        ".name_other div:nth-child(2)"
      );
      const movieOriginalName = movieOriginalNameSelector?.innerText || "";

      const movieImageSelector = document.querySelector(
        ".heading_movie ~ div img"
      );
      const movieImage = movieImageSelector?.src || "";

      const movieCategoriesSelector =
        document.querySelectorAll(".list_cate div a");
      const movieCategories = Array.from(movieCategoriesSelector)
        .map((item) => item.innerText)
        .join("|");

      const movieStatusSelector = document.querySelector(
        ".status div:nth-child(2)"
      );
      const movieStatus = movieStatusSelector?.innerText
        .toLowerCase()
        .replace(/^.|\s\S/g, (a) => a.toUpperCase());

      const moviePublishSelector = document.querySelector(
        ".update_time div:nth-child(2)"
      );
      const moviePublish = moviePublishSelector?.innerText || "";

      const movieDurationSelector = document.querySelector(
        ".duration div:nth-child(2)"
      );
      const movieDuration =
        movieDurationSelector?.innerText.toLowerCase() || "";

      const movieDescriptionSelector = document.querySelector(
        ".desc div:nth-child(2)"
      );
      const movieDescription = movieDescriptionSelector?.innerText || "";

      let movieEpisodeTotal = 1;
      if (movieDuration.includes("tập")) {
        movieEpisodeTotal = movieDuration.split("tập")?.[0].trim() || 1;
      }

      const movieEpisodeCurrentSelector = document.querySelector(
        ".list-item-episode a"
      );
      const movieEpisodeCurrent = movieEpisodeCurrentSelector?.innerText || 1;

      const movieEpisodesSelector = document.querySelectorAll(
        ".list-item-episode a"
      );
      const movieEpisodes = Array.from(movieEpisodesSelector)
        .reverse()
        .map(
          (item) =>
            `${item.innerText}|${item.href?.split("-").pop().split(".")[0]}`
        )
        .join("||");

      return {
        movieId,
        movieLink,
        movieName,
        movieImage,
        movieOriginalName,
        movieCategories,
        movieStatus,
        moviePublish,
        movieDuration,
        movieDescription,
        movieEpisodeTotal,
        movieEpisodeCurrent,
        movieEpisodes,
      };
    });

    const prevDataItem = prevData?.[pageData.movieId];
    if (!prevDataItem) {
      prevData[pageData.movieId] = pageData;
      ids.push(...pageData.movieEpisodes.split("||"));
    }

    if (prevDataItem?.movieEpisodes !== pageData?.movieEpisodes) {
      prevData[pageData.movieId] = pageData;
      const epsData = pageData.movieEpisodes.replace(
        `${prevDataItem?.movieEpisodes || ''}||`,
        ""
      );
      ids.push(...epsData.split("||"));
    }
  }

  const csvDataArr = Object.values(prevData);
  const csvDataString = papa.unparse(csvDataArr, { header: true });
  fs.writeFileSync(PathPostData, csvDataString, { flag: "w" });

  await page.close();

  return ids;
}

module.exports = getPost;
