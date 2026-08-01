/**
 * FROST LEDGER — Apps Script backend
 * Deploy as a Web App (Execute as: Me, Access: Anyone).
 * See SETUP.md for the full walkthrough.
 *
 * This script is the ONLY place access control is actually enforced.
 * The frontend's role-based hiding is just UX — a restricted user's
 * requests are filtered here before any data leaves the server.
 */

// ============ FILL THESE IN ============
const SHEET_ID = "PASTE_YOUR_GOOGLE_SHEET_ID_HERE";
const DRIVE_ROOT_FOLDER_ID = "PASTE_YOUR_DRIVE_FOLDER_ID_HERE";
const GOOGLE_CLIENT_ID = "PASTE_YOUR_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com";

const ACCESS = {
  full: ["katie.snow.ca@gmail.com"],
  restricted: ["jonsnow0324@gmail.com"]
};
// =========================================

const SHEET_NAME = "Ledger";
const HEADERS = [
  "ID", "DateAdded", "Category", "Vendor", "Amount", "DueDate", "Status",
  "TaxQualifying", "Separation", "Notes",
  "InvoiceUrl", "InvoiceFilename", "ReceiptUrl", "ReceiptFilename",
  "PaymentUrl", "PaymentFilename", "PaymentAccount", "PaymentDate", "CreatedBy",
  "RecurringId"
];

const RECURRING_SHEET_NAME = "Recurring";
const RECURRING_HEADERS = [
  "ID", "Category", "Vendor", "Amount", "Frequency", "NextDueDate",
  "TaxQualifying", "Separation", "Notes", "Active", "CreatedBy"
];

const BUDGET_SHEET_NAME = "Budget";
const BUDGET_HEADERS = ["Category", "MonthlyBudget"];

const AUDIT_SHEET_NAME = "AuditLog";
const AUDIT_HEADERS = ["Timestamp", "User", "Action", "Category", "Vendor", "BillID", "Details"];

// How far ahead to pre-generate recurring bills, in days.
const RECURRING_LOOKAHEAD_DAYS = 30;

// Backup snapshots of the whole spreadsheet, copied into
// {Drive root}/Backups. Older-than-this-many-days copies get pruned
// automatically so the folder doesn't grow forever.
const BACKUP_FOLDER_NAME = "Backups";
const BACKUP_RETENTION_DAYS = 180;

// ---------- Entry points ----------
function doGet(e) {
  return jsonOut({ ok: true, info: "Frost Ledger API is running. Use POST." });
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const user = verifyToken(body.token);
    const role = roleFor(user.email);
    if (!role) throw new Error("This Google account isn't on the access list.");

    const ctx = { email: user.email, role: role };
    let result;
    switch (body.action) {
      case "whoami":          result = { role: role, email: user.email }; break;
      case "list":             ensureRecurringGenerated(); result = { bills: listBills(ctx) }; break;
      case "addBill":          result = { bill: addBill(ctx, body.payload) }; break;
      case "markPaid":         result = { bill: markPaid(ctx, body.payload) }; break;
      case "report":            ensureRecurringGenerated(); result = report(ctx, body.payload); break;

      case "listRecurring":     result = { recurring: listRecurring(ctx) }; break;
      case "addRecurring":      result = { recurring: addRecurring(ctx, body.payload) }; break;
      case "setRecurringActive":result = { recurring: setRecurringActive(ctx, body.payload) }; break;
      case "deleteRecurring":   result = { deleted: deleteRecurring(ctx, body.payload) }; break;

      case "getBudget":         result = { budget: getBudget(ctx) }; break;
      case "setBudget":         result = { budget: setBudget(ctx, body.payload) }; break;
      case "monthlySummary":    ensureRecurringGenerated(); result = monthlySummary(ctx, body.payload); break;

      case "backupNow":         result = backupNow(ctx); break;

      default: throw new Error("Unknown action: " + body.action);
    }
    return jsonOut(Object.assign({ ok: true }, result));
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

// Wire this to a daily time-driven trigger (Apps Script editor →
// Triggers → Add Trigger → function "dailyMaintenance" → time-driven
// → day timer) so recurring bills and backups happen even on days
// nobody opens the app.
function dailyMaintenance() {
  ensureRecurringGenerated();
  performBackup();
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------- Auth ----------
function verifyToken(token) {
  if (!token) throw new Error("Missing sign-in token.");
  const resp = UrlFetchApp.fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(token), { muteHttpExceptions: true });
  if (resp.getResponseCode() !== 200) throw new Error("Sign-in token is invalid or expired. Please sign in again.");
  const info = JSON.parse(resp.getContentText());
  if (info.aud !== GOOGLE_CLIENT_ID) throw new Error("Token was not issued for this app.");
  if (!info.email_verified || info.email_verified === "false") throw new Error("Google account email isn't verified.");
  return info;
}

function roleFor(email) {
  const e = (email || "").toLowerCase();
  if (ACCESS.full.map(x => x.toLowerCase()).includes(e)) return "full";
  if (ACCESS.restricted.map(x => x.toLowerCase()).includes(e)) return "restricted";
  return null;
}

function requireFull(ctx) {
  if (ctx.role !== "full") throw new Error("View-only access — this action isn't available.");
}

// ---------- Generic sheet helpers ----------
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}
function getSheet() { return getOrCreateSheet(SHEET_NAME, HEADERS); }
function getRecurringSheet() { return getOrCreateSheet(RECURRING_SHEET_NAME, RECURRING_HEADERS); }
function getBudgetSheet() { return getOrCreateSheet(BUDGET_SHEET_NAME, BUDGET_HEADERS); }
function getAuditSheet() { return getOrCreateSheet(AUDIT_SHEET_NAME, AUDIT_HEADERS); }

function rowsAsObjects(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  }).filter(o => o[headers[0]]); // skip blank rows (first column must be set)
}

// Append-only history of who did what. This is a supplement to —
// not a replacement for — Google Sheets' own built-in version
// history (File → Version history in the Sheet itself), which
// keeps every past state of the whole spreadsheet automatically.
function logAudit(email, action, category, vendor, billId, details) {
  try {
    getAuditSheet().appendRow([new Date(), email, action, category || "", vendor || "", billId || "", details || ""]);
  } catch (e) {
    // Never let audit logging break the actual operation.
  }
}

function toClientBill(o) {
  return {
    id: o.ID,
    category: o.Category,
    vendor: o.Vendor,
    amount: Number(o.Amount || 0),
    dueDate: fmtDate(o.DueDate),
    status: o.Status,
    taxQualifying: o.TaxQualifying === true || o.TaxQualifying === "TRUE",
    separation: o.Separation === true || o.Separation === "TRUE",
    notes: o.Notes || "",
    invoiceUrl: o.InvoiceUrl || "",
    invoiceFilename: o.InvoiceFilename || "",
    receiptUrl: o.ReceiptUrl || "",
    receiptFilename: o.ReceiptFilename || "",
    paymentUrl: o.PaymentUrl || "",
    paymentFilename: o.PaymentFilename || "",
    paymentAccount: o.PaymentAccount || "",
    paymentDate: fmtDate(o.PaymentDate),
    recurringId: o.RecurringId || ""
  };
}

function fmtDate(v) {
  if (!v) return "";
  if (typeof v === "string") return v.slice(0, 10);
  return Utilities.formatDate(new Date(v), Session.getScriptTimeZone() || "America/Edmonton", "yyyy-MM-dd");
}
function todayIso() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Edmonton", "yyyy-MM-dd");
}

// Restricted role only ever sees separation-flagged rows.
function visibleRows(ctx, rows) {
  if (ctx.role === "full") return rows;
  return rows.filter(o => o.Separation === true || o.Separation === "TRUE");
}

// ---------- Ledger actions ----------
function listBills(ctx) {
  const rows = visibleRows(ctx, rowsAsObjects(getSheet()));
  return rows.map(toClientBill).sort((a, b) => a.dueDate < b.dueDate ? -1 : 1);
}

function addBill(ctx, p) {
  requireFull(ctx);
  if (!p.category || !p.vendor || !p.dueDate || !(p.amount >= 0)) throw new Error("Category, vendor, amount, and due date are required.");

  const id = Utilities.getUuid();
  const folder = getCategoryFolder(p.category);
  const namePrefix = datePrefix(p.dueDate) + " - " + sanitizeName(p.vendor);

  const invoice = p.invoice ? saveAttachment(folder, namePrefix + " - Invoice", p.invoice) : null;
  const receipt = p.receipt ? saveAttachment(folder, namePrefix + " - Receipt", p.receipt) : null;

  const sheet = getSheet();
  sheet.appendRow([
    id, new Date(), p.category, p.vendor, p.amount, p.dueDate, "Owing",
    !!p.taxQualifying, !!p.separation, p.notes || "",
    invoice ? invoice.url : "", invoice ? invoice.filename : "",
    receipt ? receipt.url : "", receipt ? receipt.filename : "",
    "", "", "", "", ctx.email,
    p.recurringId || ""
  ]);
  logAudit(ctx.email, "AddBill", p.category, p.vendor, id, "$" + p.amount + " due " + p.dueDate);
  return toClientBill({
    ID: id, Category: p.category, Vendor: p.vendor, Amount: p.amount, DueDate: p.dueDate, Status: "Owing",
    TaxQualifying: !!p.taxQualifying, Separation: !!p.separation, Notes: p.notes || "",
    InvoiceUrl: invoice ? invoice.url : "", InvoiceFilename: invoice ? invoice.filename : "",
    ReceiptUrl: receipt ? receipt.url : "", ReceiptFilename: receipt ? receipt.filename : "",
    RecurringId: p.recurringId || ""
  });
}

function markPaid(ctx, p) {
  requireFull(ctx);
  const sheet = getSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf("ID");
  for (let r = 1; r < values.length; r++) {
    if (values[r][idCol] === p.id) {
      const rowObj = {};
      headers.forEach((h, i) => rowObj[h] = values[r][i]);

      let paymentUrl = "", paymentFilename = "";
      if (p.paymentFile) {
        const folder = getCategoryFolder(rowObj.Category);
        const namePrefix = datePrefix(rowObj.DueDate instanceof Date ? fmtDate(rowObj.DueDate) : rowObj.DueDate) + " - " + sanitizeName(rowObj.Vendor);
        const saved = saveAttachment(folder, namePrefix + " - Payment", p.paymentFile);
        paymentUrl = saved.url; paymentFilename = saved.filename;
      }

      const rowIndex = r + 1;
      sheet.getRange(rowIndex, headers.indexOf("Status") + 1).setValue("Paid");
      sheet.getRange(rowIndex, headers.indexOf("PaymentAccount") + 1).setValue(p.account || "");
      sheet.getRange(rowIndex, headers.indexOf("PaymentDate") + 1).setValue(p.paymentDate || "");
      if (paymentUrl) {
        sheet.getRange(rowIndex, headers.indexOf("PaymentUrl") + 1).setValue(paymentUrl);
        sheet.getRange(rowIndex, headers.indexOf("PaymentFilename") + 1).setValue(paymentFilename);
      }
      rowObj.Status = "Paid"; rowObj.PaymentAccount = p.account; rowObj.PaymentDate = p.paymentDate;
      if (paymentUrl) { rowObj.PaymentUrl = paymentUrl; rowObj.PaymentFilename = paymentFilename; }
      logAudit(ctx.email, "MarkPaid", rowObj.Category, rowObj.Vendor, p.id, "from " + (p.account || "?") + " on " + p.paymentDate);
      return toClientBill(rowObj);
    }
  }
  throw new Error("Bill not found.");
}

function report(ctx, p) {
  const rows = visibleRows(ctx, rowsAsObjects(getSheet())).map(toClientBill);
  const filtered = rows.filter(b => {
    if (p.from && b.dueDate < p.from) return false;
    if (p.to && b.dueDate > p.to) return false;
    if (p.category && b.category !== p.category) return false;
    if (p.taxOnly && !b.taxQualifying) return false;
    if (p.separationOnly && !b.separation) return false;
    return true;
  }).sort((a, b) => a.dueDate < b.dueDate ? -1 : 1);

  const totals = filtered.reduce((acc, b) => {
    acc.all += b.amount;
    if (b.status === "Paid") acc.paid += b.amount; else acc.owing += b.amount;
    if (b.taxQualifying) acc.tax += b.amount;
    return acc;
  }, { all: 0, paid: 0, owing: 0, tax: 0 });

  return { bills: filtered, totals: totals };
}

// ---------- Recurring bills ----------
function toClientRecurring(o) {
  return {
    id: o.ID,
    category: o.Category,
    vendor: o.Vendor,
    amount: Number(o.Amount || 0),
    frequency: o.Frequency,
    nextDueDate: fmtDate(o.NextDueDate),
    taxQualifying: o.TaxQualifying === true || o.TaxQualifying === "TRUE",
    separation: o.Separation === true || o.Separation === "TRUE",
    notes: o.Notes || "",
    active: o.Active === true || o.Active === "TRUE"
  };
}

function listRecurring(ctx) {
  requireFull(ctx);
  return rowsAsObjects(getRecurringSheet()).map(toClientRecurring)
    .sort((a, b) => a.vendor.localeCompare(b.vendor));
}

function addRecurring(ctx, p) {
  requireFull(ctx);
  if (!p.category || !p.vendor || !(p.amount >= 0) || !p.frequency || !p.startDate) {
    throw new Error("Category, vendor, amount, frequency, and a start date are required.");
  }
  const id = Utilities.getUuid();
  const sheet = getRecurringSheet();
  sheet.appendRow([
    id, p.category, p.vendor, p.amount, p.frequency, p.startDate,
    !!p.taxQualifying, !!p.separation, p.notes || "", true, ctx.email
  ]);
  logAudit(ctx.email, "AddRecurring", p.category, p.vendor, id, p.frequency + " starting " + p.startDate);
  return listRecurring(ctx);
}

function setRecurringActive(ctx, p) {
  requireFull(ctx);
  const sheet = getRecurringSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf("ID");
  for (let r = 1; r < values.length; r++) {
    if (values[r][idCol] === p.id) {
      sheet.getRange(r + 1, headers.indexOf("Active") + 1).setValue(!!p.active);
      logAudit(ctx.email, p.active ? "ResumeRecurring" : "PauseRecurring", values[r][headers.indexOf("Category")], values[r][headers.indexOf("Vendor")], p.id, "");
      break;
    }
  }
  return listRecurring(ctx);
}

function deleteRecurring(ctx, p) {
  requireFull(ctx);
  const sheet = getRecurringSheet();
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf("ID");
  for (let r = values.length - 1; r >= 1; r--) {
    if (values[r][idCol] === p.id) {
      logAudit(ctx.email, "DeleteRecurring", values[r][headers.indexOf("Category")], values[r][headers.indexOf("Vendor")], p.id, "");
      sheet.deleteRow(r + 1);
      return true;
    }
  }
  return false;
}

// Generates Ledger rows for any active Recurring template whose
// NextDueDate has arrived (up to RECURRING_LOOKAHEAD_DAYS out),
// then advances NextDueDate. Safe to call on every read — idempotent
// because NextDueDate only moves forward once a bill is generated for it.
function ensureRecurringGenerated() {
  const recSheet = getRecurringSheet();
  const values = recSheet.getDataRange().getValues();
  if (values.length < 2) return;
  const headers = values[0];
  const horizon = addDaysIso(todayIso(), RECURRING_LOOKAHEAD_DAYS);

  const ledgerSheet = getSheet();
  const newRows = [];
  const auditEntries = [];

  for (let r = 1; r < values.length; r++) {
    const row = {};
    headers.forEach((h, i) => row[h] = values[r][i]);
    if (!row.ID) continue;
    if (!(row.Active === true || row.Active === "TRUE")) continue;

    let nextDue = fmtDate(row.NextDueDate);
    let guard = 0;
    while (nextDue && nextDue <= horizon && guard < 24) { // guard caps catch-up bursts
      guard++;
      const newId = Utilities.getUuid();
      newRows.push([
        newId, new Date(), row.Category, row.Vendor, row.Amount, nextDue, "Owing",
        row.TaxQualifying === true || row.TaxQualifying === "TRUE",
        row.Separation === true || row.Separation === "TRUE",
        row.Notes || "", "", "", "", "", "", "", "", "", "system:recurring", row.ID
      ]);
      auditEntries.push([new Date(), "system:recurring", "GenerateBill", row.Category, row.Vendor, newId, "from recurring template " + row.ID]);
      nextDue = addInterval(nextDue, row.Frequency);
    }
    if (guard > 0) {
      recSheet.getRange(r + 1, headers.indexOf("NextDueDate") + 1).setValue(nextDue);
    }
  }

  if (newRows.length) {
    ledgerSheet.getRange(ledgerSheet.getLastRow() + 1, 1, newRows.length, HEADERS.length).setValues(newRows);
    const auditSheet = getAuditSheet();
    auditSheet.getRange(auditSheet.getLastRow() + 1, 1, auditEntries.length, AUDIT_HEADERS.length).setValues(auditEntries);
  }
}

function addInterval(isoDate, frequency) {
  const d = new Date(isoDate + "T00:00:00");
  switch (frequency) {
    case "Weekly": d.setDate(d.getDate() + 7); break;
    case "Biweekly": d.setDate(d.getDate() + 14); break;
    case "Yearly": d.setFullYear(d.getFullYear() + 1); break;
    case "Monthly":
    default: {
      const day = d.getDate();
      d.setDate(1);
      d.setMonth(d.getMonth() + 1);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      d.setDate(Math.min(day, daysInMonth));
      break;
    }
  }
  return Utilities.formatDate(d, Session.getScriptTimeZone() || "America/Edmonton", "yyyy-MM-dd");
}

function addDaysIso(isoDate, n) {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, Session.getScriptTimeZone() || "America/Edmonton", "yyyy-MM-dd");
}

// ---------- Budget ----------
function getBudget(ctx) {
  requireFull(ctx);
  const rows = rowsAsObjects(getBudgetSheet());
  return rows.map(o => ({ category: o.Category, budget: Number(o.MonthlyBudget || 0) }));
}

function setBudget(ctx, p) {
  requireFull(ctx);
  if (!p.category || !(p.amount >= 0)) throw new Error("Category and a budget amount are required.");
  const sheet = getBudgetSheet();
  const values = sheet.getDataRange().getValues();
  for (let r = 1; r < values.length; r++) {
    if (values[r][0] === p.category) {
      sheet.getRange(r + 1, 2).setValue(p.amount);
      logAudit(ctx.email, "SetBudget", p.category, "", "", "$" + p.amount + "/mo");
      return getBudget(ctx);
    }
  }
  sheet.appendRow([p.category, p.amount]);
  logAudit(ctx.email, "SetBudget", p.category, "", "", "$" + p.amount + "/mo");
  return getBudget(ctx);
}

// Spend for a given "YYYY-MM" month = sum of bill amounts (paid + owing)
// whose due date falls in that month. Budget is compared against
// what's committed for the month, not just what's already paid.
function monthlySummary(ctx, p) {
  requireFull(ctx);
  const month = p.month; // "YYYY-MM"
  const bills = rowsAsObjects(getSheet()).map(toClientBill)
    .filter(b => b.dueDate && b.dueDate.slice(0, 7) === month);
  const budgetRows = getBudget(ctx);

  const byCategory = {};
  budgetRows.forEach(b => byCategory[b.category] = { category: b.category, budget: b.budget, spent: 0, paid: 0, owing: 0 });
  bills.forEach(b => {
    if (!byCategory[b.category]) byCategory[b.category] = { category: b.category, budget: 0, spent: 0, paid: 0, owing: 0 };
    byCategory[b.category].spent += b.amount;
    if (b.status === "Paid") byCategory[b.category].paid += b.amount; else byCategory[b.category].owing += b.amount;
  });

  const categories = Object.values(byCategory);
  const totals = categories.reduce((acc, c) => {
    acc.budget += c.budget; acc.spent += c.spent; acc.paid += c.paid; acc.owing += c.owing;
    return acc;
  }, { budget: 0, spent: 0, paid: 0, owing: 0 });

  return { categories: categories, totals: totals, month: month };
}

// ---------- Backups ----------
// A manual or scheduled snapshot of the ENTIRE spreadsheet (Ledger,
// Recurring, Budget, AuditLog all live in one file, so one copy
// covers everything) into {Drive root}/Backups, timestamped.
// This is separate from — and a belt-and-suspenders complement to —
// Google Sheets' own automatic version history.
function backupNow(ctx) {
  requireFull(ctx);
  const result = performBackup();
  logAudit(ctx.email, "BackupNow", "", "", "", result.name);
  return result;
}

function performBackup() {
  const file = DriveApp.getFileById(SHEET_ID);
  const folder = getOrCreateBackupsFolder();
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "America/Edmonton", "yyyy-MM-dd HH:mm");
  const copy = file.makeCopy("Frost Ledger Backup - " + stamp, folder);
  pruneOldBackups(folder);
  return { url: copy.getUrl(), name: copy.getName() };
}

function getOrCreateBackupsFolder() {
  const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  const existing = root.getFoldersByName(BACKUP_FOLDER_NAME);
  if (existing.hasNext()) return existing.next();
  return root.createFolder(BACKUP_FOLDER_NAME);
}

function pruneOldBackups(folder) {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - BACKUP_RETENTION_DAYS);
  const files = folder.getFiles();
  while (files.hasNext()) {
    const f = files.next();
    if (f.getDateCreated() < cutoff) f.setTrashed(true);
  }
}

// ---------- Drive helpers ----------
function getCategoryFolder(category) {
  const root = DriveApp.getFolderById(DRIVE_ROOT_FOLDER_ID);
  const name = sanitizeName(category);
  const existing = root.getFoldersByName(name);
  if (existing.hasNext()) return existing.next();
  return root.createFolder(name);
}

function saveAttachment(folder, baseName, fileInfo) {
  const ext = extFromMime(fileInfo.mimeType, fileInfo.filename);
  const bytes = Utilities.base64Decode(fileInfo.base64);
  const blob = Utilities.newBlob(bytes, fileInfo.mimeType, baseName + ext);
  const file = folder.createFile(blob);
  return { url: file.getUrl(), filename: file.getName() };
}

function extFromMime(mime, originalName) {
  if (originalName && originalName.includes(".")) return "." + originalName.split(".").pop();
  const map = { "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/heic": ".heic" };
  return map[mime] || "";
}

function sanitizeName(s) {
  return String(s || "").replace(/[\\/:*?"<>|]/g, "-").trim();
}

function datePrefix(isoDate) {
  return String(isoDate || "").slice(0, 10).replace(/-/g, "");
}
