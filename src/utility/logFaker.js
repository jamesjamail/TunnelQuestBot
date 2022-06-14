const faker = require("faker");
const fs = require("fs");
const prices = [100, 300, 500, 1000, 5000];
const items = [
  "Thick Banded Belt",
  "Cloak of Flames",
  "Sceptre of Destruction",
];
const users = ["Sellergoblin", "Bankerdude", "Cheapwareswoman"];

function rand(max) {
  return Math.floor(Math.random() * Math.floor(max));
}

function writeLine() {
  fs.appendFile(
    "./fakeLogs/fakeLog.txt",
    `\n${users[rand(3)]} auctions, 'WTS ${items[rand(3)]} ${prices[rand(5)]}'`,
    (err) => {
      if (err) {
        console.error("ERROR: ", err);
      }
    }
  );
}

setInterval(writeLine, 1000);
