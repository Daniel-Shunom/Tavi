import { z } from 'zod';
import { rectSchema } from './states.js';

export const obsConnectSchema = z
  .object({
    port: z.number().int().min(1).max(65535).default(4455),
    password: z.string().max(1024).default(''),
  })
  .strict();
export const obsSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  camera: z.boolean(),
  rect: rectSchema.nullable(),
  reason: z.string().nullable(),
});
export const obsStatusSchema = z.object({
  phase: z.enum(['disconnected', 'connecting', 'connected', 'error']),
  message: z.string(),
  scene: z.string().nullable(),
  sources: z.array(obsSourceSchema),
  selection: z.string().nullable(),
  webcam: rectSchema.nullable(),
  canvas: z.object({ width: z.number(), height: z.number() }).nullable(),
});
export type ObsStatus = z.infer<typeof obsStatusSchema>;
export type ObsSource = z.infer<typeof obsSourceSchema>;
