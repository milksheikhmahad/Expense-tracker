// Shared by the worker (cloud) and the inline fallback (local dev).
const { pool } = require('../db');
const { sendAlertEmail } = require('./email');

async function handleAlertEvent(event) {
  const { rows: [user] } = await pool.query('SELECT name, email, currency FROM users WHERE id = $1', [event.userId]);
  if (!user) return;
  await sendAlertEmail({ ...event, name: user.name, email: user.email, currency: user.currency });
  await pool.query(
    `UPDATE budget_alerts SET status = 'sent', sent_at = now()
      WHERE user_id = $1 AND month = $2 AND threshold = $3`,
    [event.userId, event.month, event.threshold],
  );
  console.log(`[alerts] sent ${event.threshold * 100}% alert to user ${event.userId} for ${event.month}`);
}

module.exports = { handleAlertEvent };
