import { z } from 'zod';

export const envelopeSchema = z.object({
  message_id: z.string().uuid(),
  timestamp: z.string().datetime(),
  from_agent: z.string(),
  to_agent: z.string(),
  message_type: z.enum(['delegate', 'respond', 'notify', 'error']),
  payload: z.record(z.any()),
  context: z.object({
    session_id: z.string().uuid(),
    user_id: z.string().uuid(),
    conversation_state: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
  }),
  trace: z.array(z.string().uuid()).default([]),
});

export type Envelope = z.infer<typeof envelopeSchema>;
