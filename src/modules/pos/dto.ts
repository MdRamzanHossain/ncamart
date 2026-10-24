// Data Transfer Objects (DTO) and Zod schemas for module: pos
import { z } from 'zod';

export const posStatusDto = z.object({
  status: z.string(),
});
