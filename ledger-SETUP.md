# Setup — do this before touching config.js

You said you already have a Google Cloud OAuth Client ID, so steps 1–2 below are just "go find it" rather than "go create it." If you get stuck on any step, the error is almost always one of the blanks at the top of `Code.gs` or `config.js` not matching what's actually in Drive/Sheets.

## 1. Create the Google Sheet

- Go to sheets.google.com → new blank spreadsheet → name it something like "Frost Ledger Data."
- Copy its ID out of the URL: `docs.google.com/spreadsheets/d/`**`THIS_PART`**`/edit`
- Leave it empty — the script creates the "Ledger," "Recurring," "Budget," and "AuditLog" tabs and their headers itself the first time each is used.

## 2. Create the Drive folder

- Go to drive.google.com → New → Folder → name it "Frost Ledger Attachments."
- Open it, copy its ID out of the URL: `drive.google.com/drive/folders/`**`THIS_PART`**
- The script will create one subfolder per category inside it automatically.

## 3. Find your existing OAuth Client ID

- console.cloud.google.com → APIs & Services → Credentials
- Under "OAuth 2.0 Client IDs," open the one you're using (it should be a **Web application** type client — if the one you have is a different type, create a new Web application client here instead).
- Copy the Client ID (ends in `.apps.googleusercontent.com`).
- You'll come back to this same screen in step 6.

## 4. Deploy the Apps Script backend

- script.google.com → New project.
- Delete the placeholder code, paste in the full contents of `Code.gs`.
- At the top of the file, fill in:
  - `SHEET_ID` — from step 1
  - `DRIVE_ROOT_FOLDER_ID` — from step 2
  - `GOOGLE_CLIENT_ID` — from step 3
  - `ACCESS.full` / `ACCESS.restricted` — the Google account emails for each tier (already pre-filled with `katie.snow.ca@gmail.com` and `jonsnow0324@gmail.com` — change if those aren't right)
- Save (Ctrl/Cmd+S), name the project "Frost Ledger Backend."
- **Deploy → New deployment** → gear icon → type: **Web app**.
  - Execute as: **Me**
  - Who has access: **Anyone**
  - (This looks odd for a private tool, but it's safe — every request still has to carry a valid Google sign-in token, and the script checks that token and the email allowlist before returning any data. "Anyone" here means "anyone can *reach* the URL," not "anyone can see bills.")
- Click Deploy, authorize the permissions it asks for (Sheets + Drive access), and copy the **Web app URL** it gives you — it ends in `/exec`.

## 5. Fill in config.js

Open `config.js` in this repo and paste in:
- `GOOGLE_CLIENT_ID` — same value as step 3
- `WEB_APP_URL` — the `/exec` URL from step 4

## 6. Authorize your GitHub Pages URL

Back in Google Cloud Console → Credentials → your OAuth Client:
- Under **Authorized JavaScript origins**, add your GitHub Pages URL, e.g. `https://yourusername.github.io` (no trailing slash, no path).
- Save.

## 7. Push to GitHub and turn on Pages

- Push this whole folder to a new GitHub repo.
- Repo → Settings → Pages → Source: deploy from branch → branch `main`, folder `/ (root)`.
- Wait a minute, then open the URL GitHub gives you.

## Updating later

If you ever redeploy the script (not just edit-and-save, but a *new* deployment), you'll get a new `/exec` URL and need to update `config.js` again. Editing the script and using **Manage deployments → Edit → same deployment** keeps the URL stable, which is usually what you want.

## Recommended: a daily trigger

In the Apps Script editor, click the clock icon (Triggers) → **Add Trigger**:
- Function: `dailyMaintenance`
- Event source: Time-driven
- Type: Day timer, pick any time that works (e.g. 3–4am)

This generates any due recurring bills and makes a timestamped backup copy of the whole spreadsheet into `{Drive root}/Backups` once a day, even if nobody opens the site that day.

## A note on the "Anyone" access setting

This is the standard pattern for a GitHub Pages site backed by Apps Script — Apps Script doesn't support the browser's CORS preflight handshake that "Anyone with Google account" access would require for a cross-origin fetch. Real authentication happens via the Google Sign-In token this app sends with every request, verified server-side against Google's own token-info endpoint on every single call. Someone hitting the raw URL without a valid token gets nothing back but an error.
