const fs = require("fs");
const papa = require("papaparse");
const puppeteer = require("puppeteer");
const {
  PathTrackingData,
  PathPostData,
  PathPostTempData,
  PathWatchTempData,
  PathWatchData,
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

  console.log("Đang cập nhật dữ liệu...");
  const idsPost = await getPost(browser, idsTracking);

  // console.log("Đang cập nhật dữ liệu xem phim...");
  // await getWatch(browser, idsPost);

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
          movieEpisodeTotal: 1,
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
            .trim()
            .split(" ")[0]
            .trim();
          if (movieEpisodeCurrent.includes("/")) {
            movieEpisodeTotal = movieEpisodeCurrent.split("/")[1];
            movieEpisodeCurrent = movieEpisodeCurrent.split("/")[0];
          }
        } else if (movieEpisode.toLowerCase().includes("hoàn tất")) {
          const split = movieEpisode.substring(
            movieEpisode.indexOf("(") + 1,
            movieEpisode.indexOf(")")
          );
          movieEpisodeTotal = movieEpisodeCurrent = split.split("/")?.[0];
        } else if (movieEpisode.includes("/")) {
          const split = movieEpisode.split("/");
          movieEpisodeTotal = split?.[1];
          movieEpisodeCurrent = split?.[0];
          movieEpisodeTotal = movieEpisodeTotal
            .substring(0, movieEpisodeTotal.indexOf(" "))
            .trim();
          movieEpisodeCurrent = movieEpisodeCurrent
            .substring(movieEpisodeCurrent.lastIndexOf(" "))
            .trim();
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

    try {
      await page.waitForSelector(".film-info", { timeout: 5000 });
    } catch (error) {}

    if (!page.url().includes("https://phimmoichilla.net/info/")) {
      fs.writeFileSync(PathPostTempData, `${link}\n`, { flag: "a" });
      continue;
    }

    const pageData = await page.evaluate(async () => {
      const movieLink =
        document.querySelector("link[rel=canonical]")?.href || "";
      const movieId = movieLink?.split("-").pop().replace("pm", "") || "";
      const movieName =
        document.querySelector(".film-info .text h1")?.innerText || "";

      let movieOriginalName =
        document.querySelector(".film-info .text h2")?.innerText || "";
      movieOriginalName = movieOriginalName
        .substring(0, movieOriginalName.lastIndexOf("("))
        .trim();

      const movieImage =
        document.querySelector(".film-info .avatar")?.src || "";

      let movieStatus = "";
      let moviePublish = "";
      let movieCountry = "";
      let movieCategories = "";
      let movieDirectors = "";
      let movieCast = "";
      let movieDuration = "";
      let movieEpisode = "";
      const movieMetaSelector = document.querySelectorAll(
        ".film-info .entry-meta li"
      );
      Array.from(movieMetaSelector).forEach((item) => {
        if (item.innerText.includes("Đang phát:")) {
          movieStatus =
            item.innerText.replace("Đang phát:", "").trim() || "Hoàn Thành";
          movieEpisode = item.innerText.replace("Đang phát:", "").trim() || "";
          if (
            !movieStatus.toLowerCase().includes("hoàn tất") &&
            document.querySelector(".latest-episode")
          ) {
            movieStatus = "Đang Tiến Hành";
          }
        } else if (item.innerText.includes("Năm Phát Hành:")) {
          moviePublish =
            item.innerText.replace("Năm Phát Hành: ", "").trim() || "";
        } else if (item.innerText.includes("Quốc gia:")) {
          movieCountry =
            item.innerText.replace("Năm phát hành: ", "").trim() || "";
        } else if (item.innerText.includes("Thể loại:")) {
          const movieCategoriesSelector = item.querySelectorAll("a");
          movieCategories = Array.from(movieCategoriesSelector)
            .map((item) => item.innerText)
            .join("|");
        } else if (item.innerText.includes("Đạo diễn:")) {
          const movieDirectorsSelector = item.querySelectorAll("a");
          movieDirectors = Array.from(movieDirectorsSelector)
            .map((item) => item.innerText)
            .join("|");
        } else if (item.innerText.includes("Diễn viên:")) {
          const movieCastSelector = item.querySelectorAll("a");
          movieCast = Array.from(movieCastSelector)
            .map((item) => item.innerText)
            .join("|");
        } else if (item.innerText.includes("Thời lượng:")) {
          movieDuration =
            item.innerText.replace("Thời lượng:", "").trim() || "";
        }
      });

      const movieTagsSelector = document.querySelectorAll(".tags-list a");
      const movieTags = Array.from(movieTagsSelector)
        .map((item) => item.innerText)
        .join("|");

      const movieDescription =
        document.querySelector("#film-content")?.innerText || "";

      let movieEpisodeTotal = 1;
      let movieEpisodeCurrent = movieEpisode;
      if (movieEpisode.toLowerCase().includes("hoàn tất")) {
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
            ?.innerText.replace("Tập", "")
            .trim()?.innerText || 1;
      } else if (movieEpisode.includes("/")) {
        const split = movieEpisode.split("/");
        movieEpisodeTotal = split?.[1];
        movieEpisodeCurrent = split?.[0];
        movieEpisodeTotal = movieEpisodeTotal
          .substring(0, movieEpisodeTotal.indexOf(" "))
          .trim();
        movieEpisodeCurrent = movieEpisodeCurrent
          .substring(movieEpisodeCurrent.lastIndexOf(" "))
          .trim();
      }

      let movieTrailer = "";
      document.querySelector(".list-button li:nth-child(1) a")?.click();
      await new Promise((resolve) => {
        let times = 0;
        const timeout = setInterval(() => {
          times += 1;
          movieTrailer =
            document
              .querySelector("#mediaplayer_youtube")
              ?.src?.split("?")[0] || "";
          if (movieTrailer || times > 10) {
            clearInterval(timeout);
            resolve();
          }
        }, 500);
      });

      const movieWatch =
        document.querySelector(".list-button li:nth-child(2):not(#download) a")
          ?.href || "";

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
        movieTags,
        movieStatus,
        moviePublish,
        movieDuration,
        movieDescription,
        movieTrailer,
        movieWatch,
        movieEpisodeTotal,
        movieEpisodeCurrent,
      };
    });

    let movieEpisodes = "";
    const watchLink = pageData.movieWatch;
    if (watchLink) {
      await page.goto(watchLink);
      movieEpisodes = await page.evaluate(() => {
        const list = document.querySelectorAll(
          "#list-server #list_episodes li a"
        );

        const movieLink =
          document.querySelector("link[rel=canonical]")?.href || "";
        const movieId = movieLink?.split("-").pop().replace("pm", "") || "";

        if (!list.length) {
          return `Full|${movieId}`;
        }
        const episodes = Array.from(list).map((item) => {
          const ep = item.innerText.replace("Tập", "").trim();
          const link = item.getAttribute("data-id");
          return `${ep}|${link}`;
        });
        return `${episodes.join("||")}`;
      });
    }
    delete pageData.movieWatch;
    pageData.movieEpisodes = movieEpisodes;

    const prevDataItem = prevData?.[pageData.movieId];
    if (!prevDataItem) {
      prevData[pageData.movieId] = pageData;
      ids.push(...pageData.movieEpisodes.split("||"));
    }

    if (prevDataItem?.movieEpisodes !== pageData?.movieEpisodes) {
      prevData[pageData.movieId] = pageData;
      const epsData = pageData.movieEpisodes.replace(
        `${prevDataItem?.movieEpisodes || ""}||`,
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

async function getWatch(browser, idsUpdate) {
  const prevData = papa.parse(
    fs.readFileSync(PathWatchData, { flag: "r", encoding: "utf8" }),
    { header: true, skipEmptyLines: true }
  ).data;

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

  idsUpdate = [...new Set([...idsTemp, ...idsUpdate])];
  for (let i = 0; i < idsUpdate.length; i += 1) {
    const link = idsUpdate[i];

    const path = `https://phimmoichilla.net/xem/-pm${link}`;
    await page.goto(path);

    const listData = await page.evaluate(() => {
      const list = document.querySelectorAll("#list_episodes li a");
      const listData = Array.from(list).map((item) => {
        const ep = item.innerText.replace("Tập", "").trim();
        const link = item.getAttribute("data-id");
        return `${ep}|${link}`;
      });
      return listData;
    });

    const pageData = await page.evaluate(() => {
      const serverBtn = document.querySelectorAll(".list-episode a");
      Array.from(serverBtn).forEach((item) => {
        if (item.innerText.includes("PMFAST")) item.click();
      });
    });
  }
}

module.exports = main;
