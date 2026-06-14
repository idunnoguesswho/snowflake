const SHEET_ID   = "11A5NsScePEbtN9dujN3tILb_Q2TU5tsf6I0MbT11kDY";
const SHEET_NAME = "Tasks";

// ─── doGet: handles both read and write via URL params ───────────────────────
// ?action=complete&rowNumber=5&completedDate=2026-06-14
// ?action=complete&rowNumber=5&completedDate=2026-06-14&assignNextRowNumber=8&assignedDate=2026-06-14
// (no action param) → returns full task payload as before
function doGet(e) {
  const params  = (e && e.parameter) || {};
  const action  = String(params.action || "").trim().toLowerCase();

  // CORS headers — allow any origin to read the response
  const output = (payload) =>
    ContentService
      .createTextOutput(JSON.stringify(payload))
      .setMimeType(ContentService.MimeType.JSON);

  if (action === "complete") {
    const rowNumber          = Number(params.rowNumber || 0);
    const completedDate      = String(params.completedDate || "").trim()
                               || formatDate(new Date());
    const assignNextRowNumber = Number(params.assignNextRowNumber || 0);
    const assignedDate       = String(params.assignedDate || "").trim()
                               || completedDate;

    if (!rowNumber || rowNumber < 2) {
      return output({ ok: false, error: "Missing or invalid rowNumber." });
    }

    try {
      const sheet = getSheet();
      const map   = getColumnMap(sheet);

      setDateCell(sheet, rowNumber, map.completedDate, completedDate);
      if (map.isDone) sheet.getRange(rowNumber, map.isDone).setValue(true);

      if (assignNextRowNumber && assignNextRowNumber >= 2 && map.dateAssigned) {
        setDateCell(sheet, assignNextRowNumber, map.dateAssigned, assignedDate);
      }

      return output({
        ok: true,
        completedTask: getTaskFromRow(sheet, rowNumber, map),
        assignedTask: assignNextRowNumber
          ? getTaskFromRow(sheet, assignNextRowNumber, map)
          : null
      });
    } catch (err) {
      return output({ ok: false, error: err.message });
    }
  }

  // Default: return full task payload (existing behaviour)
  return output(getTaskPayload());
}

// ─── doPost: kept for backward compatibility ─────────────────────────────────
function doPost(event) {
  const payload            = JSON.parse((event && event.postData && event.postData.contents) || "{}");
  const rowNumber          = Number(payload.rowNumber);
  const assignNextRowNumber = Number(payload.assignNextRowNumber || 0);
  const completedDate      = payload.completedDate || formatDate(new Date());
  const assignedDate       = payload.assignedDate  || completedDate;

  if (!rowNumber || rowNumber < 2) {
    return jsonResponse({ ok: false, error: "Missing rowNumber." });
  }

  const sheet = getSheet();
  const map   = getColumnMap(sheet);

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

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getTaskPayload() {
  const sheet  = getSheet();
  const map    = getColumnMap(sheet);
  const values = sheet.getDataRange().getValues();
  const tasks  = values.slice(1).map((row, index) => toTask(row, index + 2, map));
  const points = {};

  tasks.filter(t => t.completedDate).forEach(t => {
    points[t.responsible] = (points[t.responsible] || 0) + Number(t.points || 0);
  });

  return { ok: true, tasks, points, updatedAt: new Date().toISOString() };
}

function getSheet() {
  return SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME)
    || SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
}

function getColumnMap(sheet) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]
    .map(v => String(v || "").toLowerCase().trim());

  const find = (...names) => {
    for (const name of names) {
      const idx = headers.indexOf(name);
      if (idx >= 0) return idx + 1;   // 1-based column number
    }
    return 0;
  };

  return {
    id:           find("id"),
    dateAdded:    find("date added"),
    responsible:  find("responsible"),
    category:     find("category", "topic"),
    estTime:      find("est time"),
    title:        find("task name en", "task name"),
    description:  find("description en", "description"),
    youtubeLink:  find("youtube link"),
    worksheet:    find("worksheet"),
    dateAssigned: find("date assigned"),
    completedDate:find("date completed"),
    isDone:       find("isdone", "is done", "done"),
    points:       find("points")
  };
}

function setDateCell(sheet, rowNumber, columnNumber, value) {
  if (!columnNumber) return;
  const cell = sheet.getRange(rowNumber, columnNumber);
  cell.setValue(value);
  cell.setNumberFormat("yyyy-mm-dd");
}

function getTaskFromRow(sheet, rowNumber, map) {
  return toTask(
    sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getValues()[0],
    rowNumber,
    map || getColumnMap(sheet)
  );
}

function toTask(row, rowNumber, map) {
  const get = col => col ? row[col - 1] : "";
  return {
    rowNumber,
    id:            String(get(map.id) || "").trim(),
    dateAdded:     formatDate(get(map.dateAdded)),
    responsible:   String(get(map.responsible) || "Unassigned").trim(),
    topic:         String(get(map.category) || "General").trim(),
    estTime:       String(get(map.estTime) || "").trim(),
    title:         String(get(map.title) || "Untitled task").trim(),
    description:   String(get(map.description) || "").trim(),
    youtubeLink:   String(get(map.youtubeLink) || "").trim(),
    worksheet:     String(get(map.worksheet) || "").trim(),
    dateAssigned:  formatDate(get(map.dateAssigned)),
    completedDate: formatDate(get(map.completedDate)),
    isDone:        parseBoolean(get(map.isDone)),
    points:        Number(get(map.points) || 0)
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
  return ["yes","true","1","done","complete","completed","finished","closed"]
    .includes(String(value || "").toLowerCase().trim());
}

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}
