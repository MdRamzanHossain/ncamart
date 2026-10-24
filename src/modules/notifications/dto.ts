// Data Transfer Objects (DTO) and Zod schemas for module: notifications
import { z } from 'zod';

export const notificationsStatusDto = z.object({
  status: z.string(),
});
