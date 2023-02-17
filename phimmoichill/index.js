const fs = require("fs");
const papa = require("papaparse");
const puppeteer = require("puppeteer");
const {
  PathTrackingData,
  PathPostData,
  PathPostTempData,
} = require("./core/const");

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

  // console.log("Đang cập nhật dữ liệu...");
  // const idsPost = await getPost(browser, idsTracking);
  // console.log("Dữ liệu tập phim mới: ", idsPost.join(", ") || "No Data");

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
  console.log("Đang cập nhật phim lẻ...");
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

    if (!isEndUpdate) {
      pageData.forEach((item) => {
        const csvItem = prevData?.[item.movieId];
        if (!csvItem) {
          ids.push(item.movieId);
          prevData[item.movieId] = item;
        }
      });
      continue;
    }

    break;
  } while (true);

  const csvOddArr = Object.values(prevData);
  const csvOddString = papa.unparse(csvOddArr, { header: true });
  fs.writeFileSync(PathTrackingData, csvOddString, { flag: "w" });

  /* Film Series */
  console.log("Đang cập nhật phim bộ...");
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

        let movieEpisodeTotal = "";
        let movieEpisodeCurrent = "";
        if (movieEpisode.includes("Tập")) {
          movieEpisodeTotal = "??";
          movieEpisodeCurrent = movieEpisode
            .split("-")[0]
            .replace("Tập", "")
            .trim();
        }
        if (movieEpisode.includes("Hoàn Tất")) {
          const split = movieEpisode.substring(
            movieEpisode.indexOf("(") + 1,
            movieEpisode.indexOf(")")
          );
          movieEpisodeTotal = movieEpisodeCurrent = split.split("/")?.[0];
        }

        return {
          movieId,
          movieLink,
          movieName,
          movieImage: movieImageDecode,
          movieEpisodeTotal,
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

  const csvSeriesArr = Object.values(prevData);
  const csvSeriesString = papa.unparse(csvSeriesArr, { header: true });
  fs.writeFileSync(PathTrackingData, csvSeriesString, { flag: "w" });

  await page.close();

  return ids;
}

async function getPost(browser, idsUpdate) {
  const prevData = papa
    .parse(fs.readFileSync(PathPostData, { flag: "r", encoding: "utf8" }), {
      header: true,
      skipEmptyLines: true,
    })
    .data.reduce(
      (obj, item) => Object.assign(obj, { [item.movieId]: { ...item } }),
      {}
    );

  const ids = [];
  const page = await browser.newPage();

  const idsTemp =
    fs
      .readFileSync(PathPostTempData, "utf8")
      .split("\n")
      .filter((item) => item) || [];
  fs.writeFileSync(PathPostTempData, "");

  idsUpdate = [...new Set([...idsTemp, ...idsUpdate])];
  for (let i = 0; i < idsUpdate.length; i += 1) {
    const link = idsUpdate[i];
    const path = `https://phimmoichilla.net/info/-pm${link}`;
    await page.goto(path);

    if (page.url() !== path) {
      continue;
    }

    const pageData = await page.evaluate(() => {
      const movieLink =
        document.querySelector("link[rel=canonical]")?.href || "";
      const movieId = movieLink?.split("-").pop().replace("pm", "") || "";
      const movieName =
        document.querySelector(".film-info .text h1")?.innerText || "";
      const movieOriginalName =
        document
          .querySelector(".film-info .text h2")
          ?.innerText.substring(0, text.lastIndexOf("("))
          .trim() || "";
      const movieImage =
        document.querySelector(".film-info .avatar").src?.src || "";

      const movieCategoriesSelector = document.querySelectorAll(
        ".film-info .entry-meta li:nth-child(4) a"
      );
      const movieCategories = Array.from(movieCategoriesSelector)
        .map((item) => item.innerText)
        .join("|");

      const movieCountry =
        document.querySelector(".film-info .entry-meta li:nth-child(3) a")
          ?.innerText || "";

      const movieDirectorsSelector = document.querySelectorAll(
        ".film-info .entry-meta li:nth-child(5) a"
      );
      const movieDirectors = Array.from(movieDirectorsSelector)
        .map((item) => item.innerText)
        .join("|");

      const movieCastSelector = document.querySelectorAll(
        ".film-info .entry-meta li:nth-child(8) a"
      );
      const movieCast = Array.from(movieCastSelector)
        .map((item) => item.innerText)
        .join("|");

      let movieStatus =
        document.querySelector(".film-info .entry-meta li:nth-child(1) span")
          ?.innerText || "Hoàn Thành";
      if (
        !movieStatus.includes("Hoàn Tất") &&
        document.querySelector(".latest-episode")
      ) {
        movieStatus = "Đang Tiến Hành";
      }

      const moviePublish =
        document.querySelector(".film-info .entry-meta li:nth-child(2) a")
          ?.innerText || "";
      const movieDuration =
        document
          .querySelector(".film-info .entry-meta li:nth-child(7)")
          ?.innerText.replace("Thời lượng:", "")
          .trim() || "";

      const movieDescription =
        document.querySelector("#film-content")?.innerText || "";
      const movieEpisode = document.querySelector(
        ".film-info .entry-meta li:nth-child(1) span"
      );

      let movieEpisodeTotal = "";
      let movieEpisodeCurrent = "";
      if (movieEpisode.includes("Hoàn Tất")) {
        const split = movieEpisode.substring(
          movieEpisode.indexOf("(") + 1,
          movieEpisode.indexOf(")")
        );
        movieEpisodeTotal = movieEpisodeCurrent = split.split("/")?.[0];
      } else if (document.querySelector(".latest-episode")) {
        movieEpisodeTotal = "??";
        movieEpisodeCurrent =
          document
            .querySelector(".latest-episode a")
            .innerText.replace("Tập", "")
            .trim()?.innerText || 1;
      }

      return {
        movieId,
        movieLink,
        movieName,
        movieImage,
        movieOriginalName,
        movieCategories,
        movieCountry,
        movieDirectors,
        movieCast,
        movieStatus,
        moviePublish,
        movieDuration,
        movieDescription,
        movieEpisodeTotal,
        movieEpisodeCurrent,
      };
    });

    const prevDataItem = prevData?.[pageData.movieId];
    if (!prevDataItem) {
      prevData[pageData.movieId] = pageData;
      ids.push(...pageData.movieEpisodes.split("||"));
    }

    if (prevDataItem?.movieEpisodeCurrent !== pageData?.movieEpisodeCurrent) {
      prevData[pageData.movieId] = pageData;
      ids.push(pageData.movieId);
    }
  }

  const csvDataArr = Object.values(prevData);
  const csvDataString = papa.unparse(csvDataArr, { header: true });
  fs.writeFileSync(PathPostData, csvDataString, { flag: "w" });

  await page.close();

  return ids;
}

module.exports = main;
