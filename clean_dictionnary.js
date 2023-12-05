const fs = require("fs");

const data = fs.readFileSync("./dict.txt", "utf8");

const lines = data.split("\n");

const result = lines
  .map((line) => {
    const [word, ipa] = line.split("/");
    return { word: word.trim(), ipa };
  })
  .filter(({ word }) => isWordElligible(word));

fs.writeFileSync("./dict.json", JSON.stringify(result));

function isWordElligible(word) {
  return !word.includes(" ") && word.length > 1;
}
