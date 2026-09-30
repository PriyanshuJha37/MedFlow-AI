import { z } from 'zod';

export const LoginRequestSchema = z.object({
  username: z.string().min(1).max(64),
  password: z.string().min(1).max(256),
});

export type LoginRequest = z.infer<typeof LoginRequestSchema>;
