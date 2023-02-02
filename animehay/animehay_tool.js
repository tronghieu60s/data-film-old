const fs = require("fs");
const papa = require("papaparse");
const { PathTrackingData, PathWatchData } = require("./core/const");

async function getGroup() {
  const trackData = papa.parse(
    fs.readFileSync(PathTrackingData, { flag: "r", encoding: "utf8" }),
    { header: true, skipEmptyLines: true }
  ).data;

  const watchData = papa
    .parse(fs.readFileSync(PathWatchData, { flag: "r", encoding: "utf8" }), {
      header: true,
      skipEmptyLines: true,
    })
    .data.reduce((cur, item) => {
      if (!cur[item.movieId]) cur[item.movieId] = [];
      cur[item.movieId].push(item);
      return cur;
    }, {});

  for (let index = 0; index < trackData.length; index += 1) {
    trackData[index].movieEpisodes = `"${JSON.stringify(
      watchData[trackData[index].movieId] || []
    )}"`;
  }

  return trackData;
}

module.exports = { getGroup };
