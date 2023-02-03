const fs = require("fs");
const papa = require("papaparse");
const { PathWatchData } = require("./animehay/core/const");

const watchData = papa.parse(
  fs.readFileSync(PathWatchData, { flag: "r", encoding: "utf8" }),
  {
    header: true,
    skipEmptyLines: true,
  }
).data;

const watchDataArr = [];
for (let index = 0; index < watchData.length; index += 1) {
  const watchItem = watchData[index];
  const { movieEp, movieId, movieLink, movieHdx } = watchItem;
  const movieEpId = movieLink?.split("-").pop().split(".")[0] || "";

  const data = {
    movieEp,
    movieId,
    movieEpId,
    movieLink,
    movieHdx,
  };
  watchDataArr.push(data);
}

const csvDataString = papa.unparse(watchDataArr, { header: true });
fs.writeFileSync(PathWatchData + ".new", csvDataString, { flag: "w" });
