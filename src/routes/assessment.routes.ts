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

router.post('/', validate({ body: createAssessmentSchema }), ctrl.createAssessment);
router.get('/:id', validate({ params: assessmentParamsSchema }), ctrl.getAssessment);

export default router;
