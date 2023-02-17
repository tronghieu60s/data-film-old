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
  const browser = await puppeteer.launch({ headless: true });

  console.log("Lấy dữ liệu...");
  const idsTracking = await getTracking(browser);
  console.log("Dữ liệu mới: ", idsTracking.join(", ") || "No Data");

  console.log("Hoàn tất!");
}

async function getTracking(browser) {
  await getTrackingOdd(browser);
  await getTrackingSeries(browser);
}

async function getTrackingOdd(browser) {
  const ids = [];
  const page = await browser.newPage();

  let index = 0;
  do {
    index += 1;
    const path = `https://phimmoichilla.net/list/phim-le/page-${index}/`;
    await page.goto(path);

    const pageData = await page.evaluate(() => {
      const movieItem = document.querySelectorAll(".list-film .item");

      const movieItemArr = Array.from(movieItem);
      return movieItemArr.map((movieItem) => {
        const movieLink = movieItem.querySelector("a").href;
        const movieId = movieLink.split("-").pop().replace("pm", "");
        const movieName = movieItem.querySelector("h3").innerText.trim();
        const movieEpisode = movieItem.querySelector("span.label").innerText;

        return {
          movieId,
          movieLink,
          movieName,
          movieEpisodeTotal: "",
          movieEpisodeCurrent: movieEpisode,
        };
      });
    });

    const isEndUpdate = pageData.length === 0;
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

  const csvDataArr = Object.values(prevData);
  const csvDataString = papa.unparse(csvDataArr, { header: true });
  fs.writeFileSync(PathTrackingData, csvDataString, { flag: "w" });

}

async function getTrackingSeries(browser) {}

module.exports = main;
