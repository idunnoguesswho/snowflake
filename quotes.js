const QUOTES_SHEET_ID = "11A5NsScePEbtN9dujN3tILb_Q2TU5tsf6I0MbT11kDY";
const QUOTES_GID = 575264347;

function doGet() {
  const spreadsheet = SpreadsheetApp.openById(QUOTES_SHEET_ID);
  const sheet = spreadsheet.getSheets().find(s => s.getSheetId() === QUOTES_GID)
    || spreadsheet.getSheetByName("Quotes")
    || spreadsheet.getSheets()[0];

  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(h => String(h).toLowerCase().trim());
  const dateIdx = headers.indexOf("date");
  const sourceIdx = headers.indexOf("source");
  const descIdx = headers.indexOf("description");

  const tz = Session.getScriptTimeZone();
  const today = Utilities.formatDate(new Date(), tz, "yyyy-MM-dd");

  const quotes = values.slice(1)
    .filter(row => {
      const d = row[dateIdx];
      if (!d) return false;
      const formatted = Object.prototype.toString.call(d) === "[object Date]"
        ? Utilities.formatDate(d, tz, "yyyy-MM-dd")
        : String(d).trim().substring(0, 10);
      return formatted === today;
    })
    .map(row => ({
      date: formatDate(row[dateIdx], tz),
      source: String(row[sourceIdx] || "").trim(),
      description: String(row[descIdx] || "").trim()
    }));

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, quotes, date: today }))
    .setMimeType(ContentService.MimeType.JSON);
}

function formatDate(value, tz) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, tz || Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value).trim();
}
