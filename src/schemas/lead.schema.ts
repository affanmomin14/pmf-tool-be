import { z } from 'zod/v4';

export const createLeadSchema = z.object({
  assessmentId: z.uuid(),
  email: z.email(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
