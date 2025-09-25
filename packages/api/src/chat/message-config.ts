import { z } from 'zod';

export const MessageConfigSchema = z.object({
  mcp: z.array(z.string()),
  modelId: z.string(),
  connectionName: z.string(),
  providerId: z.string(),
});

export type MessageConfig = z.output<typeof MessageConfigSchema>;
