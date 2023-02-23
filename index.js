const cron = require("node-cron");
const animehay = require("./animehay");
const phimmoichill = require("./phimmoichill");

// Every Hour
const main = async () => {
  console.log(new Date().toLocaleString("vi"));
  await animehay();
  // await phimmoichill();
  console.log("--------------------");
};

main();
// cron.schedule("0 * * * *", main);
