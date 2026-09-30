import { z } from 'zod';
import { FootfallEventSource } from '@prisma/client';

export const FootfallDeltasSchema = z.object({
  outpatientDelta:   z.coerce.number().int().default(0),
  admissionsDelta:   z.coerce.number().int().default(0),
  dischargesDelta:   z.coerce.number().int().default(0),
  triageMildDelta:   z.coerce.number().int().default(0),
  triageModerateDelta: z.coerce.number().int().default(0),
  triageSevereDelta:   z.coerce.number().int().default(0),
  source: z.nativeEnum(FootfallEventSource).default(FootfallEventSource.manual),
  phcId:  z.coerce.number().int().positive().optional(),
});

export type FootfallDeltasRequest = z.infer<typeof FootfallDeltasSchema>;
