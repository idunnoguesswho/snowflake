const SHEET_ID = "11A5NsScePEbtN9dujN3tILb_Q2TU5tsf6I0MbT11kDY";
const SHEET_NAME = "Tasks";

function doGet() {
  return jsonResponse(getTaskPayload());
}

function doPost(event) {
  const payload = JSON.parse((event && event.postData && event.postData.contents) || "{}");
  const rowNumber = Number(payload.rowNumber);
  const assignNextRowNumber = Number(payload.assignNextRowNumber || 0);
  const completedDate = payload.completedDate || new Date();
  const assignedDate = payload.assignedDate || completedDate;

  if (!rowNumber || rowNumber < 2) {
    return jsonResponse({ ok: false, error: "Missing rowNumber." });
  }

  const sheet = getSheet();
  const map = getColumnMap(sheet);

  setDateCell(sheet, rowNumber, map.completedDate, completedDate);
  if (map.isDone) sheet.getRange(rowNumber, map.isDone).setValue(true);

  if (assignNextRowNumber && assignNextRowNumber >= 2 && map.dateAssigned) {
    setDateCell(sheet, assignNextRowNumber, map.dateAssigned, assignedDate);
  }

  return jsonResponse({
    ok: true,
    completedTask: getTaskFromRow(sheet, rowNumber, map),
    assignedTask: assignNextRowNumber ? getTaskFromRow(sheet, assignNextRowNumber, map) : null,
    ...getTaskPayload()
  });
}

function getTaskPayload() {
  const sheet = getSheet();
  const map = getColumnMap(sheet);
  const values = sheet.getDataRange().getValues();
  const tasks = values.slice(1).map((row, index) => toTask(row, index + 2, map));
  const points = {};

  tasks.filter((task) => task.completedDate).forEach((task) => {
    points[task.responsible] = (points[task.responsible] || 0) + Number(task.points || 0);
  });

  return { ok: true, tasks, points, updatedAt: new Date().toISOString() };
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.openById(SHEET_ID);
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.getSheets()[0];
}

function getColumnMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map((value) => String(value || "").toLowerCase().trim());
  const find = (names) => {
    for (const name of names) {
      const index = headers.indexOf(name);
      if (index >= 0) return index + 1;
    }
    return 0;
  };

  return {
    id: find(["id"]),
    dateAdded: find(["date added"]),
    responsible: find(["responsible"]),
    category: find(["category", "topic"]),
    estTime: find(["est time"]),
    title: find(["task name en", "task name"]),
    description: find(["description en", "description"]),
    youtubeLink: find(["youtube link"]),
    worksheet: find(["worksheet"]),
    dateAssigned: find(["date assigned"]),
    completedDate: find(["date completed"]),
    isDone: find(["isdone", "is done", "done"]),
    points: find(["points"])
  };
}

function setDateCell(sheet, rowNumber, columnNumber, value) {
  if (!columnNumber) return;
  const cell = sheet.getRange(rowNumber, columnNumber);
  cell.setValue(value);
  cell.setNumberFormat("yyyy-mm-dd");
}

function getTaskFromRow(sheet, rowNumber, map) {
  return toTask(sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0], rowNumber, map || getColumnMap(sheet));
}

function toTask(row, rowNumber, map) {
  const get = (columnNumber) => columnNumber ? row[columnNumber - 1] : "";
  return {
    rowNumber,
    id: String(get(map.id) || "").trim(),
    dateAdded: formatDate(get(map.dateAdded)),
    responsible: String(get(map.responsible) || "Unassigned").trim(),
    topic: String(get(map.category) || "General").trim(),
    estTime: String(get(map.estTime) || "").trim(),
    title: String(get(map.title) || "Untitled task").trim(),
    description: String(get(map.description) || "").trim(),
    youtubeLink: String(get(map.youtubeLink) || "").trim(),
    worksheet: String(get(map.worksheet) || "").trim(),
    dateAssigned: formatDate(get(map.dateAssigned)),
    completedDate: formatDate(get(map.completedDate)),
    isDone: parseBoolean(get(map.isDone)),
    points: Number(get(map.points) || 0)
  };
}

function formatDate(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]") {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(value);
}

function parseBoolean(value) {
  if (value === true) return true;
  const text = String(value || "").toLowerCase().trim();
  return ["yes", "true", "1", "done", "complete", "completed", "finished", "closed"].indexOf(text) >= 0;
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
