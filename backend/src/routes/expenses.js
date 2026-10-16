const express = require('express');
const multer = require('multer');
const { pool } = require('../db');
const { categorize, CATEGORIES } = require('../services/categorizer');
const { checkBudgetAfterExpense } = require('../services/alerts');
const storage = require('../services/storage');
const ocr = require('../services/receiptOcr');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => cb(null, /^(image\/(jpeg|png|webp|heic|bmp|tiff)|application\/pdf)$/.test(file.mimetype)),
});

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDto(r) {
  return {
    id: r.id,
    amount: Number(r.amount),
    category: r.category,
    description: r.description,
    merchant: r.merchant,
    spentOn: r.spent_on instanceof Date ? r.spent_on.toISOString().slice(0, 10) : r.spent_on,
    hasReceipt: Boolean(r.receipt_blob),
    source: r.source,
    createdAt: r.created_at,
  };
}

router.get('/categories', (req, res) => res.json(CATEGORIES));

router.get('/', async (req, res, next) => {
  try {
    const { month, category } = req.query;
    const params = [req.userId];
    let where = 'user_id = $1';
    if (month && /^\d{4}-\d{2}$/.test(month)) { params.push(month); where += ` AND to_char(spent_on,'YYYY-MM') = $${params.length}`; }
    if (category && CATEGORIES.includes(category)) { params.push(category); where += ` AND category = $${params.length}`; }
    const { rows } = await pool.query(
      `SELECT * FROM expenses WHERE ${where} ORDER BY spent_on DESC, id DESC LIMIT 500`, params,
    );
    res.json(rows.map(toDto));
  } catch (e) { next(e); }
});

// Upload a receipt → stored in Blob Storage → (optionally) read by Document
// Intelligence. Returns a draft the user confirms before saving.
router.post('/receipt', upload.single('receipt'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Attach an image or PDF under 5 MB.' });
    const blobName = await storage.uploadReceipt(req.userId, req.file);
    let parsed = null;
    let ocrError = null;
    try { parsed = await ocr.analyzeReceipt(req.file.buffer); } catch (e) { ocrError = e.message; }
    const merchant = parsed?.merchant || '';
    res.status(201).json({
      receiptBlob: blobName,
      storage: blobName ? 'azure-blob' : 'disabled',
      ocr: ocr.enabled() ? (parsed ? 'ok' : 'failed') : 'disabled',
      ocrError,
      draft: {
        amount: parsed?.total ?? null,
        merchant,
        spentOn: parsed?.date || new Date().toLocaleDateString('en-CA', { timeZone: process.env.APP_TIMEZONE || 'Asia/Kolkata' }),
        description: merchant ? `Receipt – ${merchant}` : 'Receipt',
        category: categorize(merchant, ...(parsed?.items || [])),
      },
    });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { amount, description = '', merchant = '', spentOn, category, receiptBlob } = req.body || {};
    const value = Number(amount);
    if (!(value > 0) || value > 10_000_000) return res.status(400).json({ error: 'Amount must be a positive number.' });
    if (spentOn && !DATE_RE.test(spentOn)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
    if (receiptBlob && !String(receiptBlob).startsWith(`${req.userId}/`)) return res.status(400).json({ error: 'Invalid receipt reference.' });
    const finalCategory = CATEGORIES.includes(category) ? category : categorize(description, merchant);
    const { rows: [row] } = await pool.query(
      `INSERT INTO expenses (user_id, amount, category, description, merchant, spent_on, receipt_blob, source)
       VALUES ($1,$2,$3,$4,$5,COALESCE($6::date, CURRENT_DATE),$7,$8) RETURNING *`,
      [req.userId, value, finalCategory, String(description).slice(0, 200), String(merchant).slice(0, 120),
        spentOn || null, receiptBlob || null, receiptBlob ? 'receipt' : 'manual'],
    );
    const budget = await checkBudgetAfterExpense(req.userId, row);
    res.status(201).json({ expense: toDto(row), budget });
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const { amount, description, merchant, spentOn, category } = req.body || {};
    if (amount !== undefined && !(Number(amount) > 0)) return res.status(400).json({ error: 'Amount must be positive.' });
    if (spentOn && !DATE_RE.test(spentOn)) return res.status(400).json({ error: 'Date must be YYYY-MM-DD.' });
    if (category && !CATEGORIES.includes(category)) return res.status(400).json({ error: 'Unknown category.' });
    const { rows: [row] } = await pool.query(
      `UPDATE expenses SET amount = COALESCE($3, amount), description = COALESCE($4, description),
              merchant = COALESCE($5, merchant), spent_on = COALESCE($6::date, spent_on), category = COALESCE($7, category)
        WHERE id = $1 AND user_id = $2 RETURNING *`,
      [req.params.id, req.userId, amount !== undefined ? Number(amount) : null, description ?? null, merchant ?? null, spentOn || null, category || null],
    );
    if (!row) return res.status(404).json({ error: 'Expense not found.' });
    res.json(toDto(row));
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const { rows: [row] } = await pool.query('DELETE FROM expenses WHERE id = $1 AND user_id = $2 RETURNING receipt_blob', [req.params.id, req.userId]);
    if (!row) return res.status(404).json({ error: 'Expense not found.' });
    await storage.deleteReceipt(row.receipt_blob).catch(() => {});
    res.status(204).end();
  } catch (e) { next(e); }
});

router.get('/:id/receipt', async (req, res, next) => {
  try {
    const { rows: [row] } = await pool.query('SELECT receipt_blob FROM expenses WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    if (!row?.receipt_blob) return res.status(404).json({ error: 'No receipt for this expense.' });
    res.json({ url: await storage.receiptUrl(row.receipt_blob) });
  } catch (e) { next(e); }
});

module.exports = router;
