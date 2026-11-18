/**
 * Acme Interiors — form submissions backend (Google Apps Script).
 *
 * Saves each website form to its own tab in a private Google Sheet:
 *   "Enquiries"    ← contact form on the home page
 *   "Applications" ← job application form on careers.html (CVs are saved to a Drive folder)
 * The admin page (admin.html) lists and deletes submissions with the ADMIN_KEY.
 *
 * Setup (full steps in README.md → "Form submissions"):
 *   1. Create a Google Sheet → Extensions → Apps Script → paste this file.
 *   2. Project Settings → Script properties → add ADMIN_KEY (a long random string).
 *      Optional: NOTIFY_EMAIL (get an email for every submission), CV_FOLDER_ID (Drive folder for CVs).
 *   3. Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone → copy the /exec URL
 *      into js/config.js (formsEndpoint) and into Admin → Settings.
 *   After editing this file later: Deploy → Manage deployments → Edit → Version: New version.
 */

const FORMS = {
  enquiries: {
    sheet: 'Enquiries',
    fields: ['id', 'submitted', 'name', 'company', 'email', 'area', 'message', 'page'],
  },
  applications: {
    sheet: 'Applications',
    fields: ['id', 'submitted', 'name', 'email', 'phone', 'role', 'portfolio', 'message', 'cv_name', 'cv_url', 'page'],
  },
};
const MAX_FIELD = 5000;               // characters per cell
const MAX_CV_BYTES = 5 * 1024 * 1024; // 5 MB
const CV_TYPES = ['application/pdf', 'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

function doPost(e) {
  let body;
  try { body = JSON.parse((e.postData && e.postData.contents) || '{}'); }
  catch (err) { return json({ ok: false, error: 'Invalid request' }); }

  // ---- admin actions (need the key) ----
  if (body.action) {
    if (!checkKey(body.key)) return json({ ok: false, error: 'Wrong admin key' });
    if (body.action === 'ping') return json({ ok: true });
    if (body.action === 'list') return json({ ok: true, rows: listRows(body.form) });
    if (body.action === 'delete') return json({ ok: deleteRow(body.form, body.id) });
    return json({ ok: false, error: 'Unknown action' });
  }

  // ---- public submissions ----
  const form = FORMS[body.form];
  if (!form) return json({ ok: false, error: 'Unknown form' });
  const data = body.data || {};
  if (data.website) return json({ ok: true }); // honeypot: bots fill the hidden field, people don't
  if (!data.name || !data.email) return json({ ok: false, error: 'Name and email are required' });

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const row = Object.assign({}, data, {
      id: Utilities.getUuid(),
      submitted: new Date().toISOString(),
      page: body.page || '',
    });

    if (body.form === 'applications' && body.file && body.file.data) {
      const bytes = Utilities.base64Decode(body.file.data);
      if (bytes.length > MAX_CV_BYTES) return json({ ok: false, error: 'File too large' });
      const type = CV_TYPES.indexOf(body.file.type) >= 0 ? body.file.type : 'application/octet-stream';
      const safeName = String(body.file.name || 'cv').replace(/[^\w.\- ]+/g, '_').slice(0, 120);
      const file = cvFolder().createFile(Utilities.newBlob(bytes, type, `${row.submitted.slice(0, 10)} ${data.name} - ${safeName}`));
      row.cv_name = safeName;
      row.cv_url = file.getUrl();
    }

    sheetFor(form).appendRow(form.fields.map(f => clean(row[f])));
    notify(form.sheet, row);
    return json({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return json({ ok: true, service: 'acme-forms' });
}

// ---------- helpers ----------
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function checkKey(key) {
  const real = PropertiesService.getScriptProperties().getProperty('ADMIN_KEY');
  return !!real && real.length >= 12 && key === real;
}

function sheetFor(form) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(form.sheet);
  if (!sh) {
    sh = ss.insertSheet(form.sheet);
    sh.appendRow(form.fields);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, form.fields.length).setFontWeight('bold');
  }
  return sh;
}

function listRows(formKey) {
  const form = FORMS[formKey];
  if (!form) return [];
  const sh = sheetFor(form);
  const values = sh.getDataRange().getValues();
  const head = values.shift();
  return values.map(r => Object.fromEntries(head.map((h, i) => [h, r[i] instanceof Date ? r[i].toISOString() : r[i]])))
    .reverse(); // newest first
}

function deleteRow(formKey, id) {
  const form = FORMS[formKey];
  if (!form || !id) return false;
  const sh = sheetFor(form);
  const ids = sh.getRange(1, 1, sh.getLastRow(), 1).getValues();
  for (let i = ids.length - 1; i >= 1; i--) {
    if (ids[i][0] === id) { sh.deleteRow(i + 1); return true; }
  }
  return false;
}

function cvFolder() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('CV_FOLDER_ID');
  if (id) return DriveApp.getFolderById(id);
  const folder = DriveApp.createFolder('Acme Interiors — CVs');
  props.setProperty('CV_FOLDER_ID', folder.getId());
  return folder;
}

// Plain text only, trimmed, and never starting with = + - @ so a sheet can't run it as a formula.
function clean(v) {
  let s = v == null ? '' : String(v).trim().slice(0, MAX_FIELD);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function notify(sheetName, row) {
  const to = PropertiesService.getScriptProperties().getProperty('NOTIFY_EMAIL');
  if (!to) return;
  const lines = Object.keys(row).filter(k => k !== 'id' && row[k]).map(k => `${k}: ${row[k]}`);
  MailApp.sendEmail(to, `New website ${sheetName.toLowerCase().replace(/s$/, '')}: ${row.name}`, lines.join('\n'));
}
