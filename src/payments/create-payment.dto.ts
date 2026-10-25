import { z } from 'zod';

export const createPaymentSchema = z.object({
  amount: z.string().regex(/^\d+\.\d{2}$/, 'amount must look like 10.00'),
  // One-time token produced on the device by Accept.js / the Accept mobile SDK.
  opaqueData: z.object({ dataDescriptor: z.string().min(1), dataValue: z.string().min(1) }),
  invoiceNumber: z.string().max(20).optional(),
});

export type CreatePaymentDto = z.infer<typeof createPaymentSchema>;
