# kid-dashboard

## Google Sheet task checkoff

The daily task board reads from the Snowflake family to-do sheet and can mark a task complete through a Google Apps Script web app.

1. Open the Google Sheet: https://docs.google.com/spreadsheets/d/1Zd0Fl3ciRRB_gRqQIwbFFKXxISNQtyoG7ExskQLVm8k
2. In Google Sheets, choose Extensions > Apps Script.
3. Paste the contents of `google-apps-script.js` into the Apps Script editor.
4. Deploy it as a web app with access set to anyone who should be allowed to complete tasks.
5. Copy the web app URL into `snowflake-config.js` as `appsScriptUrl`.

Each completed task writes today's date into `Date Completed` and adds 1 house point to that responsible person.
