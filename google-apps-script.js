const SHEET_ID = "1Zd0Fl3ciRRB_gRqQIwbFFKXxISNQtyoG7ExskQLVm8k";
const SHEET_NAME = "Snowflake – Family To Do";
const POINTS_PER_TASK = 1;

function doGet() {
  return jsonResponse(getTaskPayload());
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

  return jsonResponse({ ok: true, completedTask: getTaskFromRow(sheet, rowNumber), ...getTaskPayload() });
}

function getTaskPayload() {
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const tasks = values.slice(1).map((row, index) => toTask(row, index + 2));
  const completedTasks = tasks.filter((task) => task.completedDate);
  const points = {};

  completedTasks.forEach((task) => {
    points[task.responsible] = (points[task.responsible] || 0) + POINTS_PER_TASK;
  });

  return { ok: true, tasks, points, pointValue: POINTS_PER_TASK, updatedAt: new Date().toISOString() };
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0];
}

function getTaskFromRow(sheet, rowNumber) {
  return toTask(sheet.getRange(rowNumber, 1, 1, 6).getValues()[0], rowNumber);
}

function toTask(row, rowNumber) {
  return {
    rowNumber,
    dateAdded: formatDate(row[0]),
    responsible: String(row[1] || "Unassigned").trim(),
    topic: String(row[2] || "General").trim(),
    title: String(row[3] || "Untitled task").trim(),
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
