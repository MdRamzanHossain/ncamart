// Data Transfer Objects (DTO) and Zod schemas for module: analytics
import { z } from 'zod';

export const analyticsStatusDto = z.object({
  status: z.string(),
});
