import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';
import { closeBrowser } from './config/puppeteer';

export const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
});

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received — shutting down gracefully`);
  await closeBrowser();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
