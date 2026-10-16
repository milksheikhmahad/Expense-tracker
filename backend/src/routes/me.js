const express = require('express');
const { pool } = require('../db');
const { publicUser } = require('../auth');

const router = express.Router();

router.get('/', async (req, res, next) => {
  try {
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE id = $1', [req.userId]);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(publicUser(user));
  } catch (e) { next(e); }
});

router.put('/', async (req, res, next) => {
  try {
    const { name, monthlyBudget } = req.body || {};
    const budget = Number(monthlyBudget);
    if (monthlyBudget !== undefined && !(budget > 0)) {
      return res.status(400).json({ error: 'Monthly budget must be a positive number.' });
    }
    const { rows: [user] } = await pool.query(
      `UPDATE users SET name = COALESCE($2, name), monthly_budget = COALESCE($3, monthly_budget)
        WHERE id = $1 RETURNING *`,
      [req.userId, name ? String(name).trim() : null, monthlyBudget !== undefined ? budget : null],
    );
    res.json(publicUser(user));
  } catch (e) { next(e); }
});

router.get('/alerts', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT month, threshold::float, spent::float, budget::float, status, created_at, sent_at
         FROM budget_alerts WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.userId],
    );
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
