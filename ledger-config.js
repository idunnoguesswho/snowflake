// ============================================================
// FROST LEDGER — CONFIG
// Fill in the two values below after you finish the Apps Script
// setup in apps-script/SETUP.md. Everything else here is yours
// to edit any time (categories, colors, accounts, allowed users).
// ============================================================

const CONFIG = {
  // From Google Cloud Console → APIs & Services → Credentials
  GOOGLE_CLIENT_ID: "PASTE_YOUR_OAUTH_CLIENT_ID_HERE.apps.googleusercontent.com",

  // From Apps Script → Deploy → Web app → the /exec URL
  WEB_APP_URL: "PASTE_YOUR_APPS_SCRIPT_WEB_APP_URL_HERE",

  // Site title
  SITE_NAME: "Frost Ledger",

  // Categories + stripe color. Order here = order shown in the
  // "Add Bill" dropdown. Add/remove/rename freely — just keep the
  // same category names in sync with what you type into bills.
  CATEGORIES: [
    { name: "Housing",        color: "#3E6B96" },
    { name: "Utilities",      color: "#2F9E8F" },
    { name: "Insurance",      color: "#7C5CA8" },
    { name: "Vehicle",        color: "#B0562E" },
    { name: "Medical & Kids", color: "#C0447A" },
    { name: "Household",      color: "#4C8C3C" },
    { name: "DSHC Business",  color: "#3A4E7A" },
    { name: "Other",          color: "#6B7280" }
  ],

  // Accounts payments can come from — shown in the "Mark Paid" dropdown
  ACCOUNTS: [
    "Joint Chequing",
    "Personal Chequing",
    "Personal Credit Card",
    "DSHC Business Account",
    "Cash"
  ],

  // Two access tiers. FULL can add bills, mark paid, see everything.
  // RESTRICTED can only view bills flagged "Separation Agreement" —
  // read-only, no dollar totals outside that filter, no edit/paid actions.
  // The real enforcement happens server-side in Code.gs — this list
  // just needs to match what you put there.
  ACCESS: {
    full: ["katie.snow.ca@gmail.com"],
    restricted: ["jonsnow0324@gmail.com"]
  }
};
