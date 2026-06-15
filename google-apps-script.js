// ─── Sheet config ─────────────────────────────────────────────────────────────
const SHEET_ID    = "1GZv91Npf9i0y6AtCQcjYUyiYrDq3aqQ3zSNE2QGAxfE"; // Tasks
const JOBS_SHEET_ID = "18ck-AEpQTH3MIOYoSxNAx2nfYGjTjQsKNm0gWJr_z3Y"; // Jobs + Hustles
const SHEET_NAME  = "Tasks";
const QUOTES_SHEET_ID  = "1VVWZBG3fXLWBFCnRDLo76kUQrNyPcBBdY6mCiiwJr50";
const MENU_SHEET_ID    = "1618K5slLb0A7o1FsDfB1r2zj85fklPLrE2TdJd47CLc";
const MENU_SHEET_NAME  = "Menu";

// ─── Calendar IDs ─────────────────────────────────────────────────────────────
const CALENDARS = {
  oliver: "oliver.h.snow.2015@gmail.com",
  logan:  "logan.l.snow.2017@gmail.com",
  mom:    "katie.snow.ca@gmail.com",
};

// ─── CORS helper ──────────────────────────────────────────────────────────────
function output(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// ─── doGet dispatcher ────────────────────────────────────────────────────────
function doGet(e) {
  const params = (e && e.parameter) || {};
  const tab    = String(params.tab    || "tasks").trim().toLowerCase();
  const action = String(params.action || "").trim().toLowerCase();

  // ── tasks tab (default) ──────────────────────────────────────────────────
  if (tab === "tasks" || tab === "") {
    if (action === "complete") return handleComplete(params);
    return output(getTaskPayload());
  }

  // ── calendar tab ─────────────────────────────────────────────────────────
  if (tab === "calendar") {
    const person = String(params.person || "").trim().toLowerCase();
    const date   = String(params.date   || "").trim()
                   || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    return output(getCalendarEvents(person, date));
  }

  // ── quotes tab ───────────────────────────────────────────────────────────
  if (tab === "quotes") {
    const date = String(params.date || "").trim()
                 || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd");
    return output(getQuotes(date));
  }

  // ── points tab (leaderboard totals from sheet) ───────────────────────────
  if (tab === "points") {
    return output(getPointTotals());
  }

  return output({ ok: false, error: "Unknown tab: " + tab });
}

// ─── doPost ──────────────────────────────────────────────────────────────────
function doPost(event) {
  const payload = JSON.parse((event && event.postData && event.postData.contents) || "{}");

  // Append rows to any sheet
  if (payload.tab === "appendjobs" || payload.tab === "appendrows") {
    try {
      const ss    = SpreadsheetApp.openById(payload.sheetId || JOBS_SHEET_ID);
      const sheet = ss.getSheetByName(payload.sheetName || "Jobs") || ss.getSheets()[0];
      const rows  = payload.rows || [];
      if (!rows.length) return output({ ok: false, error: "No rows provided" });
      rows.forEach(row => sheet.appendRow(row));
      return output({ ok: true, appended: rows.length });
    } catch(err) {
      return output({ ok: false, error: err.message });
    }
  }

  // Backward compat: complete a task
  const rowNumber           = Number(payload.rowNumber);
  const assignNextRowNumber = Number(payload.assignNextRowNumber || 0);
  const completedDate       = payload.completedDate || formatDate(new Date());
  const assignedDate        = payload.assignedDate  || completedDate;
  if (!rowNumber || rowNumber < 2) return output({ ok: false, error: "Missing rowNumber." });
  const sheet = getSheet();
  const map   = getColumnMap(sheet);
  setDateCell(sheet, rowNumber, map.completedDate, completedDate);
  if (map.isDone) sheet.getRange(rowNumber, map.isDone).setValue(true);
  if (assignNextRowNumber && assignNextRowNumber >= 2 && map.dateAssigned)
    setDateCell(sheet, assignNextRowNumber, map.dateAssigned, assignedDate);
  return output({ ok: true, ...getTaskPayload() });
}

// ─── Calendar: fetch today's events for one person ───────────────────────────
function getCalendarEvents(person, date) {
  const calId = CALENDARS[person];
  if (!calId) return { ok: false, error: "Unknown person: " + person, events: [] };

  try {
    const cal = CalendarApp.getCalendarById(calId);
    if (!cal) return { ok: false, error: "Calendar not accessible: " + calId, events: [] };

    // Build start/end of the requested date in the script timezone
    const tz      = Session.getScriptTimeZone();
    const parts   = date.split("-").map(Number);
    const dayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0);
    const dayEnd   = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59);

    const gcalEvents = cal.getEvents(dayStart, dayEnd);

    const events = gcalEvents.map(ev => {
      const start = ev.isAllDayEvent()
        ? date + "T00:00"
        : Utilities.formatDate(ev.getStartTime(), tz, "HH:mm");
      const end   = ev.isAllDayEvent()
        ? date + "T23:59"
        : Utilities.formatDate(ev.getEndTime(), tz, "HH:mm");
      return {
        summary:     ev.getTitle()       || "",
        start:       start,
        end:         end,
        location:    ev.getLocation()    || "",
        description: ev.getDescription() || "",
        allDay:      ev.isAllDayEvent(),
      };
    });

    return { ok: true, person, date, events };
  } catch (err) {
    return { ok: false, error: err.message, events: [] };
  }
}

// ─── Quotes: fetch today's rows from the Quotes sheet ────────────────────────
function getQuotes(date) {
  try {
    const ss    = SpreadsheetApp.openById(QUOTES_SHEET_ID);
    const sheet = ss.getSheets()[0];
    const data  = sheet.getDataRange().getValues();
    if (data.length < 2) return { ok: true, quotes: [] };

    const headers = data[0].map(v => String(v || "").toLowerCase().trim());
    const iDate   = headers.findIndex(h => h.includes("date"));
    const iSrc    = headers.findIndex(h => h.includes("source"));
    const iDesc   = headers.findIndex(h => h.includes("description"));

    const tz = Session.getScriptTimeZone();
    const quotes = data.slice(1)
      .filter(row => {
        const raw = row[iDate];
        const d   = raw instanceof Date
          ? Utilities.formatDate(raw, tz, "yyyy-MM-dd")
          : normalizeDate(String(raw || ""));
        return d === date;
      })
      .map(row => ({
        source:      String(row[iSrc]  || "").trim(),
        description: String(row[iDesc] || "").trim(),
      }))
      .filter(q => q.description);

    return { ok: true, date, quotes };
  } catch (err) {
    return { ok: false, error: err.message, quotes: [] };
  }
}

// ─── Points: all-time totals per person from Tasks sheet ─────────────────────
function getPointTotals() {
  try {
    const sheet  = getSheet();
    const map    = getColumnMap(sheet);
    const values = sheet.getDataRange().getValues();
    const totals = {};
    values.slice(1).forEach(row => {
      const done   = parseBoolean(map.isDone ? row[map.isDone - 1] : "");
      const person = String(map.responsible ? row[map.responsible - 1] : "").trim();
      const pts    = Number(map.points      ? row[map.points - 1]      : 0);
      if (done && person && pts) totals[person] = (totals[person] || 0) + pts;
    });
    return { ok: true, points: totals };
  } catch (err) {
    return { ok: false, error: err.message, points: {} };
  }
}

// ─── Task helpers (unchanged) ─────────────────────────────────────────────────
function handleComplete(params) {
  const rowNumber           = Number(params.rowNumber || 0);
  const completedDate       = String(params.completedDate || "").trim() || formatDate(new Date());
  const assignNextRowNumber = Number(params.assignNextRowNumber || 0);
  const assignedDate        = String(params.assignedDate || "").trim() || completedDate;
  if (!rowNumber || rowNumber < 2) return output({ ok: false, error: "Missing or invalid rowNumber." });
  try {
    const sheet = getSheet();
    const map   = getColumnMap(sheet);
    setDateCell(sheet, rowNumber, map.completedDate, completedDate);
    if (map.isDone) sheet.getRange(rowNumber, map.isDone).setValue(true);
    if (assignNextRowNumber && assignNextRowNumber >= 2 && map.dateAssigned)
      setDateCell(sheet, assignNextRowNumber, map.dateAssigned, assignedDate);
    return output({
      ok: true,
      completedTask: getTaskFromRow(sheet, rowNumber, map),
      assignedTask:  assignNextRowNumber ? getTaskFromRow(sheet, assignNextRowNumber, map) : null
    });
  } catch (err) {
    return output({ ok: false, error: err.message });
  }
}

function getTaskPayload() {
  const sheet  = getSheet();
  const map    = getColumnMap(sheet);
  const values = sheet.getDataRange().getValues();
  const tasks  = values.slice(1).map((row, i) => toTask(row, i + 2, map));
  const points = {};
  tasks.filter(t => t.isDone).forEach(t => {
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
    for (const name of names) { const i = headers.indexOf(name); if (i >= 0) return i + 1; }
    return 0;
  };
  return {
    id:            find("id"),
    dateAdded:     find("date added"),
    responsible:   find("responsible"),
    category:      find("category", "topic"),
    estTime:       find("est time"),
    title:         find("task name en", "task name"),
    description:   find("description en", "description"),
    youtubeLink:   find("youtube link"),
    worksheet:     find("worksheet"),
    dateAssigned:  find("date assigned"),
    completedDate: find("date completed"),
    isDone:        find("isdone", "is done", "done"),
    points:        find("points"),
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
  const get = col => col ? row[col - 1] : "";
  return {
    rowNumber,
    id:            String(get(map.id)            || "").trim(),
    dateAdded:     formatDate(get(map.dateAdded)),
    responsible:   String(get(map.responsible)   || "Unassigned").trim(),
    topic:         String(get(map.category)      || "General").trim(),
    estTime:       String(get(map.estTime)        || "").trim(),
    title:         String(get(map.title)          || "Untitled task").trim(),
    description:   String(get(map.description)   || "").trim(),
    youtubeLink:   String(get(map.youtubeLink)   || "").trim(),
    worksheet:     String(get(map.worksheet)      || "").trim(),
    dateAssigned:  formatDate(get(map.dateAssigned)),
    completedDate: formatDate(get(map.completedDate)),
    isDone:        parseBoolean(get(map.isDone)),
    points:        Number(get(map.points)         || 0),
  };
}

function normalizeDate(raw) {
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2,"0")}-${m[2].padStart(2,"0")}`;
  const MONTHS = {january:"01",february:"02",march:"03",april:"04",may:"05",june:"06",
                  july:"07",august:"08",september:"09",october:"10",november:"11",december:"12"};
  const ml = raw.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
  if (ml) { const mo = MONTHS[ml[1].toLowerCase()]; if (mo) return `${ml[3]}-${mo}-${ml[2].padStart(2,"0")}`; }
  return raw.substring(0, 10);
}

function formatDate(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]")
    return Utilities.formatDate(value, Session.getScriptTimeZone(), "yyyy-MM-dd");
  return String(value);
}

function parseBoolean(value) {
  if (value === true) return true;
  return ["yes","true","1","done","complete","completed","finished","closed"]
    .includes(String(value || "").toLowerCase().trim());
}
