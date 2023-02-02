const fs = require("fs");
const papa = require("papaparse");
const { PathTrackingData } = require("./core/const");

const prevData = papa
  .parse(fs.readFileSync(PathTrackingData, { flag: "r", encoding: "utf8" }), {
    header: true,
    skipEmptyLines: true,
  })
  .data.reduce(
    (obj, item) => Object.assign(obj, { [item.movieId]: { ...item } }),
    {}
  );

async function getTracking(browser) {
  const ids = [];
  const page = await browser.newPage();

  let index = 0;
  do {
    index += 1;
    const path = `https://animehay.pro/phim-moi-cap-nhap/trang-${index}.html`;
    await page.goto(path);

    const is404 = await page.$(".ah_404");
    if (is404) {
      break;
    }

    const pageData = await page.evaluate(() => {
      const movieItem = document.querySelectorAll(".movies-list .movie-item");
      
      const movieItemArr = Array.from(movieItem);
      return movieItemArr.map((movieItem) => {
        const movieId = movieItem.getAttribute("id").split("-")[2];
        const movieLink = movieItem.querySelector("a").href;
        const movieName = movieItem
          .querySelector(".name-movie")
          .innerText.trim();
        const movieImage = movieItem.querySelector("img").src;
        const movieEpisode =
          movieItem.querySelector(".episode-latest").innerText;

        let movieEpisodeTotal = movieEpisode.split("/")?.[1];
        let movieEpisodeCurrent = movieEpisode.split("/")?.[0];

        if (movieEpisode.toLowerCase().indexOf("phút") > -1) {
          movieEpisodeTotal = "";
          movieEpisodeCurrent = movieEpisode;
        }

        return {
          movieId,
          movieLink,
          movieName,
          movieImage,
          movieEpisodeTotal,
          movieEpisodeCurrent,
        };
      });
    });

    const isEndUpdate = pageData.every(
      (item) =>
        prevData?.[item.movieId]?.movieEpisodeCurrent ===
        item?.movieEpisodeCurrent
    );

    if (!isEndUpdate) {
      pageData.forEach((item) => {
        const csvItem = prevData?.[item.movieId];
        if (
          !csvItem ||
          csvItem?.movieEpisodeCurrent !== item?.movieEpisodeCurrent
        ) {
          ids.push(item.movieId);
          prevData[item.movieId] = item;
        }
      });
      continue;
    }

    break;
  } while (true);

  const csvDataArr = Object.values(prevData);
  const csvDataString = papa.unparse(csvDataArr, { header: true });
  fs.writeFileSync(PathTrackingData, csvDataString, { flag: "w" });

  await page.close();

  return ids;
}

module.exports = getTracking;
