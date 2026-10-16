const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const { pool } = require('./db');
const auth = require('./auth');

function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: config.corsOrigins, credentials: false }));
  app.use(express.json({ limit: '100kb' }));

  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok', db: 'ok', time: new Date().toISOString() });
    } catch (e) {
      res.status(503).json({ status: 'degraded', db: e.message });
    }
  });

  app.use('/api/auth', auth.router);
  app.use('/api/me', auth.requireAuth, require('./routes/me'));
  app.use('/api/expenses', auth.requireAuth, require('./routes/expenses'));
  app.use('/api/analytics', auth.requireAuth, require('./routes/analytics'));

  app.use((req, res) => res.status(404).json({ error: 'Not found' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[api] error', err);
    if (err.code === '22P02') return res.status(400).json({ error: 'Invalid id.' });
    if (err.name === 'MulterError') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Something went wrong on our side.' });
  });
  return app;
}

module.exports = { createApp };
