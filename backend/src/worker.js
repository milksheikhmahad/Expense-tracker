// Budget-alert worker. Runs as its own Azure Container App that scales from
// 0 → 1 when messages land in the Service Bus queue (KEDA), sends the email
// through Azure Communication Services, then scales back to 0.
require('./telemetry');
const { ServiceBusClient } = require('@azure/service-bus');
const config = require('./config');
const { handleAlertEvent } = require('./services/alertHandler');

if (!config.serviceBusConnectionString) {
  console.error('[worker] SERVICEBUS_CONNECTION_STRING is not set');
  process.exit(1);
}

const client = new ServiceBusClient(config.serviceBusConnectionString);
const receiver = client.createReceiver(config.alertsQueue);

receiver.subscribe(
  {
    processMessage: async (msg) => {
      console.log(`[worker] received ${msg.messageId}`);
      await handleAlertEvent(msg.body); // throwing → message is retried, then dead-lettered
    },
    processError: async (args) => {
      console.error(`[worker] error from ${args.errorSource}:`, args.error.message);
    },
  },
  { autoCompleteMessages: true, maxConcurrentCalls: 4 },
);

console.log(`[worker] listening on queue "${config.alertsQueue}"`);

async function shutdown() {
  console.log('[worker] shutting down');
  await receiver.close();
  await client.close();
  process.exit(0);
}
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
