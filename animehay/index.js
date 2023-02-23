const fs = require("fs");
const papa = require("papaparse");
const { v4: uuidv4 } = require("uuid");
const puppeteer = require("puppeteer");
const {
  PathResultData,
  PathTrackingData,
  PathWatchTempData,
  PathPostData,
  PathWatchData,
  PathPostTempData,
  PathNewData,
  PathPrevData,
} = require("./core/const");

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

fs.readdir("./animehay/bk", function (err, files) {
  files = files
    .map((f) => ({
      name: f,
      time: fs.statSync("./animehay/bk" + "/" + f).mtime.getTime(),
    }))
    .sort((a, b) => a.time - b.time)
    .map((v) => v.name);
  files.slice(0, files.length - 5).forEach((file) => {
    fs.rmSync(`./animehay/bk/${file}`, { recursive: true });
  });
});

async function main() {
  console.log("Đang mở trình duyệt...");
  const browser = await puppeteer.launch({ headless: true });

  console.log("Lấy dữ liệu...");
  const idsTracking = await getTracking(browser);
  console.log("Dữ liệu mới: ", idsTracking.join(", ") || "No Data");

  console.log("Đang cập nhật dữ liệu...");
  const idsPost = await getPost(browser, idsTracking);
  console.log("Dữ liệu tập phim mới: ", idsPost.join(", ") || "No Data");

  console.log("Đang cập nhật dữ liệu xem phim...");
  await getWatch(browser, idsPost);

  await browser.close();
  console.log("Đã đóng trình duyệt.");

  console.log("Đang xuất dữ liệu ra file CSV...");
  const resultData = await getExportCsv();

  const csvDataString = papa.unparse(resultData, { header: true });
  fs.writeFileSync(PathResultData, csvDataString, { flag: "w" });

  console.log("Đang lưu dữ liệu mới ra file CSV...");
  const changedData = await getChangedCsv(resultData);

  const csvChangedString = papa.unparse(changedData, { header: true });
  fs.writeFileSync(PathNewData, csvChangedString, { flag: "w" });

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
        const movieId = movieItem.getAttribute("id").split("-")?.[2];
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
          movieEpisodeTotal = 1;
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

  idsUpdate = [...new Set([...idsTemp, ...idsUpdate])];
  for (let i = 0; i < idsUpdate.length; i += 1) {
    const link = idsUpdate[i];
    const path = `https://animehay.pro/thong-tin-phim/-${link}.html`;
    await page.goto(path);

    const is404 = await page.$(".ah_404");
    if (is404) {
      continue;
    }

    const pageData = await page.evaluate(() => {
      const movieLink =
        document.querySelector("link[rel=canonical]")?.href || "";
      const movieId = movieLink?.split("-").pop().split(".")[0] || "";
      const movieName =
        document.querySelector(".heading_movie")?.innerText || "";
      const movieOriginalName =
        document.querySelector(".name_other div:nth-child(2)")?.innerText || "";
      const movieImage =
        document.querySelector(".heading_movie ~ div img")?.src || "";

      const movieCategoriesSelector =
        document.querySelectorAll(".list_cate div a");
      const movieCategories = Array.from(movieCategoriesSelector)
        .map((item) => item.innerText)
        .join("|");

      const movieStatus = document
        .querySelector(".status div:nth-child(2)")
        ?.innerText.toLowerCase()
        .replace(/^.|\s\S/g, (a) => a.toUpperCase());
      const moviePublish =
        document.querySelector(".update_time div:nth-child(2)")?.innerText ||
        "";
      const movieDuration =
        document
          .querySelector(".duration div:nth-child(2)")
          ?.innerText.toLowerCase() || "";
      const movieDescription =
        document.querySelector(".desc div:nth-child(2)")?.innerText || "";

      let movieEpisodeTotal = 1;
      if (movieDuration.includes("tập")) {
        movieEpisodeTotal = movieDuration.split("tập")?.[0].trim() || 1;
      }

      const movieEpisodeCurrent =
        document.querySelector(".list-item-episode a")?.innerText || 1;

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
    pageData.movieUniqueId = prevDataItem?.movieUniqueId || uuidv4();

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

      const movieId =
        document
          .querySelector('a[title="Thông tin phim"]')
          ?.href?.split("-")
          .pop()
          .split(".")[0] || "";
      const movieLinkSelector = document.querySelector("link[rel=canonical]");
      const movieLink = movieLinkSelector?.href || "";
      const movieEpId = movieLink?.split("-").pop().split(".")[0] || "";

      const movieHdxSelector = document.querySelector("#video-player iframe");
      const movieHdx = movieHdxSelector?.src || "";

      return { movieId, movieEpId, movieLink, movieHdx };
    });

    prevData.push({ movieEp: ep, ...pageData });
  }

  const csvDataString = papa.unparse(prevData, { header: true });
  fs.writeFileSync(PathWatchData, csvDataString, { flag: "w" });

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

async function getChangedCsv(result) {
  const prevData = papa
    .parse(fs.readFileSync(PathPrevData, { flag: "r", encoding: "utf8" }), {
      header: true,
      skipEmptyLines: true,
    })
    .data.reduce(
      (obj, item) => Object.assign(obj, { [item.movieId]: { ...item } }),
      {}
    );

  const currentData = papa.parse(
    fs.readFileSync(PathTrackingData, { flag: "r", encoding: "utf8" }),
    { header: true, skipEmptyLines: true }
  ).data;

  const changedData = [];
  currentData.forEach((item) => {
    const csvItem = prevData?.[item.movieId];
    if (
      !csvItem ||
      csvItem?.movieEpisodeCurrent !== item?.movieEpisodeCurrent
    ) {
      changedData.push(item.movieId);
    }
  });

  const resultData = result.reduce((cur, item) => {
    if (!cur[item.movieId]) cur[item.movieId] = [];
    cur[item.movieId].push({ ...item, movieModified: new Date() });
    return cur;
  }, {});

  let updateData = [];
  for (let i = 0; i < changedData.length; i += 1) {
    updateData.push(...resultData[changedData[i]]);
  }

  return updateData;
}

module.exports = main;
