// Service Bus consumer for budget-alert events.
// Runs inside the API process in the cloud (and can run standalone via
// src/worker.js). Each message → email via Azure Communication Services.
const { ServiceBusClient } = require('@azure/service-bus');
const config = require('../config');
const { handleAlertEvent } = require('./alertHandler');

function startAlertConsumer() {
  if (!config.serviceBusConnectionString) return null;
  const client = new ServiceBusClient(config.serviceBusConnectionString);
  const receiver = client.createReceiver(config.alertsQueue);

  receiver.subscribe(
    {
      processMessage: async (msg) => {
        console.log(`[alerts] received ${msg.messageId}`);
        await handleAlertEvent(msg.body); // throwing → retried, then dead-lettered
      },
      processError: async (args) => {
        console.error(`[alerts] consumer error from ${args.errorSource}:`, args.error.message);
      },
    },
    { autoCompleteMessages: true, maxConcurrentCalls: 4 },
  );
  console.log(`[alerts] consuming queue "${config.alertsQueue}"`);

  return async function stop() {
    await receiver.close();
    await client.close();
  };
}

module.exports = { startAlertConsumer };
