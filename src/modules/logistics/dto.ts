// Data Transfer Objects (DTO) and Zod schemas for module: logistics
import { z } from 'zod';

export const logisticsStatusDto = z.object({
  status: z.string(),
});
