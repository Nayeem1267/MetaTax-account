const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const ExcelJS = require('exceljs');
const nodemailer = require('nodemailer');

const app = express();

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const DOCUMENTS_FILE = path.join(DATA_DIR, 'documents.json');
const LOGIN_USERNAME = process.env.METATAX_USERNAME || 'Asmirameta';
const LOGIN_PASSWORD = process.env.METATAX_PASSWORD || 'Meta@0310';
const OTP_PHONE = process.env.METATAX_OTP_PHONE || '+917029901424';
const OTP_EMAIL = process.env.METATAX_OTP_EMAIL || 'MetaCashAudit@outlook.com';
const sessions = new Map();
const itrChallenges = new Map();
const mailTransport = process.env.SMTP_USER && process.env.SMTP_PASSWORD
  ? nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp-mail.outlook.com', port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', requireTLS: true, connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 10000, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } })
  : null;
const allowedMimeTypes = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/csv'
]);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
if (!fs.existsSync(DOCUMENTS_FILE)) fs.writeFileSync(DOCUMENTS_FILE, '[]');

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => callback(null, UPLOAD_DIR),
  filename: (_req, file, callback) => {
    const safeName = file.originalname.replace(/[^a-z0-9.-]/gi, '-');
    callback(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    callback(null, allowedMimeTypes.has(file.mimetype));
  }
});

const readDocuments = () => JSON.parse(fs.readFileSync(DOCUMENTS_FILE, 'utf8'));
const writeDocuments = (documents) => fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(documents, null, 2));
const templateColumns = ['Bill Type', 'Company', 'Invoice Number', 'Invoice Date', 'Supplier / Customer Name', 'Supplier / Customer TIN', 'Supplier / Customer BRN', 'Description', 'Amount (RM)', 'Tax Rate (%)', 'Tax (RM)', 'Total (RM)', 'Payment Date', 'Notes'];
const templateRows = [
  { 'Bill Type': 'Purchase', Company: 'Meta Platforms', 'Invoice Number': 'PUR-001', 'Invoice Date': '2026-08-21', 'Supplier / Customer Name': 'Supplier name', 'Supplier / Customer TIN': 'Enter TIN', 'Supplier / Customer BRN': 'Enter BRN', Description: 'Office supplies', 'Amount (RM)': 100, 'Tax Rate (%)': 0, 'Tax (RM)': 0, 'Total (RM)': 100, 'Payment Date': '2026-08-21', Notes: 'Example row - replace or remove' },
  { 'Bill Type': 'Sales', Company: 'Meta Platforms', 'Invoice Number': 'SAL-001', 'Invoice Date': '2026-08-21', 'Supplier / Customer Name': 'Customer name', 'Supplier / Customer TIN': 'Enter TIN', 'Supplier / Customer BRN': 'Enter BRN', Description: 'Service provided', 'Amount (RM)': 100, 'Tax Rate (%)': 0, 'Tax (RM)': 0, 'Total (RM)': 100, 'Payment Date': '2026-08-21', Notes: 'Example row - replace or remove' }
];
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));

const configureBillSheet = (sheet, billType) => {
  sheet.columns = templateColumns.map((header) => ({ header, key: header, width: header.includes('TIN') || header.includes('BRN') ? 23 : 20 }));
  sheet.addRow(templateRows.find((row) => row['Bill Type'] === billType));
  sheet.addRow({ 'Bill Type': billType, Company: 'Meta Platforms' });
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2D6156' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  sheet.getRow(1).height = 30;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + templateColumns.length)}1` };
  for (let row = 2; row <= 101; row += 1) {
    sheet.getCell(`J${row}`).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 100], allowBlank: true };
    sheet.getCell(`K${row}`).value = { formula: `IF(OR(I${row}="",J${row}=""),"",I${row}*J${row}/100)`, result: row === 2 ? 0 : undefined };
    sheet.getCell(`L${row}`).value = { formula: `IF(I${row}="","",I${row}+K${row})`, result: row === 2 ? 100 : undefined };
    sheet.getCell(`I${row}`).numFmt = '"RM" #,##0.00';
    sheet.getCell(`K${row}`).numFmt = '"RM" #,##0.00';
    sheet.getCell(`L${row}`).numFmt = '"RM" #,##0.00';
  }
};

app.get('/templates/bills.xlsx', async (_req, res) => {
  const workbook = new ExcelJS.Workbook();
  workbook.calcProperties = { calcMode: 'auto', fullCalcOnLoad: true, forceFullCalc: true };
  const instructions = workbook.addWorksheet('Start Here');
  instructions.getColumn(1).width = 28;
  instructions.getColumn(2).width = 100;
  instructions.addRow(['MetaTax Account bill template', 'Use the Purchase Bills or Sales Bills tab to type your records.']);
  instructions.addRow(['Currency', 'All amounts are in Malaysian Ringgit (RM).']);
  instructions.addRow(['Bill Type', 'Use Purchase for supplier bills and Sales for customer invoices.']);
  instructions.addRow(['Tax calculation', 'Enter Amount (RM) and Tax Rate (%). Tax and Total calculate automatically.']);
  instructions.addRow(['Malaysian details', 'Supplier/customer TIN and BRN fields are included for your tax and e-Invoice records. Confirm the required details with your accountant.']);
  instructions.getColumn(1).eachCell((cell) => { cell.font = { bold: true, color: { argb: '2D6156' } }; });
  configureBillSheet(workbook.addWorksheet('Purchase Bills'), 'Purchase');
  configureBillSheet(workbook.addWorksheet('Sales Bills'), 'Sales');
  workbook.views = [{ activeTab: 1 }];
  const file = await workbook.xlsx.writeBuffer();
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Disposition', 'attachment; filename="metatax-bills-template.xlsx"');
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(file);
});

app.get('/templates/bills/preview', (_req, res) => {
  const headers = templateColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
  const rows = templateRows.map((row) => `<tr>${templateColumns.map((column) => `<td>${escapeHtml(row[column])}</td>`).join('')}</tr>`).join('');
  res.type('html').send(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>MetaTax bill template</title><style>body{margin:0;background:#f2f3ef;color:#202b2c;font:14px Arial,sans-serif;padding:32px}main{max-width:1200px;margin:auto;background:#fbfaf7;border:1px solid #e2e4de;border-radius:8px;padding:28px}h1{margin:0 0 8px;color:#2d6156}p{color:#687973}.actions{display:flex;gap:10px;margin:22px 0}.actions a{background:#2d6156;color:#fff;padding:10px 14px;border-radius:5px;text-decoration:none;font-weight:bold;font-size:12px}.table-wrap{overflow:auto;border:1px solid #dce2da}table{border-collapse:collapse;width:100%;min-width:1300px}th{background:#2d6156;color:#fff;text-align:left;padding:11px;font-size:11px;white-space:nowrap}td{border-bottom:1px solid #e2e4de;padding:11px;font-size:11px;white-space:nowrap}tr:nth-child(even){background:#f0f6ef}.note{font-size:11px}</style></head><body><main><h1>Malaysian Bill Template</h1><p>Use this format for Purchase and Sales bills. Amounts, tax, and totals are in RM. TIN and BRN fields are included for Malaysian tax and e-Invoice records.</p><div class="actions"><a href="/templates/bills.xlsx?v=4">Download Excel 2016 file</a><a href="/templates/bills.csv?v=4">Download CSV spreadsheet</a></div><div class="table-wrap"><table><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table></div><p class="note">For typing and automatic calculations, download the Excel file and open it in Microsoft Excel 2016.</p></main></body></html>`);
});

app.get('/templates/bills.csv', (_req, res) => {
  const csvCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const csvRows = [templateColumns, templateColumns.map(() => ''), templateColumns.map(() => '')];
  csvRows[1][0] = 'Purchase';
  csvRows[1][1] = 'Meta Platforms';
  csvRows[2][0] = 'Sales';
  csvRows[2][1] = 'Meta Platforms';
  const csv = csvRows
    .map((row) => row.map(csvCell).join(','))
    .join('\n');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Content-Disposition', 'attachment; filename="metatax-bills-template.csv"');
  res.type('text/csv').send(`\ufeff${csv}`);
});

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/login', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/', (req, res) => {
  const token = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('metatax_session='))?.split('=')[1];
  if (!token || !sessions.has(token)) return res.redirect(302, '/login');
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username !== LOGIN_USERNAME || password !== LOGIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, { username: LOGIN_USERNAME, createdAt: Date.now() });
  res.setHeader('Set-Cookie', `metatax_session=${token}; HttpOnly; SameSite=Lax; Max-Age=${8 * 60 * 60}; Path=/`);
  res.json({ username: LOGIN_USERNAME });
});

app.get('/api/session', (req, res) => {
  const session = sessions.get(req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('metatax_session='))?.split('=')[1]);
  if (!session) return res.status(401).json({ authenticated: false });
  res.json({ authenticated: true, username: session.username });
});

app.post('/api/logout', (req, res) => {
  const token = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('metatax_session='))?.split('=')[1];
  if (token) sessions.delete(token);
  res.setHeader('Set-Cookie', 'metatax_session=; HttpOnly; SameSite=Lax; Max-Age=0; Path=/');
  res.status(204).end();
});

const requireAuth = (req, res, next) => {
  const token = req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('metatax_session='))?.split('=')[1];
  if (!token || !sessions.has(token)) return res.status(401).json({ error: 'Please log in to continue.' });
  next();
};

const getSessionToken = (req) => req.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('metatax_session='))?.split('=')[1];
const maskPhone = (phone) => `${phone.slice(0, 3)} ******${phone.slice(-4)}`;

app.post('/api/itr/request-otp', requireAuth, async (req, res) => {
  const challengeId = crypto.randomBytes(16).toString('hex');
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  itrChallenges.set(challengeId, { otp, sessionToken: getSessionToken(req), expiresAt: Date.now() + 5 * 60 * 1000 });
  if (mailTransport) {
    try {
      await mailTransport.sendMail({ from: process.env.SMTP_USER, to: OTP_EMAIL, subject: 'MetaTax ITR verification code', text: `Your MetaTax ITR verification OTP is ${otp}. It expires in 5 minutes.` });
    } catch (_error) {
      itrChallenges.delete(challengeId);
      return res.status(502).json({ error: 'Email delivery failed. Check SMTP settings and try again.' });
    }
  }
  res.json({ challengeId, email: OTP_EMAIL, expiresIn: 300, delivery: mailTransport ? 'email' : 'demo', demoOtp: mailTransport ? undefined : otp });
});

app.post('/api/itr/verify-otp', requireAuth, (req, res) => {
  const challenge = itrChallenges.get(req.body.challengeId);
  if (!challenge || challenge.sessionToken !== getSessionToken(req) || challenge.expiresAt < Date.now()) return res.status(400).json({ error: 'This OTP has expired. Request a new code.' });
  if (req.body.otp !== challenge.otp) return res.status(401).json({ error: 'Incorrect OTP. Please check the code and try again.' });
  itrChallenges.delete(req.body.challengeId);
  res.json({ success: true, message: 'ITR uploaded successfully.' });
});

app.get('/api/documents', requireAuth, (req, res) => {
  const documents = readDocuments().sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));
  res.json(documents);
});

app.post('/api/documents', requireAuth, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Please upload a supported file.' });
  const amount = req.body.amount === '' || req.body.amount === undefined ? 0 : Number(req.body.amount);
  if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'Amount must be a valid positive number.' });

  const document = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: req.file.originalname,
    storedName: req.file.filename,
    size: req.file.size,
    category: req.body.category || 'Other',
    company: req.body.company || 'Unassigned company',
    financialYear: req.body.financialYear || 'FY 2026-27',
    amount,
    currency: 'MYR',
    notes: req.body.notes || '',
    status: 'Uploaded',
    uploadedAt: new Date().toISOString()
  };

  const documents = readDocuments();
  documents.push(document);
  writeDocuments(documents);
  res.status(201).json(document);
});

app.delete('/api/documents/:id', requireAuth, (req, res) => {
  const documents = readDocuments();
  const document = documents.find((item) => item.id === req.params.id);
  if (!document) return res.status(404).json({ error: 'Document not found.' });

  const filePath = path.join(UPLOAD_DIR, document.storedName);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  writeDocuments(documents.filter((item) => item.id !== req.params.id));
  res.status(204).end();
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError || error.message) {
    return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? 'Files must be smaller than 15 MB.' : 'That file type is not supported.' });
  }
  res.status(500).json({ error: 'Something went wrong.' });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
