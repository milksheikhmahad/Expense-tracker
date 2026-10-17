require('./telemetry');
const config = require('./config');
const { migrate } = require('./db');
const { createApp } = require('./app');
const { startAlertConsumer } = require('./services/alertConsumer');

async function main() {
  // Retry briefly: in docker-compose / first cloud boot the DB may lag.
  for (let attempt = 1; ; attempt += 1) {
    try {
      await migrate();
      break;
    } catch (e) {
      if (attempt >= 10) throw e;
      console.warn(`[api] database not ready (${e.message}); retrying in 3s`);
      await new Promise((r) => setTimeout(r, 3000));
    }
  }
  const server = createApp().listen(config.port, () => console.log(`[api] listening on :${config.port}`));

  // Budget-alert events: API publishes to Service Bus, and this consumer
  // (same container) picks them up and sends the email.
  const stopConsumer = process.env.RUN_ALERT_CONSUMER === 'false' ? null : startAlertConsumer();

  const shutdown = async () => {
    console.log('[api] shutting down');
    server.close();
    if (stopConsumer) await stopConsumer().catch(() => {});
    process.exit(0);
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((e) => {
  console.error('[api] fatal', e);
  process.exit(1);
});
