import { z } from 'zod';

const EnvSchema = z.object({
  PORT: z.string().optional(),
});

export const env = EnvSchema.parse(process.env);
