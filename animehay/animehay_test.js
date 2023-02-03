const fs = require("fs");
const papa = require("papaparse");
const {
  PathPostData,
  PathTrackingData,
  PathWatchData,
  PathPostTempData,
  PathWatchTempData,
} = require("./core/const");

main();

async function main() {
  fs.writeFileSync(PathPostTempData, "", { flag: "w" });

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
      ids.push(trackItemId);
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
    console.log("Prepare Update: ", trackItemId);
    idsPost.push(trackItemId);
  }

  fs.writeFileSync(PathPostTempData, idsPost.join("\n"), { flag: "a" });

  fs.writeFileSync(PathWatchTempData, "", { flag: "w" });

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
      const [ep, epId] = item.split("|");
      if (watchEpisodes.indexOf(`${ep}|${epId}`) === -1) {
        idsWatch.push(`${ep}|${epId}`);
      }
    });
  }

  const idsData = idsWatch?.map((item) => item.split("||")).flat() || [];
  fs.writeFileSync(PathWatchTempData, idsData.join("\n"), { flag: "a" });
}
