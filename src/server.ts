import { app } from './app';
import { env } from './config/env';
import { logger } from './config/logger';

export const server = app.listen(env.PORT, () => {
  logger.info(`Server running on port ${env.PORT}`);
});
