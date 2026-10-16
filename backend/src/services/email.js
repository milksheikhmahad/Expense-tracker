const { EmailClient } = require('@azure/communication-email');
const config = require('../config');

let client;

function formatMoney(amount, currency) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount);
  } catch {
    return `${currency} ${Number(amount).toFixed(2)}`;
  }
}

function buildAlertEmail(alert) {
  const pct = Math.round((alert.spent / alert.budget) * 100);
  const over = alert.threshold >= 1;
  const spent = formatMoney(alert.spent, alert.currency);
  const budget = formatMoney(alert.budget, alert.currency);
  const subject = over
    ? `Budget exceeded: you've spent ${spent} of ${budget} this month`
    : `Heads up: ${pct}% of your monthly budget used`;
  const plainText = [
    `Hi ${alert.name},`,
    '',
    over
      ? `Your spending for ${alert.month} has crossed your monthly budget.`
      : `You've used ${pct}% of your budget for ${alert.month}.`,
    `Spent so far: ${spent}`,
    `Monthly budget: ${budget}`,
    `Triggered by: ${alert.trigger.description || alert.trigger.category} (${formatMoney(alert.trigger.amount, alert.currency)})`,
    '',
    '— Intelligent Expense Tracker',
  ].join('\n');
  const html = `
  <div style="font-family:Segoe UI,Arial,sans-serif;max-width:520px">
    <h2 style="color:${over ? '#b42318' : '#b54708'}">${over ? 'Monthly budget exceeded' : `${pct}% of budget used`}</h2>
    <p>Hi ${escapeHtml(alert.name)},</p>
    <p>${over ? `Your spending for <b>${alert.month}</b> has crossed your monthly budget.` : `You've used <b>${pct}%</b> of your budget for <b>${alert.month}</b>.`}</p>
    <table style="border-collapse:collapse">
      <tr><td style="padding:4px 12px 4px 0">Spent so far</td><td><b>${spent}</b></td></tr>
      <tr><td style="padding:4px 12px 4px 0">Monthly budget</td><td>${budget}</td></tr>
      <tr><td style="padding:4px 12px 4px 0">Triggered by</td><td>${escapeHtml(alert.trigger.description || alert.trigger.category)} (${formatMoney(alert.trigger.amount, alert.currency)})</td></tr>
    </table>
    <p style="color:#667085;font-size:12px">Sent by the Intelligent Expense Tracker via Azure Communication Services.</p>
  </div>`;
  return { subject, plainText, html };
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function sendAlertEmail(alert) {
  const { subject, plainText, html } = buildAlertEmail(alert);
  if (!config.acsConnectionString || !config.emailSender) {
    console.log(`[email:dry-run] to=${alert.email} subject="${subject}"\n${plainText}`);
    return { dryRun: true };
  }
  client = client || new EmailClient(config.acsConnectionString);
  const poller = await client.beginSend({
    senderAddress: config.emailSender,
    content: { subject, plainText, html },
    recipients: { to: [{ address: alert.email, displayName: alert.name }] },
  });
  const result = await poller.pollUntilDone();
  if (result.status !== 'Succeeded') {
    throw new Error(`ACS email send failed: ${result.status} ${JSON.stringify(result.error || {})}`);
  }
  return { id: result.id };
}

module.exports = { sendAlertEmail, buildAlertEmail };
