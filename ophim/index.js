const fs = require("fs");
const papa = require("papaparse");
const puppeteer = require("puppeteer");
const {
  PathTrackingData,
  PathPostData,
  PathPostTempData,
  PathWatchTempData,
  PathWatchData,
} = require("./core/const");

const curDate = new Date();
const timeDate = curDate.toLocaleTimeString("vi").replace(/:/g, "");
const shortDate = curDate
  .toLocaleString("vi", { dateStyle: "short" })
  .replace(/\//g, "");
fs.mkdirSync(`./ophim/bk`, { recursive: true });

fs.mkdirSync(`./ophim/bk/${shortDate}/${timeDate}`, { recursive: true });

fs.readdirSync(`./ophim/data`).forEach((file) => {
  fs.copyFileSync(
    `./ophim/data/${file}`,
    `./ophim/bk/${shortDate}/${timeDate}/${file}.backup`
  );
});

fs.readdir("./ophim/bk", function (err, files) {
  files = files
    .map((f) => ({
      name: f,
      time: fs.statSync("./ophim/bk" + "/" + f).mtime.getTime(),
    }))
    .sort((a, b) => a.time - b.time)
    .map((v) => v.name);
  files.slice(0, files.length - 5).forEach((file) => {
    fs.rmSync(`./ophim/bk/${file}`, { recursive: true });
  });
});

async function main() {
  console.log("Lấy dữ liệu...");
  const idsTracking = await getTracking();
  console.log("Dữ liệu mới: ", idsTracking.join(", ") || "No Data");

  

  console.log("Hoàn tất!");
}

async function getTracking() {
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

  index = 0;
  do {
    index += 1;
    const movieFetch = await fetch(
      `https://ophim1.com/danh-sach/phim-moi-cap-nhat?page=${index}`
    )
      .then((res) => res.json())
      .then((res) => res.items);
    const movieData = movieFetch.forEach((item) => {
      const {
        _id: movieId,
        name: movieName,
        slug: movieSlug,
        origin_name: movieOriginalName,
        thumb_url: movieImageThumb,
        poster_url: movieImagePoster,
        year: moviePublish,
      } = item;
      const data = {
        movieId,
        movieName,
        movieSlug,
        movieOriginalName,
        movieImageThumb,
        movieImagePoster,
        moviePublish,
      };
      return data;
    });

    const csvDataArr = Object.values(prevData);
    const csvDataString = papa.unparse(csvDataArr, { header: true });
    fs.writeFileSync(PathPostData, csvDataString, { flag: "w" });

    const isEndUpdate =
      isEndUpdate.length === 0 ||
      movieData.every(
        (item) => prevData[item._id]?.movieModified === item.modified?.time
      );
    if (!isEndUpdate) {
      movieData.forEach((item) => {
        const csvItem = prevData?.[item.movieId];
        if (!csvItem || csvItem?.movieModified !== item?.movieModified) {
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
  fs.writeFileSync(PathPostData, csvDataString, { flag: "w" });

  return ids;
}
