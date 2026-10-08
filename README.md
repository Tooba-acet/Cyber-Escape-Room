# Cyber Escape Room

An information security escape room for ACET Solutions, led by Tooba (Security Awareness Training Lead).

- Full game: `index.html` (about 15–20 minutes)
- Tester: `test/index.html` (three easy questions)

Players open the link, enter their name and email, and play. No sign-in is needed.

## Where scores go

GitHub Pages only hosts the pages. Scores are sent to a Google Apps Script web app (`Code.gs`), which saves each play as a row in a Google Sheet:

- **Scores** tab: full game
- **Test Scores** tab: tester
- **Summary** tab: averages for the full game

## Connecting the scores (one time)

1. Create a Google Sheet, then select **Extensions > Apps Script**.
2. Replace the contents of `Code.gs` with this repository's `Code.gs` and save.
3. Select `setup` and click **Run**. Approve the permissions.
4. Click **Deploy > New deployment > Web app**. Set *Execute as*: **Me**, *Who has access*: **Anyone**. Copy the URL ending in `/exec`.
5. In `index.html` and `test/index.html`, replace `PASTE_WEB_APP_URL_HERE` with that URL.

If you edit `Code.gs` later, use **Deploy > Manage deployments > Edit > New version** to keep the same URL.
