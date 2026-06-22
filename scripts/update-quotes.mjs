import fs from "fs";

const SHEET_ID = "1VVWZBG3fXLWBFCnRDLo76kUQrNyPcBBdY6mCiiwJr50";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`;

const QUOTES_FILE = "quotes.json";

function todayKey() {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });
}

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

function normalizeDate(value) {
  const d = new Date(value);
  if (isNaN(d)) return null;
  return d.toLocaleDateString("en-CA", { timeZone: "America/Edmonton" });
}

const res = await fetch(CSV_URL);
if (!res.ok) throw new Error(`Could not fetch sheet: ${res.status}`);

const csv = await res.text();
const rows = parseCSV(csv).slice(1);

let quotes = [];
if (fs.existsSync(QUOTES_FILE)) {
  quotes = JSON.parse(fs.readFileSync(QUOTES_FILE, "utf8"));
}

const today = todayKey();
const alreadyHasToday = quotes.some(q => q.date === today);

if (!alreadyHasToday) {
  const todaysRows = rows.filter(r => normalizeDate(r[0]) === today);

  for (const r of todaysRows) {
    quotes.push({
      date: today,
      source: r[1] || "",
      text: r[2] || ""
    });
  }

  fs.writeFileSync(QUOTES_FILE, JSON.stringify(quotes, null, 2));
  console.log(`Added ${todaysRows.length} quotes for ${today}`);
} else {
  console.log(`quotes.json already has ${today}`);
}
