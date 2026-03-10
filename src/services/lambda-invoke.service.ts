import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { logger } from '../config/logger';
import { runFullPipeline } from './pipeline.service';

const isLambda = !!process.env.AWS_LAMBDA_FUNCTION_NAME;

const lambdaClient = isLambda
  ? new LambdaClient({})
  : null;

export async function invokePipelineAsync(assessmentId: string): Promise<void> {
  if (!isLambda) {
    // Local dev: run pipeline in background without blocking the response
    logger.info(`[invoke] Running pipeline locally for ${assessmentId}`);
    setImmediate(() => {
      runFullPipeline(assessmentId).catch((err) => {
        logger.error(`[invoke] Local pipeline failed for ${assessmentId}: ${err}`);
      });
    });
    return;
  }

  const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME_SELF
    || process.env.AWS_LAMBDA_FUNCTION_NAME;

  logger.info(`[invoke] Invoking Lambda async: ${functionName} for ${assessmentId}`);

  const command = new InvokeCommand({
    FunctionName: functionName,
    InvocationType: 'Event',
    Payload: Buffer.from(JSON.stringify({
      source: 'pipeline-async',
      assessmentId,
    })),
  });

  await lambdaClient!.send(command);
  logger.info(`[invoke] Async invocation sent for ${assessmentId}`);
}
