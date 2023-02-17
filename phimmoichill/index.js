const fs = require("fs");
const papa = require("papaparse");
const puppeteer = require("puppeteer");
const { PathTrackingData } = require("./core/const");

const curDate = new Date();
const timeDate = curDate.toLocaleTimeString("vi").replace(/:/g, "");
const shortDate = curDate
  .toLocaleString("vi", { dateStyle: "short" })
  .replace(/\//g, "");
fs.mkdirSync(`./phimmoichill/bk`, { recursive: true });

fs.mkdirSync(`./phimmoichill/bk/${shortDate}/${timeDate}`, { recursive: true });

fs.readdirSync(`./phimmoichill/data`).forEach((file) => {
  fs.copyFileSync(
    `./phimmoichill/data/${file}`,
    `./phimmoichill/bk/${shortDate}/${timeDate}/${file}.backup`
  );
});

fs.readdir("./phimmoichill/bk", function (err, files) {
  files = files
    .map((f) => ({
      name: f,
      time: fs.statSync("./phimmoichill/bk" + "/" + f).mtime.getTime(),
    }))
    .sort((a, b) => a.time - b.time)
    .map((v) => v.name);
  files.slice(0, files.length - 5).forEach((file) => {
    fs.rmSync(`./phimmoichill/bk/${file}`, { recursive: true });
  });
});

async function main() {
  console.log("Đang mở trình duyệt...");
  const browser = await puppeteer.launch({ headless: false });

  console.log("Lấy dữ liệu...");
  const idsTracking = await getTracking(browser);
  console.log("Dữ liệu mới: ", idsTracking.join(", ") || "No Data");

  console.log("Hoàn tất!");
}

async function getTracking(browser) {
  const prevData = papa
    .parse(fs.readFileSync(PathTrackingData, { flag: "r", encoding: "utf8" }), {
      header: true,
      skipEmptyLines: true,
    })
    .data.reduce(
      (obj, item) => Object.assign(obj, { [item.movieId]: { ...item } }),
      {}
    );

  const ids = [];
  const page = await browser.newPage();

  let index = 0;

  /* Film Odd */

  do {
    index += 1;
    const path = `https://phimmoichilla.net/list/phim-le/page-${index}/`;
    await page.goto(path);

    const pageData = await page.evaluate(() => {
      const movieItem = document.querySelectorAll(".list-film .item");

      const movieItemArr = Array.from(movieItem);
      if (movieItemArr.length === 0) return movieItemArr;

      return movieItemArr.map((movieItem) => {
        const movieLink = movieItem.querySelector("a").href;
        const movieId = movieLink.split("-").pop().replace("pm", "");
        const movieName = movieItem.querySelector("h3").innerText.trim();
        const movieImage = movieItem.querySelector("img").src;
        const movieEpisode = movieItem.querySelector("span.label").innerText;

        const movieImageSplit = movieImage.split("&url=")?.[1];
        const movieImageDecode = decodeURIComponent(movieImageSplit);

        return {
          movieId,
          movieLink,
          movieName,
          movieImage: movieImageDecode,
          movieEpisodeTotal: "",
          movieEpisodeCurrent: movieEpisode,
        };
      });
    });

    const isEndUpdate =
      pageData.length === 0 ||
      pageData.every((item) => prevData?.[item.movieId]);

    if (isEndUpdate) {
      break;
    }

    pageData.forEach((item) => {
      const csvItem = prevData?.[item.movieId];
      if (!csvItem) {
        ids.push(item.movieId);
        prevData[item.movieId] = item;
      }
    });
  } while (true);

  const csvDataArr = Object.values(prevData);
  const csvDataString = papa.unparse(csvDataArr, { header: true });
  fs.writeFileSync(PathTrackingData, csvDataString, { flag: "w" });

  /* Film Series */
  index = 0;
  do {
    index += 1;
    const path = `https://phimmoichilla.net/list/phim-bo/page-${index}/`;
    await page.goto(path);

    const pageData = await page.evaluate(() => {
      const movieItem = document.querySelectorAll(".list-film .item");

      const movieItemArr = Array.from(movieItem);
      if (movieItemArr.length === 0) return movieItemArr;

      return movieItemArr.map((movieItem) => {
        const movieLink = movieItem.querySelector("a").href;
        const movieId = movieLink.split("-").pop().replace("pm", "");
        const movieName = movieItem.querySelector("h3").innerText.trim();
        const movieImage = movieItem.querySelector("img").src;
        const movieEpisode = movieItem.querySelector("span.label").innerText;

        const movieImageSplit = movieImage.split("&url=")?.[1];
        const movieImageDecode = decodeURIComponent(movieImageSplit);

        const movieEpisodeCurrent = movieEpisode
          .split("/")[0]
          .replace("Tập", "")
          .trim();

        return {
          movieId,
          movieLink,
          movieName,
          movieImage: movieImageDecode,
          movieEpisodeTotal: "",
          movieEpisodeCurrent,
        };
      });
    });

    const isEndUpdate =
      pageData.length === 0 ||
      pageData.every(
        (item) =>
          prevData?.[item.movieId]?.movieEpisodeCurrent ===
          item?.movieEpisodeCurrent
      );

    if (isEndUpdate) {
      break;
    }

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
  } while (true);

  return ids;
}

module.exports = main;
