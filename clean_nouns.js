const fs = require("fs");

const data = fs.readFileSync("./noun.csv", "utf8");

const lines = data.split("\n");
lines.shift();

const result = lines.map((line) => {
  return line.split(",")[0];
});

fs.writeFileSync("./nouns.json", JSON.stringify(result));
