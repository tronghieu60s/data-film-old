const ObjectsToCsv = require("objects-to-csv");

function writeDataToCsv(data, filePath = "./data.csv") {
  let csv = new ObjectsToCsv([]);
  if (Array.isArray(data)) {
    csv = new ObjectsToCsv([...data]);
  } else if (typeof data === "object") {
    csv = new ObjectsToCsv([data]);
  }
  return csv.toDisk(filePath, { append: true });
}

module.exports = { writeDataToCsv };
