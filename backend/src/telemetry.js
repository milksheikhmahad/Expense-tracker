// Must be required before anything else so Azure Monitor can instrument
// http, express and pg automatically.
const config = require('./config');

if (config.appInsightsConnectionString) {
  const { useAzureMonitor } = require('@azure/monitor-opentelemetry');
  useAzureMonitor({
    azureMonitorExporterOptions: { connectionString: config.appInsightsConnectionString },
  });
  console.log('[telemetry] Azure Monitor / Application Insights enabled');
}
