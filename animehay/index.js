const fs = require("fs");
const papa = require("papaparse");
const puppeteer = require("puppeteer");
const getPost = require("./animehay_post");
const getTracking = require("./animehay_tracking");
const getWatch = require("./animehay_watch");
const { getGroup } = require("./animehay_tool");
const { PathResultData } = require("./core/const");

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
  const resultData = await getGroup();
  const csvDataString = papa.unparse(resultData, { header: true });
  fs.writeFileSync(PathResultData, csvDataString, { flag: "w" });

  console.log("Hoàn tất!");
}

main();
