const fs = require("fs");
const papa = require("papaparse");
const { PathResultData, PathWatchTempData } = require("../animehay/core/const");

const prevData = papa.parse(
  fs.readFileSync(PathResultData, { flag: "r", encoding: "utf8" }),
  { header: true, skipEmptyLines: true }
).data;

prevData.forEach((item) => {
    if(!item.movieId || !item.movieEpId) {
        fs.writeFileSync(
          PathWatchTempData,
          `${item.movieEp},${item.movieEpId}\n`,
          { flag: "a" }
        );
    }
});
const resultData = prevData.filter((item) => !item.movieId || !item.movieEpId);

const csvDataString = papa.unparse(resultData, { header: true });
fs.writeFileSync(PathResultData, csvDataString, { flag: "w" });