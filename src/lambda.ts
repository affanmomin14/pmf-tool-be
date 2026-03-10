import { configure } from '@codegenie/serverless-express';
import { app } from './app';
import { logger } from './config/logger';
import { runFullPipeline } from './services/pipeline.service';

const serverlessExpressInstance = configure({ app });

export const handler = async (event: any, context: any, callback: any) => {
  if (event.source === 'pipeline-async') {
    const { assessmentId } = event;
    logger.info(`[Lambda] Async pipeline invocation for assessment ${assessmentId}`);
    try {
      await runFullPipeline(assessmentId);
      logger.info(`[Lambda] Async pipeline completed for assessment ${assessmentId}`);
    } catch (err) {
      logger.error(`[Lambda] Async pipeline failed for assessment ${assessmentId}: ${err}`);
    }
    return;
  }

  return serverlessExpressInstance(event, context, callback);
};
