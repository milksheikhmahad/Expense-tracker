const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('./config');
const { pool } = require('./db');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sign(user) {
  return jwt.sign({ sub: user.id, email: user.email }, config.jwtSecret, { expiresIn: '7d' });
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, monthlyBudget: Number(u.monthly_budget), currency: u.currency };
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, monthlyBudget } = req.body || {};
    if (!name || !EMAIL_RE.test(email || '') || !password || password.length < 8) {
      return res.status(400).json({ error: 'Name, a valid email and a password of at least 8 characters are required.' });
    }
    const hash = await bcrypt.hash(password, 10);
    const budget = Number(monthlyBudget) > 0 ? Number(monthlyBudget) : 10000;
    const { rows: [user] } = await pool.query(
      `INSERT INTO users (name, email, password_hash, monthly_budget) VALUES ($1, lower($2), $3, $4)
       ON CONFLICT (email) DO NOTHING RETURNING *`,
      [name.trim(), email.trim(), hash, budget],
    );
    if (!user) return res.status(409).json({ error: 'An account with this email already exists.' });
    res.status(201).json({ token: sign(user), user: publicUser(user) });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    const { rows: [user] } = await pool.query('SELECT * FROM users WHERE email = lower($1)', [String(email || '').trim()]);
    if (!user || !(await bcrypt.compare(String(password || ''), user.password_hash))) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    res.json({ token: sign(user), user: publicUser(user) });
  } catch (e) { next(e); }
});

function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Not signed in.' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.userId = payload.sub;
    next();
  } catch {
    res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }
}

module.exports = { router, requireAuth, publicUser };
