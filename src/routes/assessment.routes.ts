import { Router } from 'express';
import { z } from 'zod/v4';
import { validate } from '../middlewares/validate.middleware';
import * as ctrl from '../controllers/assessment.controller';

const router = Router();

const createAssessmentSchema = z.object({
  problemType: z.enum(['market_fit', 'product_quality', 'distribution', 'monetization', 'retention']),
  utmSource: z.string().max(200).optional(),
  utmMedium: z.string().max(200).optional(),
  utmCampaign: z.string().max(200).optional(),
});

const assessmentParamsSchema = z.object({
  id: z.uuid(),
});

const createResponseSchema = z.object({
  questionId: z.number().int().min(1).max(5),
  answerText: z.string().max(2000).optional(),
  answerValue: z.string().max(200).optional(),
  timeSpentMs: z.number().int().min(0).optional(),
  questionOrder: z.number().int().min(1).max(5),
});

router.post('/', validate({ body: createAssessmentSchema }), ctrl.createAssessment);
router.get('/:id', validate({ params: assessmentParamsSchema }), ctrl.getAssessment);
router.post(
  '/:id/responses',
  validate({
    params: assessmentParamsSchema,
    body: createResponseSchema,
  }),
  ctrl.createResponse,
);

router.post(
  '/:id/complete',
  validate({ params: assessmentParamsSchema }),
  ctrl.completeAssessment,
);

export default router;
