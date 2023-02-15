const cron = require("node-cron");
const animehay = require("./animehay");

// Every Hour
async function main(){
  console.log(new Date().toLocaleString("vi"));
  await animehay();
  console.log("--------------------");
}

main();
cron.schedule("0 * * * *", main);
