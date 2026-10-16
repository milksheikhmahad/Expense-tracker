// Budget-alert event publisher.
// Cloud: API publishes an event to an Azure Service Bus queue; the separate
// worker container (scaled from zero by KEDA) consumes it and sends the email.
// Local without Service Bus: the event is handled in-process instead.

const { ServiceBusClient } = require('@azure/service-bus');
const config = require('../config');
const { pool } = require('../db');
const { crossedThresholds, monthKey } = require('./budget');

let sender;

function getSender() {
  if (!config.serviceBusConnectionString) return null;
  if (!sender) {
    const client = new ServiceBusClient(config.serviceBusConnectionString);
    sender = client.createSender(config.alertsQueue);
  }
  return sender;
}

async function publishAlertEvent(event) {
  const s = getSender();
  if (s) {
    await s.sendMessages({
      body: event,
      contentType: 'application/json',
      subject: 'budget.threshold.crossed',
      messageId: `${event.userId}-${event.month}-${event.threshold}`,
    });
    return 'servicebus';
  }
  // Local fallback: process inline so the feature is still demoable.
  const { handleAlertEvent } = require('./alertHandler');
  setImmediate(() => handleAlertEvent(event).catch((e) => console.error('[alerts] inline handler failed', e)));
  return 'inline';
}

/**
 * Called after an expense is inserted. Compares the month total before and
 * after this expense against the user's budget and publishes one event per
 * newly-crossed threshold (80% warning, 100% exceeded).
 */
async function checkBudgetAfterExpense(userId, expense) {
  const month = monthKey(expense.spent_on);
  const { rows: [user] } = await pool.query('SELECT monthly_budget FROM users WHERE id = $1', [userId]);
  const budget = Number(user.monthly_budget);

  const { rows: [{ total }] } = await pool.query(
    `SELECT COALESCE(SUM(amount),0) AS total FROM expenses
      WHERE user_id = $1 AND to_char(spent_on, 'YYYY-MM') = $2`,
    [userId, month],
  );
  const newTotal = Number(total);
  const previousTotal = newTotal - Number(expense.amount);
  const crossed = crossedThresholds(previousTotal, newTotal, budget, config.alertThresholds);

  const fired = [];
  for (const threshold of crossed) {
    // ON CONFLICT DO NOTHING = fire each threshold only once per month.
    const { rowCount } = await pool.query(
      `INSERT INTO budget_alerts (user_id, month, threshold, spent, budget)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (user_id, month, threshold) DO NOTHING`,
      [userId, month, threshold, newTotal, budget],
    );
    if (!rowCount) continue;
    const via = await publishAlertEvent({
      userId,
      month,
      threshold,
      spent: newTotal,
      budget,
      trigger: { expenseId: expense.id, amount: Number(expense.amount), category: expense.category, description: expense.description },
      publishedAt: new Date().toISOString(),
    });
    fired.push({ threshold, via });
  }
  return { month, spent: newTotal, budget, fired };
}

module.exports = { checkBudgetAfterExpense, publishAlertEvent };
