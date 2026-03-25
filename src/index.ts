import { startServer } from './server.js';

startServer().catch((err) => {
  console.error('Failed to start ClawCost:', err);
  process.exit(1);
});
