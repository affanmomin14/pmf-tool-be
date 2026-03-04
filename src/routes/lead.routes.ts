import { Router } from 'express';
import { validate } from '../middlewares/validate.middleware';
import { createLeadSchema } from '../schemas/lead.schema';
import * as ctrl from '../controllers/lead.controller';

const router = Router();

router.post('/', validate({ body: createLeadSchema }), ctrl.createLead);

export default router;
