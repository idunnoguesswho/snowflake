// ============================================================
// FROST LEDGER — app.js
// Talks to the Apps Script Web App (see apps-script/Code.gs).
// All access control (who sees what) is enforced server-side —
// this file only adapts the UI to the role the server returns.
// ============================================================

let STATE = {
  idToken: null,
  role: null,        // "full" | "restricted"
  email: null,
  name: null,
  bills: [],
  currentDetailId: null
};

// ---------- API ----------
// Sent as text/plain so the browser treats it as a "simple request"
// and skips a CORS preflight OPTIONS call, which Apps Script Web
// Apps don't handle. The server still parses it as JSON.
async function api(action, payload) {
  const res = await fetch(CONFIG.WEB_APP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: STATE.idToken, action, payload: payload || {} })
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ---------- Auth ----------
function initGoogleSignIn() {
  google.accounts.id.initialize({
    client_id: CONFIG.GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse
  });
  google.accounts.id.renderButton(document.getElementById("g_id_signin"), {
    theme: "filled_blue", size: "large", shape: "pill"
  });
}

async function handleCredentialResponse(response) {
  STATE.idToken = response.credential;
  const payload = decodeJwt(response.credential);
  STATE.email = payload.email;
  STATE.name = payload.name || payload.email;
  sessionStorage.setItem("frostledger_token", STATE.idToken);
  await bootApp();
}

function decodeJwt(token) {
  const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
  return JSON.parse(decodeURIComponent(escape(atob(base64))));
}

function signOut() {
  sessionStorage.removeItem("frostledger_token");
  STATE = { idToken: null, role: null, email: null, name: null, bills: [], currentDetailId: null };
  document.getElementById("app").hidden = true;
  document.getElementById("login-screen").hidden = false;
  google.accounts.id.disableAutoSelect();
}

async function bootApp() {
  const err = document.getElementById("login-error");
  err.hidden = true;
  try {
    const who = await api("whoami", {});
    STATE.role = who.role;
    document.getElementById("login-screen").hidden = true;
    document.getElementById("app").hidden = false;
    document.getElementById("user-badge").textContent =
      `${STATE.name} · ${STATE.role === "full" ? "Full access" : "Separation view"}`;

    populateCategoryDropdowns();
    populateAccountDropdown();
    applyRoleUI();
    await loadBills();
  } catch (e) {
    err.textContent = "Sign-in didn't go through: " + e.message + ". If your email isn't on the access list yet, check config.js / Code.gs.";
    err.hidden = false;
  }
}

function applyRoleUI() {
  const restricted = STATE.role === "restricted";
  document.getElementById("add-bill-btn").hidden = restricted;
  document.getElementById("manage-recurring-btn").hidden = restricted;
  document.getElementById("tab-budget").hidden = restricted;
  document.getElementById("backup-btn").hidden = restricted;
  document.getElementById("filter-separation").checked = restricted;
  document.getElementById("filter-separation").disabled = restricted;
}

// ---------- Bootstrap ----------
window.addEventListener("load", () => {
  const saved = sessionStorage.getItem("frostledger_token");
  initGoogleSignIn();
  if (saved) {
    STATE.idToken = saved;
    const payload = decodeJwt(saved);
    STATE.email = payload.email;
    STATE.name = payload.name || payload.email;
    bootApp().catch(() => signOut());
  }
  wireStaticEvents();
});

// ---------- Dropdowns ----------
function populateCategoryDropdowns() {
  const opts = CONFIG.CATEGORIES.map(c => `<option value="${c.name}">${c.name}</option>`).join("");
  document.getElementById("f-category").innerHTML = opts;
  document.getElementById("filter-category").innerHTML = `<option value="">All categories</option>${opts}`;
  document.getElementById("report-category").innerHTML = `<option value="">All categories</option>${opts}`;
  document.getElementById("r-category").innerHTML = opts;
}
function populateAccountDropdown() {
  document.getElementById("p-account").innerHTML =
    CONFIG.ACCOUNTS.map(a => `<option value="${a}">${a}</option>`).join("");
}
function categoryColor(name) {
  const c = CONFIG.CATEGORIES.find(c => c.name === name);
  return c ? c.color : "#5b91ad";
}

// ---------- Load & render ledger ----------
async function loadBills() {
  const data = await api("list", {});
  STATE.bills = data.bills;
  renderSummary();
  renderLedger();
}

function money(n) {
  return "$" + Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function renderSummary() {
  const owing = STATE.bills.filter(b => b.status === "Owing");
  const total = owing.reduce((s, b) => s + Number(b.amount || 0), 0);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = owing.filter(b => b.dueDate < today);
  const upcoming = owing.filter(b => b.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  document.getElementById("sum-owing").textContent = money(total);
  document.getElementById("sum-overdue").textContent = overdue.length;
  document.getElementById("sum-next").textContent = upcoming.length
    ? `${upcoming[0].vendor} · ${formatDate(upcoming[0].dueDate)}`
    : "—";
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function getFilteredBills() {
  const q = document.getElementById("search-input").value.trim().toLowerCase();
  const cat = document.getElementById("filter-category").value;
  const sepOnly = document.getElementById("filter-separation").checked;
  return STATE.bills.filter(b => {
    if (q && !(`${b.vendor} ${b.notes}`.toLowerCase().includes(q))) return false;
    if (cat && b.category !== cat) return false;
    if (sepOnly && !b.separation) return false;
    return true;
  });
}

function renderLedger() {
  const bills = getFilteredBills();
  const today = new Date().toISOString().slice(0, 10);
  const overdue = bills.filter(b => b.status === "Owing" && b.dueDate < today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const upcoming = bills.filter(b => b.status === "Owing" && b.dueDate >= today).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const paid = bills.filter(b => b.status === "Paid").sort((a, b) => (b.paymentDate || "").localeCompare(a.paymentDate || ""));

  const groups = [
    ["Overdue", overdue],
    ["Upcoming", upcoming],
    ["Paid", paid]
  ];

  const wrap = document.getElementById("ledger-groups");
  wrap.innerHTML = "";

  if (!bills.length) {
    wrap.innerHTML = `<div class="empty-state">No bills match. ${STATE.role === "full" ? "Tap “+ Add Bill” to log one." : ""}</div>`;
    return;
  }

  groups.forEach(([label, rows]) => {
    if (!rows.length) return;
    const section = document.createElement("div");
    section.className = "ledger-group";
    section.innerHTML = `<div class="ledger-group-title">${label} (${rows.length})</div>`;
    rows.forEach(b => section.appendChild(renderBillRow(b, label)));
    wrap.appendChild(section);
  });
}

function renderBillRow(b, groupLabel) {
  const row = document.createElement("div");
  row.className = "bill-row";
  row.style.setProperty("--cat-color", categoryColor(b.category));

  const badges = [];
  if (groupLabel === "Overdue") badges.push('<span class="badge badge-overdue">Overdue</span>');
  if (groupLabel === "Upcoming") badges.push('<span class="badge badge-upcoming">Due ' + formatDate(b.dueDate) + '</span>');
  if (groupLabel === "Paid") badges.push('<span class="badge badge-paid">Paid ' + formatDate(b.paymentDate) + '</span>');
  if (b.taxQualifying) badges.push('<span class="badge badge-tax">Tax</span>');
  if (b.separation) badges.push('<span class="badge badge-separation">⚖ Separation</span>');

  row.innerHTML = `
    <div class="bill-main">
      <div class="bill-vendor">${escapeHtml(b.vendor)}</div>
      <div class="bill-meta">
        <span class="bill-cat-tag"><span class="bill-cat-dot"></span>${escapeHtml(b.category)}</span>
        <span class="badge-row">${badges.join("")}</span>
      </div>
    </div>
    <div class="bill-amount">${money(b.amount)}</div>
  `;

  if (b.status === "Owing" && STATE.role === "full") {
    const btn = document.createElement("button");
    btn.className = "btn-primary paid-btn";
    btn.textContent = "Mark Paid";
    btn.type = "button";
    btn.addEventListener("click", (e) => { e.stopPropagation(); openMarkPaid(b); });
    row.appendChild(btn);
  }

  row.addEventListener("click", () => openDetail(b));
  return row;
}

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
}

// ---------- Detail drawer ----------
function openDetail(b) {
  STATE.currentDetailId = b.id;
  const card = document.getElementById("detail-card");
  card.innerHTML = `
    <h2 class="modal-title">${escapeHtml(b.vendor)}</h2>
    <p class="modal-sub">${escapeHtml(b.category)} · ${money(b.amount)}</p>

    <div class="detail-section">
      <div class="detail-label">Status</div>
      <div class="detail-value">${b.status}${b.status === "Paid" ? " on " + formatDate(b.paymentDate) + (b.paymentAccount ? " from " + escapeHtml(b.paymentAccount) : "") : " · due " + formatDate(b.dueDate)}</div>
    </div>

    ${b.notes ? `<div class="detail-section"><div class="detail-label">Notes</div><div class="detail-value">${escapeHtml(b.notes)}</div></div>` : ""}

    <div class="detail-section">
      <div class="detail-label">Markers</div>
      <div class="badge-row">
        ${b.taxQualifying ? '<span class="badge badge-tax">Tax-qualifying</span>' : ""}
        ${b.separation ? '<span class="badge badge-separation">⚖ Separation Agreement</span>' : ""}
        ${(!b.taxQualifying && !b.separation) ? '<span class="detail-value">None</span>' : ""}
      </div>
    </div>

    <div class="detail-section">
      <div class="detail-label">Attachments</div>
      <div style="display:flex; flex-direction:column; gap:6px;">
        ${b.invoiceUrl ? `<a class="attach-link" href="${b.invoiceUrl}" target="_blank" rel="noopener">📄 Invoice</a>` : ""}
        ${b.receiptUrl ? `<a class="attach-link" href="${b.receiptUrl}" target="_blank" rel="noopener">🧾 Receipt</a>` : ""}
        ${b.paymentUrl ? `<a class="attach-link" href="${b.paymentUrl}" target="_blank" rel="noopener">💳 Payment confirmation</a>` : ""}
        ${(!b.invoiceUrl && !b.receiptUrl && !b.paymentUrl) ? '<span class="detail-value">None on file</span>' : ""}
      </div>
    </div>

    <div class="modal-actions">
      <button type="button" class="btn-ghost" id="detail-close">Close</button>
    </div>
  `;
  document.getElementById("detail-drawer").hidden = false;
  document.getElementById("detail-close").addEventListener("click", closeDetail);
}
function closeDetail() { document.getElementById("detail-drawer").hidden = true; }

// ---------- Add Bill ----------
function openAddBill() {
  document.getElementById("add-bill-form").reset();
  document.getElementById("add-bill-error").hidden = true;
  document.getElementById("add-bill-modal").hidden = false;
}
function closeAddBill() { document.getElementById("add-bill-modal").hidden = true; }

async function fileToBase64(fileInput) {
  const file = fileInput.files[0];
  if (!file) return null;
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return { filename: file.name, mimeType: file.type || "application/octet-stream", base64: btoa(binary) };
}

async function submitAddBill(e) {
  e.preventDefault();
  const errEl = document.getElementById("add-bill-error");
  errEl.hidden = true;
  const submitBtn = document.getElementById("add-bill-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";
  try {
    const invoice = await fileToBase64(document.getElementById("f-invoice"));
    const receipt = await fileToBase64(document.getElementById("f-receipt"));
    await api("addBill", {
      category: document.getElementById("f-category").value,
      vendor: document.getElementById("f-vendor").value.trim(),
      amount: parseFloat(document.getElementById("f-amount").value),
      dueDate: document.getElementById("f-duedate").value,
      taxQualifying: document.getElementById("f-tax").checked,
      separation: document.getElementById("f-separation").checked,
      notes: document.getElementById("f-notes").value.trim(),
      invoice, receipt
    });
    closeAddBill();
    showToast("Bill saved.");
    await loadBills();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Bill";
  }
}

// ---------- Mark Paid ----------
let PAY_TARGET = null;
function openMarkPaid(bill) {
  PAY_TARGET = bill;
  document.getElementById("mark-paid-form").reset();
  document.getElementById("mark-paid-error").hidden = true;
  document.getElementById("paid-context").textContent = `${bill.vendor} · ${money(bill.amount)}`;
  document.getElementById("p-date").value = new Date().toISOString().slice(0, 10);
  document.getElementById("mark-paid-modal").hidden = false;
}
function closeMarkPaid() { document.getElementById("mark-paid-modal").hidden = true; PAY_TARGET = null; }

async function submitMarkPaid(e) {
  e.preventDefault();
  const errEl = document.getElementById("mark-paid-error");
  errEl.hidden = true;
  const submitBtn = document.getElementById("mark-paid-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";
  try {
    const paymentFile = await fileToBase64(document.getElementById("p-file"));
    await api("markPaid", {
      id: PAY_TARGET.id,
      account: document.getElementById("p-account").value,
      paymentDate: document.getElementById("p-date").value,
      paymentFile
    });
    closeMarkPaid();
    showToast("Marked paid.");
    await loadBills();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Confirm Paid";
  }
}

// ---------- Reports ----------
let LAST_REPORT = [];
async function runReport() {
  const btn = document.getElementById("run-report-btn");
  btn.disabled = true;
  btn.textContent = "Running…";
  try {
    const data = await api("report", {
      from: document.getElementById("report-from").value,
      to: document.getElementById("report-to").value,
      category: document.getElementById("report-category").value,
      taxOnly: document.getElementById("report-tax").checked,
      separationOnly: document.getElementById("report-separation").checked
    });
    LAST_REPORT = data.bills;
    renderReport(data);
    document.getElementById("export-csv-btn").disabled = data.bills.length === 0;
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Run Report";
  }
}

function renderReport(data) {
  const totalsEl = document.getElementById("report-totals");
  totalsEl.hidden = false;
  totalsEl.innerHTML = `
    <div class="summary-card"><span class="summary-label">Total</span><span class="summary-value">${money(data.totals.all)}</span></div>
    <div class="summary-card"><span class="summary-label">Paid</span><span class="summary-value">${money(data.totals.paid)}</span></div>
    <div class="summary-card"><span class="summary-label">Owing</span><span class="summary-value">${money(data.totals.owing)}</span></div>
    <div class="summary-card"><span class="summary-label">Tax-qualifying</span><span class="summary-value">${money(data.totals.tax)}</span></div>
  `;

  const wrap = document.getElementById("report-table-wrap");
  if (!data.bills.length) {
    wrap.innerHTML = `<div class="empty-state">No bills in this filter.</div>`;
    return;
  }
  const rows = data.bills.map(b => `
    <tr>
      <td>${formatDate(b.dueDate)}</td>
      <td>${escapeHtml(b.category)}</td>
      <td>${escapeHtml(b.vendor)}</td>
      <td>${money(b.amount)}</td>
      <td>${b.status}</td>
      <td>${b.taxQualifying ? "Yes" : ""}</td>
      <td>${b.separation ? "Yes" : ""}</td>
      <td>${escapeHtml(b.paymentAccount || "")}</td>
      <td>${[b.invoiceFilename, b.receiptFilename, b.paymentFilename].filter(Boolean).join(", ")}</td>
    </tr>
  `).join("");
  wrap.innerHTML = `
    <table class="report-table">
      <thead><tr>
        <th>Due Date</th><th>Category</th><th>Vendor</th><th>Amount</th><th>Status</th>
        <th>Tax</th><th>Separation</th><th>Paid From</th><th>Attachments</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

function exportCsv() {
  const headers = ["Due Date", "Category", "Vendor", "Amount", "Status", "Tax Qualifying", "Separation Agreement", "Paid From Account", "Payment Date", "Invoice File", "Receipt File", "Payment File", "Notes"];
  const lines = [headers.join(",")];
  LAST_REPORT.forEach(b => {
    const row = [
      b.dueDate, b.category, b.vendor, b.amount, b.status,
      b.taxQualifying ? "Yes" : "No", b.separation ? "Yes" : "No",
      b.paymentAccount || "", b.paymentDate || "",
      b.invoiceFilename || "", b.receiptFilename || "", b.paymentFilename || "",
      b.notes || ""
    ].map(csvEscape);
    lines.push(row.join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `frost-ledger-report-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
function csvEscape(v) {
  const s = String(v == null ? "" : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
}

// ---------- Budget ----------
function currentMonthStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

async function loadBudgetView() {
  const monthInput = document.getElementById("budget-month");
  if (!monthInput.value) monthInput.value = currentMonthStr();
  try {
    const data = await api("monthlySummary", { month: monthInput.value });
    renderBudget(data);
  } catch (err) {
    showToast(err.message);
  }
}

function renderBudget(data) {
  document.getElementById("budget-total-budget").textContent = money(data.totals.budget);
  document.getElementById("budget-total-spent").textContent = money(data.totals.spent);
  const remaining = data.totals.budget - data.totals.spent;
  const remainEl = document.getElementById("budget-total-remaining");
  remainEl.textContent = money(remaining);
  remainEl.style.color = remaining < 0 ? "var(--red-500)" : "";

  // Show every configured category, even ones with $0 spent this month.
  const known = {};
  data.categories.forEach(c => known[c.category] = c);
  const allCats = CONFIG.CATEGORIES.map(c => c.name);
  Object.keys(known).forEach(name => { if (!allCats.includes(name)) allCats.push(name); });

  const wrap = document.getElementById("budget-rows");
  wrap.innerHTML = "";
  allCats.forEach(name => {
    const c = known[name] || { category: name, budget: 0, spent: 0, paid: 0, owing: 0 };
    wrap.appendChild(renderBudgetRow(c));
  });
}

function renderBudgetRow(c) {
  const row = document.createElement("div");
  row.className = "budget-row";
  row.style.setProperty("--cat-color", categoryColor(c.category));

  const scale = Math.max(c.budget, c.spent, 1) * 1.05;
  const spentPct = Math.min(100, (c.spent / scale) * 100);
  const markerPct = c.budget > 0 ? Math.min(100, (c.budget / scale) * 100) : null;
  const over = c.budget > 0 && c.spent > c.budget;

  row.innerHTML = `
    <div class="budget-row-top">
      <span class="budget-row-name"><span class="bill-cat-dot"></span>${escapeHtml(c.category)}</span>
      <span class="budget-row-figures">
        <span>${money(c.spent)} spent${c.budget ? " of " + money(c.budget) : ""}</span>
        <span>Budget $ <input type="number" class="budget-input" min="0" step="1" value="${c.budget || ""}" placeholder="0" data-category="${escapeHtml(c.category)}"></span>
      </span>
    </div>
    <div class="bar-track">
      <div class="bar-fill${over ? " over" : ""}" style="width:${spentPct}%"></div>
      ${markerPct !== null ? `<div class="bar-marker" style="left:${markerPct}%"></div>` : ""}
    </div>
  `;
  row.querySelector(".budget-input").addEventListener("change", async (e) => {
    const amount = parseFloat(e.target.value || "0");
    try {
      await api("setBudget", { category: c.category, amount });
      await loadBudgetView();
    } catch (err) {
      showToast(err.message);
    }
  });
  return row;
}

// ---------- Recurring bills ----------
let RECURRING_CACHE = [];

async function openRecurringModal() {
  document.getElementById("recurring-modal").hidden = false;
  document.getElementById("recurring-form").hidden = true;
  await refreshRecurringList();
}
function closeRecurringModal() { document.getElementById("recurring-modal").hidden = true; }

async function refreshRecurringList() {
  const wrap = document.getElementById("recurring-list");
  wrap.innerHTML = `<div class="empty-inline">Loading…</div>`;
  try {
    const data = await api("listRecurring", {});
    RECURRING_CACHE = data.recurring;
    if (!RECURRING_CACHE.length) {
      wrap.innerHTML = `<div class="empty-inline">No recurring bills set up yet.</div>`;
      return;
    }
    wrap.innerHTML = "";
    RECURRING_CACHE.forEach(r => wrap.appendChild(renderRecurringItem(r)));
  } catch (err) {
    wrap.innerHTML = `<div class="empty-inline">${escapeHtml(err.message)}</div>`;
  }
}

function renderRecurringItem(r) {
  const el = document.createElement("div");
  el.className = "recurring-item" + (r.active ? "" : " inactive");
  el.style.setProperty("--cat-color", categoryColor(r.category));
  el.innerHTML = `
    <div class="recurring-main">
      <div class="recurring-vendor">${escapeHtml(r.vendor)} · ${money(r.amount)}</div>
      <div class="recurring-meta">${escapeHtml(r.category)} · ${r.frequency} · next ${formatDate(r.nextDueDate)}${r.separation ? " · ⚖ Separation" : ""}${r.taxQualifying ? " · Tax" : ""}</div>
    </div>
    <div class="recurring-actions">
      <button type="button" class="icon-btn" data-act="toggle">${r.active ? "Pause" : "Resume"}</button>
      <button type="button" class="icon-btn danger" data-act="delete">Delete</button>
    </div>
  `;
  el.querySelector('[data-act="toggle"]').addEventListener("click", async () => {
    try { await api("setRecurringActive", { id: r.id, active: !r.active }); await refreshRecurringList(); }
    catch (err) { showToast(err.message); }
  });
  el.querySelector('[data-act="delete"]').addEventListener("click", async () => {
    if (!confirm(`Delete the recurring bill for ${r.vendor}? This won't remove bills already generated.`)) return;
    try { await api("deleteRecurring", { id: r.id }); await refreshRecurringList(); }
    catch (err) { showToast(err.message); }
  });
  return el;
}

async function submitRecurring(e) {
  e.preventDefault();
  const errEl = document.getElementById("recurring-error");
  errEl.hidden = true;
  const submitBtn = document.getElementById("recurring-submit");
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";
  try {
    await api("addRecurring", {
      category: document.getElementById("r-category").value,
      vendor: document.getElementById("r-vendor").value.trim(),
      amount: parseFloat(document.getElementById("r-amount").value),
      frequency: document.getElementById("r-frequency").value,
      startDate: document.getElementById("r-startdate").value,
      taxQualifying: document.getElementById("r-tax").checked,
      separation: document.getElementById("r-separation").checked,
      notes: document.getElementById("r-notes").value.trim()
    });
    document.getElementById("recurring-form").reset();
    document.getElementById("recurring-form").hidden = true;
    showToast("Recurring bill saved.");
    await refreshRecurringList();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Recurring Bill";
  }
}

// ---------- Backup ----------
async function runBackupNow() {
  const btn = document.getElementById("backup-btn");
  btn.disabled = true;
  btn.textContent = "Backing up…";
  try {
    const data = await api("backupNow", {});
    showToast("Backup saved: " + data.name);
  } catch (err) {
    showToast(err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "Back Up Now";
  }
}

// ---------- Wire static events ----------
function wireStaticEvents() {
  document.getElementById("signout-btn").addEventListener("click", signOut);
  document.getElementById("backup-btn").addEventListener("click", runBackupNow);

  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const view = btn.dataset.view;
      document.getElementById("view-ledger").hidden = view !== "ledger";
      document.getElementById("view-budget").hidden = view !== "budget";
      document.getElementById("view-reports").hidden = view !== "reports";
      if (view === "budget") loadBudgetView();
    });
  });
  document.getElementById("budget-month").addEventListener("change", loadBudgetView);

  document.getElementById("manage-recurring-btn").addEventListener("click", openRecurringModal);
  document.getElementById("recurring-close").addEventListener("click", closeRecurringModal);
  document.getElementById("recurring-new-btn").addEventListener("click", () => {
    document.getElementById("recurring-form").hidden = false;
    document.getElementById("r-startdate").value = new Date().toISOString().slice(0, 10);
  });
  document.getElementById("recurring-cancel").addEventListener("click", () => {
    document.getElementById("recurring-form").reset();
    document.getElementById("recurring-form").hidden = true;
  });
  document.getElementById("recurring-form").addEventListener("submit", submitRecurring);
  document.getElementById("recurring-modal").addEventListener("click", (e) => {
    if (e.target.id === "recurring-modal") closeRecurringModal();
  });

  document.getElementById("search-input").addEventListener("input", renderLedger);
  document.getElementById("filter-category").addEventListener("change", renderLedger);
  document.getElementById("filter-separation").addEventListener("change", renderLedger);

  document.getElementById("add-bill-btn").addEventListener("click", openAddBill);
  document.getElementById("add-bill-cancel").addEventListener("click", closeAddBill);
  document.getElementById("add-bill-form").addEventListener("submit", submitAddBill);

  document.getElementById("mark-paid-cancel").addEventListener("click", closeMarkPaid);
  document.getElementById("mark-paid-form").addEventListener("submit", submitMarkPaid);

  document.getElementById("detail-drawer").addEventListener("click", (e) => {
    if (e.target.id === "detail-drawer") closeDetail();
  });
  document.getElementById("add-bill-modal").addEventListener("click", (e) => {
    if (e.target.id === "add-bill-modal") closeAddBill();
  });
  document.getElementById("mark-paid-modal").addEventListener("click", (e) => {
    if (e.target.id === "mark-paid-modal") closeMarkPaid();
  });

  document.getElementById("run-report-btn").addEventListener("click", runReport);
  document.getElementById("export-csv-btn").addEventListener("click", exportCsv);
}
