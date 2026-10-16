// Central place for every environment variable the backend and worker read.
// Anything optional degrades gracefully so the app still runs locally.

const env = process.env;

const config = {
  port: parseInt(env.PORT || '8080', 10),
  jwtSecret: env.JWT_SECRET || 'dev-only-change-me',
  corsOrigins: (env.CORS_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // PostgreSQL (Azure Database for PostgreSQL Flexible Server in the cloud)
  databaseUrl: env.DATABASE_URL || 'postgres://expense:expense@localhost:5432/expense',
  databaseSsl: env.DATABASE_SSL === 'true',

  // Azure Blob Storage (Azurite locally)
  storageConnectionString: env.AZURE_STORAGE_CONNECTION_STRING || '',
  receiptsContainer: env.RECEIPTS_CONTAINER || 'receipts',

  // Azure Service Bus queue that carries budget-alert events
  serviceBusConnectionString: env.SERVICEBUS_CONNECTION_STRING || '',
  alertsQueue: env.ALERTS_QUEUE || 'budget-alerts',

  // Azure Communication Services Email
  acsConnectionString: env.ACS_CONNECTION_STRING || '',
  emailSender: env.EMAIL_SENDER || '',

  // Azure AI Document Intelligence (receipt OCR) – optional
  docIntelEndpoint: (env.DOCINTEL_ENDPOINT || '').replace(/\/$/, ''),
  docIntelKey: env.DOCINTEL_KEY || '',

  // Azure OpenAI (AI insights) – optional; rule-based insights otherwise
  openaiEndpoint: (env.AZURE_OPENAI_ENDPOINT || '').replace(/\/$/, ''),
  openaiKey: env.AZURE_OPENAI_KEY || '',
  openaiDeployment: env.AZURE_OPENAI_DEPLOYMENT || '',
  openaiApiVersion: env.AZURE_OPENAI_API_VERSION || '2024-10-21',

  // Application Insights (Azure Monitor)
  appInsightsConnectionString: env.APPLICATIONINSIGHTS_CONNECTION_STRING || '',

  // Alert thresholds as fractions of the monthly budget
  alertThresholds: [0.8, 1.0],
};

module.exports = config;
