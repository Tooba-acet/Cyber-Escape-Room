/**
 * Cyber Escape Room – security awareness escape room (ACET Solutions)
 * Google Apps Script back end for the GitHub Pages site.
 * The game pages send each completed play here; it is saved as a row in
 * this Google Sheet: "Scores" for the full game, "Test Scores" for the tester.
 */
const TABS = { full: 'Scores', test: 'Test Scores' };
const SUMMARY = 'Summary';
let SCORES = TABS.full;
const ROOMS = [
  ['bd',  'Reception wrong (phishing)'],
  ['it',  'IT wrong (passwords & MFA)'],
  ['hr',  'HR & Admin wrong (data handling)'],
  ['eng', 'Engineering wrong (incidents & AI)']
];
const HEADERS = ['Timestamp', 'Name', 'Email', 'Company or team', 'Score', 'Puzzle points', 'Time bonus',
  'Time (seconds)', 'Time (mm:ss)', 'Wrong attempts', 'Hints used']
  .concat(ROOMS.map(r => r[1]))
  .concat(['Lightning round correct (of 6)', 'Exit code wrong attempts', 'Puzzles solved first time (of 12)']);

/** Opening the web app URL directly shows a short status message. */
function doGet() {
  return ContentService.createTextOutput('Cyber Escape Room score service is running.');
}

/** The game pages call this with {action, game, arg}. */
function doPost(e) {
  let out;
  try {
    const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    SCORES = TABS[req.game] || TABS.full;
    if (req.action === 'saveRun') out = { ok: true, data: saveRun(req.arg) };
    else if (req.action === 'getLeaderboard') out = { ok: true, data: getLeaderboard(req.arg) };
    else out = { ok: false, error: 'unknown_action' };
  } catch (err) {
    out = { ok: false, error: String(err && err.message || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor: creates the Scores, Test Scores and Summary tabs and grants permissions. */
function setup() {
  SCORES = TABS.test; scoresSheet_();
  SCORES = TABS.full; scoresSheet_();
  summarySheet_();
  Logger.log('Setup complete. Scores are saved in: ' + book_().getUrl());
}

/** The sheet this script is attached to; if the script was created on its own, a sheet is created once and reused. */
function book_() {
  const active = SpreadsheetApp.getActive();
  if (active) return active;
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('SHEET_ID');
  if (id) return SpreadsheetApp.openById(id);
  const created = SpreadsheetApp.create('Cyber Escape Room Scores');
  props.setProperty('SHEET_ID', created.getId());
  return created;
}

function scoresSheet_() {
  const ss = book_();
  let sh = ss.getSheetByName(SCORES);
  if (!sh) {
    sh = ss.insertSheet(SCORES, 0);
    sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#16204A').setFontColor('#FFFFFF').setWrap(true);
    sh.setFrozenRows(1);
    sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 160); sh.setColumnWidth(3, 220); sh.setColumnWidth(4, 160);
  }
  return sh;
}

function summarySheet_() {
  const ss = book_();
  if (ss.getSheetByName(SUMMARY)) return;
  const sh = ss.insertSheet(SUMMARY);
  const col = n => String.fromCharCode(64 + n); // 1 -> A
  const c = name => col(HEADERS.indexOf(name) + 1);
  const rng = name => `'${TABS.full}'!${c(name)}2:${c(name)}`;
  const rows = [
    ['Measure', 'Value'],
    ['Players (unique emails)', `=IFERROR(COUNTUNIQUE(${rng('Email')}),0)`],
    ['Completed plays', `=COUNTA(${rng('Timestamp')})`],
    ['Average score', `=IFERROR(ROUND(AVERAGE(${rng('Score')}),0),"–")`],
    ['Highest score', `=IFERROR(MAX(${rng('Score')}),"–")`],
    ['Average time (mm:ss)', `=IFERROR(TEXT(AVERAGE(${rng('Time (seconds)')})/86400,"mm:ss"),"–")`],
    ['Average hints per play', `=IFERROR(ROUND(AVERAGE(${rng('Hints used')}),1),"–")`],
    ['', ''],
    ['Average wrong attempts per play, by topic', '']
  ].concat(ROOMS.map(r => [r[1].replace(' wrong', ''), `=IFERROR(ROUND(AVERAGE(${rng(r[1])}),2),"–")`]))
   .concat([['Lightning round correct (of 6)', `=IFERROR(ROUND(AVERAGE(${rng('Lightning round correct (of 6)')}),1),"–")`]]);
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange('A1:B1').setFontWeight('bold').setBackground('#16204A').setFontColor('#FFFFFF');
  sh.getRange('A9').setFontWeight('bold');
  sh.setColumnWidth(1, 320); sh.setColumnWidth(2, 120);
}

/** Called by the page when a player finishes. */
function saveRun(payload) {
  const p = payload || {};
  const name = clean_(p.name, 80);
  const email = clean_(p.email, 120).toLowerCase();
  const org = clean_(p.org, 80);
  if (name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw new Error('Name and a valid email are required.');
  const run = p.run || {};
  const rooms = run.rooms || {};
  const n = (v, max) => Math.max(0, Math.min(max, Math.round(Number(v) || 0)));
  const time = n(run.time, 86400);
  const vault = rooms.vault || {};
  const vaultCodeWrong = Math.max(0, n(vault.m, 99) - (n(vault.n, 6) - n(vault.clean, 6)));
  const clean = ['bd', 'it', 'hr', 'eng'].reduce((a, id) => a + n((rooms[id] || {}).clean, 3), 0);
  const row = [new Date(), name, email, org, n(run.score, 5000), n(run.base, 5000), n(run.bonus, 600),
    time, Utilities.formatString('%02d:%02d', Math.floor(time / 60), time % 60), n(run.mistakes, 999), n(run.hints, 99)]
    .concat(ROOMS.map(r => n((rooms[r[0]] || {}).m, 99)))
    .concat([n(vault.clean, 6), vaultCodeWrong, clean]);

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = scoresSheet_();
    sh.appendRow(row);
  } finally {
    lock.releaseLock();
  }
  const mine = playerRows_().filter(r => r.email === email);
  const best = Math.max.apply(null, mine.map(r => r.score));
  return { best: best, isBest: row[4] >= best, plays: mine.length };
}

/** Best score per email, top 100. Emails are never sent back to players. */
function getLeaderboard(myEmail) {
  const me = String(myEmail || '').trim().toLowerCase();
  const byEmail = {};
  playerRows_().forEach(r => {
    const b = byEmail[r.email];
    if (!b) { byEmail[r.email] = Object.assign({ plays: 1 }, r); return; }
    b.plays++;
    if (r.score > b.score || (r.score === b.score && r.time < b.time)) Object.assign(b, r, { plays: b.plays });
    b.name = r.name; // latest name the player entered
  });
  return Object.keys(byEmail).map(k => byEmail[k])
    .sort((a, b) => b.score - a.score || a.time - b.time)
    .slice(0, 100)
    .map((r, i) => ({ id: 'p' + i, name: r.name + (r.org ? ' · ' + r.org : ''), best: r.score, bestTime: r.time,
      mistakes: r.mistakes, hints: r.hints, attempts: r.plays, isMe: !!me && r.email === me }));
}

function playerRows_() {
  const sh = scoresSheet_();
  const last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, 11).getValues()
    .filter(v => v[2])
    .map(v => ({ name: String(v[1]), email: String(v[2]).toLowerCase(), org: String(v[3] || ''),
      score: Number(v[4]) || 0, time: Number(v[7]) || 0, mistakes: Number(v[9]) || 0, hints: Number(v[10]) || 0 }));
}

/** Trims, caps length, and stops text being read as a spreadsheet formula. */
function clean_(v, max) {
  let s = String(v == null ? '' : v).replace(/[\u0000-\u001F]/g, ' ').trim().slice(0, max);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
