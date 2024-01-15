const fs = require("fs");

const name = process.argv?.[2];

const deeplKey = process.env.DEEPL_APIKEY || 'secret'

if (!name) {
  console.error("Usage : node index.js <name-to-process>");
  return;
}
const dictionnary = loadDictionnary();
const translations = loadTranslations();

console.log(`Processing ${name}`);

async function fetchIPA(name) {
  return fetch("https://api2.unalengua.com/ipav3", {
    method: "POST",
    body: JSON.stringify({
      text: name,
      lang: "fr-FR",
      mode: true,
    }),
  })
    .then((resp) => resp.json())
    .then((resp) => resp.ipa);
}

fetchIPA(name)
  .then((ipa) => {
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
      return []
    } else {
      return results
        .filter(array => !array.flat().some(str => str.includes("'")))
        .map(array => {
          return array.map(strArray => {
            return strArray
              .filter(str => !str.endsWith("s"))
              .filter(str => !str.endsWith("ent"))
          })
        })
        .flatMap((rs) => combine(rs))
    }
  })
  .then(results => {
    if (results.length === 0) {
      return []
    } else {
      return Promise.all(results.map(frenchToEnglish))
    }
  })
  .then(results => {
    if (results.length === 0) {
      console.log("Nothing found, sorry");
    } else {
      console.log(results)
    }
  });




  //   if (results.length === 0) {
  //     console.log("Nothing found, sorry");
  //   } else {
  //     const sentences = results.flatMap((rs) => combine(rs));
  //     console.log("Possible french results :", sentences);

  //     const englishResult = sentences.reduce((results, sentence) => {
  //       const words = sentence.split(" ");
  //       const localResult = [];
  //       for (const word of words) {
  //         const translation = translations.get(word.toLocaleUpperCase("fr-FR"));
  //         if (translation) {
  //           localResult.push(translation.english);
  //         } else {
  //           return results;
  //         }
  //       }
  //       const combined = combine(localResult, " ");

  //       console.log(
  //         `Possible translations for "${sentence}" are \n  * ${combined.join(
  //           "\n  * "
  //         )}`
  //       );
  //       results.push(combined);
  //       return results;
  //     }, []);

  //     console.log("Results are ", englishResult.flat());
  //   }
  // });

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
    .then((resp) => resp.ipa)   
  }

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

  function loadTranslations() {
    console.log("Loading translations...");
    const data = fs.readFileSync("./translations.json", "utf8");
    const json = JSON.parse(data);
    console.log(`Loaded ${json.length} translation entries`);

    return json.reduce((acc, { french, english, type }) => {
      acc.set(french.toLocaleUpperCase("fr-FR"), { english, type });
      return acc;
    }, new Map());
  }

  function frenchToEnglish(text) {
    return fetch("https://api-free.deepl.com/v2/translate", {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${deeplKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: [text],
        'target_lang': "EN",
        'source_lang': "FR"
      }),
    })
      .then(r => r.json())
      .then(({ translations }) => {
        const [{ text }] = translations
        return text
      })
  }
