const fs = require("fs");
const papa = require("papaparse");
const {
  PathPostData,
  PathTrackingData,
  PathWatchData,
  PathPostTempData,
  PathWatchTempData,
} = require("./core/const");

async function main() {
  await testConflict();
}

main();

async function testConflict() {
  fs.writeFileSync(PathPostTempData, "", { flag: "w" });
  fs.writeFileSync(PathWatchTempData, "", { flag: "w" });

  /* Conflict Data Track - Post */
  const trackData = papa.parse(
    fs.readFileSync(PathTrackingData, { flag: "r", encoding: "utf8" }),
    { header: true, skipEmptyLines: true }
  ).data;

  const postData = papa
    .parse(fs.readFileSync(PathPostData, { flag: "r", encoding: "utf8" }), {
      header: true,
      skipEmptyLines: true,
    })
    .data.reduce(
      (obj, item) => Object.assign(obj, { [item.movieId]: { ...item } }),
      {}
    );

  const idsPost = [];
  for (let index = 0; index < trackData.length; index += 1) {
    const trackItem = trackData[index];
    const trackItemId = trackItem.movieId;
    const postItem = postData[trackItemId];

    if (!postItem) {
      idsPost.push(trackItemId);
      continue;
    }

    const {
      movieEpisodeTotal: epTotal = "",
      movieEpisodeCurrent: epCurrent = "",
    } = trackItem || {};
    const {
      movieEpisodeTotal: pEpTotal = "",
      movieEpisodeCurrent: pEpCurrent = "",
      movieDuration: pEpDuration = "",
    } = postItem || {};

    if (
      epTotal.toLowerCase() === pEpTotal.toLowerCase() &&
      epCurrent.toLowerCase() === pEpCurrent.toLowerCase()
    ) {
      continue;
    }

    let isPassEpTotal = false;
    if (epTotal === pEpTotal) isPassEpTotal = true;
    if (!epTotal && Number(pEpTotal) === 1) isPassEpTotal = true;

    let isPassEpCurrent = false;
    if (epCurrent === pEpDuration) isPassEpCurrent = true;
    if (epCurrent.indexOf("phút") > -1 && pEpCurrent.indexOf("Full") > -1)
      isPassEpCurrent = true;
    if (epCurrent === "??" && Number(pEpCurrent) === 1) isPassEpCurrent = true;

    if (isPassEpTotal && isPassEpCurrent) {
      continue;
    }
    idsPost.push(trackItemId);
  }

  fs.writeFileSync(PathPostTempData, idsPost.join("\n"), { flag: "a" });

  /* Conflict Data Post - Watch */
  const watchData = papa
    .parse(fs.readFileSync(PathWatchData, { flag: "r", encoding: "utf8" }), {
      header: true,
      skipEmptyLines: true,
    })
    .data.reduce((acc, item) => {
      if (!acc[item.movieId]) acc[item.movieId] = [];
      acc[item.movieId].push(item);
      return acc;
    }, {});

  const idsWatch = [];
  for (let index = 0; index < trackData.length; index += 1) {
    const trackItem = trackData[index];
    const trackItemId = trackItem.movieId;
    const postItem = postData[trackItemId];
    const watchItem = watchData[trackItemId];

    const postEpisodes = postItem?.movieEpisodes || "";
    const watchEpisodes =
      watchItem
        ?.sort((a, b) => a.movieEp > b.movieEp)
        ?.map((item) => `${item.movieEp}|${item.movieEpId}`) || [];
    const watchEpisodesStr = watchEpisodes.join("||");

    if (postEpisodes === watchEpisodesStr) continue;

    postEpisodes.split("||").forEach((item) => {
      if (watchEpisodes.indexOf(item) === -1) idsWatch.push(item);
    });
  }

  fs.writeFileSync(PathWatchTempData, idsWatch.join("\n"), { flag: "a" });
}
