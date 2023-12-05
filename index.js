const fs = require("fs");

const name = process.argv?.[2];

if (!name) {
  console.error("Usage : node index.js <name-to-process>");
  return;
}
const dictionnary = loadDictionnary();

console.log(`Processing ${name}`);

async function fetchIPA(name) {
  return fetch("https://api2.unalengua.com/ipav3", {
    method: "POST",
    body: JSON.stringify({
      text: name,
      lang: "fr-CA",
      mode: true,
    }),
  })
    .then((resp) => resp.json())
    .then((resp) => resp.ipa);
}
fetchIPA(name).then((ipa) => {
  console.log(`IPA : ${ipa}`);

  const decompositions = subArrayDecomposition(graphemeSplit(cleanIPA(ipa)));

  const results = [];

  for (const decomposition of decompositions) {
    const res = findOptions(dictionnary, decomposition);
    if (res) {
      results.push(res);
    }
  }

  if (results.length === 0) {
    console.log("Nothing found, sorry");
  } else {
    console.log(
      "Possible results :",
      results.flatMap((rs) => combine(rs))
    );
  }
});

function findOptions(dictionnary, ipas) {
  const result = [];
  for (const ipa of ipas) {
    if (dictionnary.has(ipa)) {
      const option = dictionnary.get(ipa);
      result.push(option);
    } else {
      return undefined;
    }
  }

  return result;
}

function cleanIPA(ipa) {
  return ipa.replaceAll("'", "").replaceAll("ˈ", "");
}

// https://stackoverflow.com/questions/30169587/find-all-the-combination-of-substrings-that-add-up-to-the-given-string
function subArrayDecomposition(ipa) {
  if (ipa.length == 1) {
    return [ipa];
  }
  const finalResult = [];
  const [first, ...truncated] = ipa;
  subArrayDecomposition(truncated).forEach((results) => {
    const l2 = [...results];
    l2[0] = ipa[0] + l2[0];

    finalResult.push(l2);

    const l = [ipa[0], ...results];
    finalResult.push(l);
  });

  return finalResult;
}

function graphemeSplit(input) {
  const segmenterFrGrapheme = new Intl.Segmenter("fr", {
    granularity: "grapheme",
  });

  const graphemeSegments = segmenterFrGrapheme.segment(input);
  return Array.from(graphemeSegments).map(({ segment }) => segment);
}

function loadDictionnary() {
  console.log("Loading dictionnary...");
  const data = fs.readFileSync("./dict.json", "utf8");
  const json = JSON.parse(data);
  console.log(`Loaded ${json.length} dictionnary entries`);

  return json.reduce((acc, { word, ipa }) => {
    if (!acc.has(ipa)) {
      acc.set(ipa, []);
    }
    acc.get(ipa).push(word);
    return acc;
  }, new Map());
}

function combine([head, ...[headTail, ...tailTail]], separator = " ") {
  if (!headTail) return head;

  const combined = headTail.reduce((acc, x) => {
    return acc.concat(head.map((h) => `${h}${separator}${x}`));
  }, []);

  return combine([combined, ...tailTail]);
}
