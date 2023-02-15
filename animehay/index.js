const fs = require("fs");
const papa = require("papaparse");
const puppeteer = require("puppeteer");
const {
  PathResultData,
  PathTrackingData,
  PathWatchTempData,
  PathPostData,
  PathWatchData,
  PathPostTempData,
} = require("./core/const");
const { writeDataToCsv } = require("./core/functions");

const curDate = new Date();
const timeDate = curDate.toLocaleTimeString("vi").replace(/:/g, "");
const shortDate = curDate
  .toLocaleString("vi", { dateStyle: "short" })
  .replace(/\//g, "");
fs.mkdirSync(`./animehay/bk`, { recursive: true });

fs.mkdirSync(`./animehay/bk/${shortDate}/${timeDate}`, { recursive: true });

fs.readdirSync(`./animehay/data`).forEach((file) => {
  fs.copyFileSync(
    `./animehay/data/${file}`,
    `./animehay/bk/${shortDate}/${timeDate}/${file}.backup`
  );
});

async function main() {
  console.log("Đang khởi tạo...");
  const browser = await puppeteer.launch({ headless: false });

  console.log("Lấy dữ liệu...");
  const idsTracking = await getTracking(browser);
  console.log("Dữ liệu mới: ", idsTracking.join(", ") || "No Data");

  console.log("Đang cập nhật dữ liệu...");
  const idsPost = await getPost(browser, idsTracking);
  console.log("Dữ liệu tập phim mới: ", idsPost.join(", ") || "No Data");

  console.log("Đang cập nhật dữ liệu...");
  await getWatch(browser, idsPost);

  await browser.close();

  console.log("Đang xuất dữ liệu ra file CSV...");
  const resultData = await getExportCsv();
  const csvDataString = papa.unparse(resultData, { header: true });
  fs.writeFileSync(PathResultData, csvDataString, { flag: "w" });

  console.log("Hoàn tất!");
}

main();

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

  idsUpdate = [...idsTemp, ...idsUpdate];
  for (let i = 0; i < idsUpdate.length; i += 1) {
    const link = idsUpdate[i];
    const path = `https://animehay.pro/thong-tin-phim/-${link}.html`;
    await page.goto(path);

    const is404 = await page.$(".ah_404");
    if (is404) {
      continue;
    }

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

async function getExportCsv() {
  const postData = papa.parse(
    fs.readFileSync(PathPostData, { flag: "r", encoding: "utf8" }),
    { header: true, skipEmptyLines: true }
  ).data;

  const watchData = papa
    .parse(fs.readFileSync(PathWatchData, { flag: "r", encoding: "utf8" }), {
      header: true,
      skipEmptyLines: true,
    })
    .data.reduce((cur, item) => {
      if (!cur[item.movieId]) cur[item.movieId] = [];
      const { movieEp, movieHdx } = item;
      cur[item.movieId].push({
        episode_name: movieEp,
        episode_slug: `tap-${movieEp}`,
        video_hydrax: movieHdx,
      });
      return cur;
    }, {});

  for (let index = 0; index < postData.length; index += 1) {
    delete postData[index].movieLink;
    postData[index].movieUniqueId = `animehay-${postData[index].movieId}`;
    postData[index].movieTags = postData[index]?.movieOriginalName
      .split(",")
      .join("|")
      .split("/")
      .join("|");
    postData[index].movieCountry =
      postData[index].movieCategories.indexOf("CN Animation") > -1
        ? "Trung Quốc"
        : "Nhật Bản";
    postData[index].movieEpisodes = `${JSON.stringify(
      watchData[postData[index].movieId] || []
    )}`;
  }

  return postData;
}