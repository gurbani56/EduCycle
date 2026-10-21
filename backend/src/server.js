'use strict';
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const { createApp } = require('./app');
const models = require('./models');

async function main() {
  try {
    await connectDB(env.mongoUri);
  } catch (err) {
    console.error(`\n[server] Could not connect to MongoDB at ${env.mongoUri.replace(/\/\/[^@]*@/, '//<credentials>@')}`);
    console.error(`[server] ${err.message}`);
    console.error('[server] Check that MongoDB is running and MONGODB_URI in .env is correct.\n');
    process.exit(1);
  }
  // Make sure unique indexes exist before accepting traffic.
  await Promise.all(Object.values(models).map((m) => m.syncIndexes()));

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`[server] EduCycle is running at http://localhost:${env.port}`);
    console.log(`[server] Admin login: http://localhost:${env.port}/admin-login.html`);
  });

  const shutdown = async (signal) => {
    console.log(`\n[server] ${signal} received, shutting down…`);
    server.close(async () => {
      await disconnectDB();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 8000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main();
