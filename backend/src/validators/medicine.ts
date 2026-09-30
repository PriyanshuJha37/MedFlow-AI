import { z } from 'zod';
import { MedicineEventReason } from '@prisma/client';

export const AdjustMedicineSchema = z.object({
  medicineId: z.coerce.number().int().positive(),
  delta: z.coerce.number().int().refine(n => n !== 0, 'Delta cannot be zero'),
  reason: z.nativeEnum(MedicineEventReason),
  referenceId: z.string().optional(),
  phcId: z.coerce.number().int().positive().optional(),
});

export type AdjustMedicineRequest = z.infer<typeof AdjustMedicineSchema>;
