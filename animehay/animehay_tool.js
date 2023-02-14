const fs = require("fs");
const papa = require("papaparse");
const { PathPostData, PathWatchData } = require("./core/const");

async function getGroup() {
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
      postData[index].movieCategories.indexOf("CN Animation") > -1 ? "Trung Quốc" : "Nhật Bản";
    postData[index].movieEpisodes = `${JSON.stringify(
      watchData[postData[index].movieId] || []
    )}`;
  }

  return postData;
}

module.exports = { getGroup };
