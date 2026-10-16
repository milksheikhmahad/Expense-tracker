require('./telemetry');
const config = require('./config');
const { migrate } = require('./db');
const { createApp } = require('./app');

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
  createApp().listen(config.port, () => console.log(`[api] listening on :${config.port}`));
}

main().catch((e) => {
  console.error('[api] fatal', e);
  process.exit(1);
});
