// Optional standalone budget-alert worker (same consumer the API runs
// in-process). Useful on a standard Container Apps environment if you want
// a separate KEDA-scaled worker; not used by the default Terraform setup.
require('./telemetry');
const config = require('./config');
const { startAlertConsumer } = require('./services/alertConsumer');

if (!config.serviceBusConnectionString) {
  console.error('[worker] SERVICEBUS_CONNECTION_STRING is not set');
  process.exit(1);
}

const stop = startAlertConsumer();

async function shutdown() {
  console.log('[worker] shutting down');
  await stop();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
