const fs = require("fs");
const papa = require("papaparse");
const { v4: uuidv4 } = require("uuid");
const { PathPostData } = require("./core/const");

/*
    movieId,
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
    movieUniqueId,
    movieTags,
    movieCountry
*/

const prevData = papa.parse(
  fs.readFileSync(PathPostData, { flag: "r", encoding: "utf8" }),
  { header: true, skipEmptyLines: true }
).data;

const resultData = prevData.map((item) => ({ ...item, movieUniqueId: uuidv4() }));

const csvDataString = papa.unparse(resultData, { header: true });
fs.writeFileSync(PathPostData, csvDataString, { flag: "w" });