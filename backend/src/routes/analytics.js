const express = require('express');
const { pool } = require('../db');
const { aiInsights } = require('../services/insights');

const router = express.Router();

const TZ = process.env.APP_TIMEZONE || 'Asia/Kolkata';
const localToday = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ }); // YYYY-MM-DD

function currentMonth() {
  return localToday().slice(0, 7);
}

function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return d.toISOString().slice(0, 7);
}

async function buildSummary(userId, month) {
  const prev = shiftMonth(month, -1);
  const [{ rows: [user] }, { rows: cat }, { rows: prevCat }, { rows: daily }] = await Promise.all([
    pool.query('SELECT monthly_budget, currency FROM users WHERE id = $1', [userId]),
    pool.query(
      `SELECT category, SUM(amount)::float AS total, COUNT(*)::int AS count FROM expenses
        WHERE user_id = $1 AND to_char(spent_on,'YYYY-MM') = $2 GROUP BY category ORDER BY total DESC`,
      [userId, month]),
    pool.query(
      `SELECT category, SUM(amount)::float AS total FROM expenses
        WHERE user_id = $1 AND to_char(spent_on,'YYYY-MM') = $2 GROUP BY category`,
      [userId, prev]),
    pool.query(
      `SELECT to_char(spent_on,'YYYY-MM-DD') AS day, SUM(amount)::float AS total FROM expenses
        WHERE user_id = $1 AND to_char(spent_on,'YYYY-MM') = $2 GROUP BY day ORDER BY day`,
      [userId, month]),
  ]);
  const [y, m] = month.split('-').map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const isCurrent = month === currentMonth();
  const total = cat.reduce((s, c) => s + c.total, 0);
  return {
    month,
    currency: user.currency,
    budget: Number(user.monthly_budget),
    daysInMonth,
    dayOfMonth: isCurrent ? Number(localToday().slice(8, 10)) : daysInMonth,
    currentMonth: { total, count: cat.reduce((s, c) => s + c.count, 0) },
    byCategory: cat,
    daily,
    previousMonth: {
      month: prev,
      total: prevCat.reduce((s, c) => s + c.total, 0),
      byCategory: Object.fromEntries(prevCat.map((c) => [c.category, c.total])),
    },
  };
}

router.get('/summary', async (req, res, next) => {
  try {
    const month = /^\d{4}-\d{2}$/.test(req.query.month || '') ? req.query.month : currentMonth();
    res.json(await buildSummary(req.userId, month));
  } catch (e) { next(e); }
});

router.get('/trend', async (req, res, next) => {
  try {
    const months = Math.min(Math.max(parseInt(req.query.months || '6', 10), 1), 24);
    const end = currentMonth();
    const start = shiftMonth(end, -(months - 1));
    const { rows } = await pool.query(
      `SELECT to_char(spent_on,'YYYY-MM') AS month, category, SUM(amount)::float AS total FROM expenses
        WHERE user_id = $1 AND to_char(spent_on,'YYYY-MM') BETWEEN $2 AND $3
        GROUP BY month, category`,
      [req.userId, start, end]);
    const { rows: [user] } = await pool.query('SELECT monthly_budget FROM users WHERE id = $1', [req.userId]);
    const series = [];
    for (let i = 0; i < months; i += 1) {
      const mk = shiftMonth(start, i);
      const items = rows.filter((r) => r.month === mk);
      series.push({
        month: mk,
        total: items.reduce((s, r) => s + r.total, 0),
        budget: Number(user.monthly_budget),
        byCategory: Object.fromEntries(items.map((r) => [r.category, r.total])),
      });
    }
    res.json(series);
  } catch (e) { next(e); }
});

router.get('/insights', async (req, res, next) => {
  try {
    const summary = await buildSummary(req.userId, currentMonth());
    // Only aggregated numbers leave the database — no names, emails or descriptions.
    const payload = {
      month: summary.month,
      budget: summary.budget,
      daysInMonth: summary.daysInMonth,
      dayOfMonth: summary.dayOfMonth,
      currentMonth: summary.currentMonth,
      byCategory: summary.byCategory,
      previousMonth: summary.previousMonth,
    };
    res.json(await aiInsights(payload));
  } catch (e) { next(e); }
});

module.exports = router;
