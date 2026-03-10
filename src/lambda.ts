import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { configure } from '@codegenie/serverless-express';
import { app } from './app';
import { logger } from './config/logger';

// Configure serverless express
const serverlessExpressInstance = configure({ app });

export const handler = serverlessExpressInstance;