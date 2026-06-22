import fs from "fs";

const SHEET_ID = "11A5NsScePEbtN9dujN3tILb_Q2TU5tsf6I0MbT11kDY";
const SHEET_GID = "1013977204";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}`;

const HUSTLES_FILE = "hustles.json";

function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", quote = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i], n = text[i + 1];

    if (c === '"' && n === '"') {
      cell += '"';
      i++;
    } else if (c === '"') {
      quote = !quote;
    } else if (c === "," && !quote) {
      row.push(cell.trim());
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quote) {
      if (cell || row.length) rows.push([...row, cell.trim()]);
      row = [];
      cell = "";
      if (c === "\r" && n === "\n") i++;
    } else {
      cell += c;
    }
  }

  if (cell || row.length) rows.push([...row, cell.trim()]);
  return rows;
}

const res = await fetch(CSV_URL);
if (!res.ok) throw new Error(`Could not fetch sheet: ${res.status}`);

const csv = await res.text();
const [headerRow, ...dataRows] = parseCSV(csv);

if (!headerRow) {
  console.log("Sheet appears empty");
  process.exit(0);
}

const headers = headerRow.map(h => h.trim());
console.log(`Headers: ${headers.join(", ")}`);
console.log(`Data rows: ${dataRows.length}`);

const hustles = dataRows
  .filter(r => r.some(cell => cell.trim()))
  .map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] || "").trim(); });
    return obj;
  });

fs.writeFileSync(HUSTLES_FILE, JSON.stringify(hustles, null, 2));
console.log(`Written ${hustles.length} hustles to ${HUSTLES_FILE}`);
