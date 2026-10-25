import { z } from 'zod';

const schema = z.object({
  AUTHNET_API_LOGIN_ID: z.string().min(1),
  AUTHNET_TRANSACTION_KEY: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3000),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return schema.parse(env);
}
