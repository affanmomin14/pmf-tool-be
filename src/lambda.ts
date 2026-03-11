import { configure } from '@codegenie/serverless-express';
import { app } from './app';
import { logger } from './config/logger';
import { runFullPipeline } from './services/pipeline.service';
import { prisma } from './db/prisma';

const serverlessExpressInstance = configure({ app });

export const handler = async (event: any, context: any, callback: any) => {
  if (event.source === 'pipeline-async') {
    const { assessmentId } = event;
    logger.info(`[Lambda] Async pipeline invocation for assessment ${assessmentId}`);
    try {
      await runFullPipeline(assessmentId);
      logger.info(`[Lambda] Async pipeline completed for assessment ${assessmentId}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`[Lambda] Async pipeline failed for assessment ${assessmentId}: ${message}`);
      try {
        await prisma.assessment.update({
          where: { id: assessmentId },
          data: { pipelineErrorMessage: message },
        });
      } catch (updateErr) {
        logger.error(`[Lambda] Failed to store pipeline error for ${assessmentId}: ${updateErr}`);
      }
    }
    return;
  }

  return serverlessExpressInstance(event, context, callback);
};
