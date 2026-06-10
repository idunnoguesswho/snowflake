const SHEET_ID = "11A5NsScePEbtN9dujN3tILb_Q2TU5tsf6I0MbT11kDY";
const SHEET_NAME = "Quotes";
const POINTS_PER_Money = 1;

function doGet() {
  return jsonResponse(getMoneyPayload());
}

function doPost(event) {
  const payload = JSON.parse((event && event.postData && event.postData.contents) || "{}");
  const rowNumber = Number(payload.rowNumber);
  const completedDate = payload.completedDate || new Date();

  if (!rowNumber || rowNumber < 2) {
    return jsonResponse({ ok: false, error: "Missing rowNumber." });
  }

  const sheet = getSheet();
  const dateCell = sheet.getRange(rowNumber, 6);
  dateCell.setValue(completedDate);
  dateCell.setNumberFormat("yyyy-mm-dd");

  return jsonResponse({ ok: true, completedMoney: getMoneyFromRow(sheet, rowNumber), ...getMoneyPayload() });
}

function getMoneyPayload() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const Moneys = values.slice(1).map((row, index) => toMoney(row, index + 2));
  const completedMoneys = Moneys.filter((Money) => Money.completedDate);
  const points = {};

  completedMoneys.forEach((Money) => {
    points[Money.responsible] = (points[Money.responsible] || 0) + POINTS_PER_Money;
  });

  return { ok: true, Moneys, points, pointValue: POINTS_PER_Money, updatedAt: new Date().toISOString() };
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0];
}

function getMoneyFromRow(sheet, rowNumber) {
  return toMoney(sheet.getRange(rowNumber, 1, 1, 6).getValues()[0], rowNumber);
}

function toMoney(row, rowNumber) {
  return {
    rowNumber,
    dateAdded: formatDate(row[0]),
    responsible: String(row[1] || "Unassigned").trim(),
    topic: String(row[2] || "General").trim(),
    title: String(row[3] || "Untitled Money").trim(),
    description: String(row[4] || "").trim(),
    completedDate: formatDate(row[5])
  };
}

function formatDate(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value);
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
