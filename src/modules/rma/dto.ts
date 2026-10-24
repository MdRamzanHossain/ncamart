// Data Transfer Objects (DTO) and Zod schemas for module: rma
import { z } from 'zod';

export const rmaStatusDto = z.object({
  status: z.string(),
});
