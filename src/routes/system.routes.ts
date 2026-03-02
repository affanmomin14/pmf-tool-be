import { Router } from 'express';
import { z } from 'zod/v4';
import { validate } from '../middlewares/validate.middleware';
import * as ctrl from '../controllers/system.controller';

const router = Router();

router.get('/questions', ctrl.getQuestions);
router.get('/categories', ctrl.getCategories);
router.get(
  '/facts',
  validate({ query: z.object({ location: z.string().optional() }) }),
  ctrl.getFacts,
);
router.get('/social-proof', ctrl.getSocialProof);
router.get(
  '/micro-insights/:questionId',
  validate({
    params: z.object({ questionId: z.coerce.number().int().positive() }),
  }),
  ctrl.getMicroInsights,
);

export default router;
