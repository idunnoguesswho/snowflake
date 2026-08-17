# Frost Ledger

A bill tracker: log bills with invoice/receipt attached, see what's owing and when, tap to mark paid with payment proof attached, and pull financial-disclosure reports. Attachments live in Google Drive, data lives in a Google Sheet, the site itself is static and free to host on GitHub Pages.

## How it fits together

```
GitHub Pages (this repo)  →  Google Apps Script Web App  →  Google Sheet (ledger) + Google Drive (attachments)
      index.html                    Code.gs
      style.css                (deploy separately,
      app.js                    see apps-script/SETUP.md)
      config.js
```

Two people can sign in with Google. Katie (full access) can add bills, mark them paid, and see everything. Jon (restricted) can only see bills flagged **Separation Agreement**, and can't add or edit anything. That split is enforced on the server (`Code.gs`), not just hidden in the browser — a restricted account never receives the other rows at all.

## Setup order

1. **`apps-script/SETUP.md`** — do this first. Creates the Sheet, the Drive folder, and deploys `Code.gs` as a Web App. You'll end up with a Web App URL.
2. **`config.js`** — paste in your OAuth Client ID and the Web App URL from step 1. Categories, accounts, and the two allowed emails are also here — edit freely.
3. **`Code.gs`** (already deployed in step 1) needs the *same* Client ID, Sheet ID, Drive folder ID, and allowed emails — there's a matching set of blanks at the top of that file.
4. Push this folder to a GitHub repo, turn on **Settings → Pages** (deploy from the branch, root folder), and open the Pages URL.
5. In Google Cloud Console, add that Pages URL to your OAuth Client's **Authorized JavaScript origins** (Credentials → your Client ID → edit).

## File naming in Drive

Each category gets its own subfolder under the root Drive folder you create. Files are named:

```
{Category}/YYYYMMDD - Vendor - Invoice.pdf
{Category}/YYYYMMDD - Vendor - Receipt.pdf
{Category}/YYYYMMDD - Vendor - Payment.pdf
```

using the bill's due date, so everything sorts chronologically inside each category folder.

## Reports

The Reports tab filters by date range, category, tax-qualifying, and separation-flag, shows totals, and exports a CSV listing every matching bill with its attachment filenames — built for handing to an accountant or including in a financial disclosure package.

## Recurring bills

The "↻ Recurring" button (Ledger toolbar, full access only) sets up a template — category, vendor, amount, frequency (weekly/biweekly/monthly/yearly), and a first due date. Every time the app loads, it checks all active templates and generates any bill that's now due within the next 30 days directly into the ledger as a normal "Owing" row, tagged internally so it won't be generated twice. Pause or delete a template any time — pausing doesn't touch bills already generated.

Because generation happens when someone opens the app, it'll catch up automatically the next time anyone loads the site, even after a gap. If you want it to run even on days nobody opens the app, add a time-driven trigger in the Apps Script editor: **Triggers (clock icon) → Add Trigger → function `dailyRecurringCheck` → time-driven → day timer**.

## Budget

The Budget tab (full access only) shows one row per category for the selected month: a bar comparing what's committed (paid + owing bills due that month) against a budget figure you set inline. Edit the dollar amount in any row and it saves automatically. The dark tick mark on the bar is your budget line — the bar turns from category color to red past it.

## Data persistence & backups

Nothing lives only in the browser — every bill, recurring template, and budget number is written straight to the Google Sheet, so closing the tab or losing your phone never loses data. Three layers protect it beyond that:

1. **Google Sheets' own version history** — every change to the spreadsheet is already tracked automatically and forever, free, no setup. In the Sheet: File → Version history → See version history. You can restore the whole sheet to any past point.
2. **AuditLog tab** — a running, append-only log of who did what and when (added a bill, marked one paid, changed a budget number, paused a recurring template, generated from a template). It's just another tab in the same Sheet — open it directly any time.
3. **Timestamped backup copies** — the "Back Up Now" button (top right, full access only) makes a full copy of the entire spreadsheet into `{Drive root}/Backups`, named with the date and time. Copies older than 180 days are pruned automatically so the folder doesn't grow forever (change `BACKUP_RETENTION_DAYS` in `Code.gs` if you want a different window). Wire `dailyMaintenance` to a daily trigger (see `apps-script/SETUP.md`) to get this automatically without pressing the button.
