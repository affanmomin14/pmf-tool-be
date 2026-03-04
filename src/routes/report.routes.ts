import { Router } from 'express';
import { z } from 'zod/v4';
import { validate } from '../middlewares/validate.middleware';
import * as ctrl from '../controllers/report.controller';

const router = Router();

const reportTokenParamsSchema = z.object({
  token: z.string().min(1).max(30),
});

const emailBodySchema = z.object({
  email: z.email(),
});

router.get('/:token', validate({ params: reportTokenParamsSchema }), ctrl.getReport);
router.post('/:token/email', validate({ params: reportTokenParamsSchema, body: emailBodySchema }), ctrl.emailReport);

export default router;
