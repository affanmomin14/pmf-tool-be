import { Request, Response, NextFunction } from 'express';
import { z } from 'zod/v4';
import { ValidationError } from '../errors';

type ValidationTarget = 'body' | 'params' | 'query';

interface ValidateOptions {
  body?: z.ZodType;
  params?: z.ZodType;
  query?: z.ZodType;
}

export const validate = (schemas: ValidateOptions) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: Array<{ field: string; message: string }> = [];

    for (const [target, schema] of Object.entries(schemas) as Array<[ValidationTarget, z.ZodType]>) {
      const result = schema.safeParse(req[target]);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({
            field: `${target}.${issue.path.join('.')}`,
            message: issue.message,
          });
        }
      } else {
        (req as any)[target] = result.data;
      }
    }

    if (errors.length > 0) {
      throw new ValidationError('Validation failed', errors);
    }

    next();
  };
};
