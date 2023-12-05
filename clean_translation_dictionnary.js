const { XMLParser } = require("fast-xml-parser");
const fs = require("fs");

const xml = fs.readFileSync("./fra-eng.tei", "utf8");

const parser = new XMLParser();
let json = parser.parse(xml);

const entries = json.TEI.text.body.entry;

const result = entries
  .map(({ form: { orth }, gramGrp, sense }) => {
    let senses = [];
    if (Array.isArray(sense)) {
      senses = sense
        .filter((el) => el.cit)
        .flatMap(({ cit }) => {
          if (Array.isArray(cit)) {
            return cit.map(({ quote }) => quote);
          } else {
            return [cit.quote];
          }
        });
    } else if (Array.isArray(sense.cit)) {
      senses = sense.cit.map(({ quote }) => quote);
    } else {
      senses = sense?.cit?.quote ? [sense?.cit?.quote] : [];
    }

    return { french: orth, type: gramGrp?.pos, english: senses };
  })
  .filter(({ type, french }) => type && french.length > 0);

fs.writeFileSync("./translations.json", JSON.stringify(result));
