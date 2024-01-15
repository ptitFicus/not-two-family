const http = require('http');
const url = require('url')
const fs = require("fs");
const jwt = require('jsonwebtoken');
const Fastify = require('fastify');
const fastify = Fastify({
  logger: true
})

const port = process.env.PORT || 3000;

const deeplKey = process.env.DEEPL_APIKEY || 'secret'

const dictionnary = loadDictionnary();

async function fetchIPA(name) {
  console.log({ name })
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

const translationHandler = (request, response) => {
  const { text } = request.body
  fetchIPA(text)
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
        response
          .code(404)
          .header('Content-Type', 'application/json')
          .send({ error: 'nothing found, sorry' });
      } else {
        console.log(results)
        response

          .send(results);
      }
    })
};


// ▂▃▅▇█▓▒░ Otoroshi exchange protocol ░▒▓█▇▅▃▂
// const VERY_SECRET_PASSWORD = 'secret';

// function signToken(decodedState, _, res, next) {
//   const now = Math.floor(Date.now() / 1000)

//   const token = {
//     'state-resp': decodedState.state,
//     iat: now,
//     nbf: now,
//     exp: now + 10,
//     aud: 'Otoroshi'
//   };

//   res.header("Otoroshi-State-Resp", jwt.sign(token, VERY_SECRET_PASSWORD, { algorithm: 'HS512' }))
//   next();
// }

// function OtoroshiChallengeProtocol(req, res, done) {
//   const headers = req.headers;
//   const state = headers["otoroshi-state"];

//   jwt.verify(state, VERY_SECRET_PASSWORD, { issuer: 'Otoroshi' }, (err, decodedState) => {
//     if (err) {
//       res
//         .code(401)
//         .send({ error: "unauthorized" });
//     } else {
//       signToken(decodedState, res, res, done);
//     }
//   });
// }

// ▂▃▅▇█▓▒░   The End    ░▒▓█▇▅▃▂




// fastify.addHook('onRequest', OtoroshiChallengeProtocol);


fastify.post("/translate", translationHandler)

try {
  fastify.listen({ port })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}
