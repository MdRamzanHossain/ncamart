// Data Transfer Objects (DTO) and Zod schemas for module: engagement
import { z } from 'zod';

export const engagementStatusDto = z.object({
  status: z.string(),
});
