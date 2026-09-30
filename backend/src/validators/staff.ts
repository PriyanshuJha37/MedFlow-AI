import { z } from 'zod';
import { BedEventReason, StaffRole, EmergencyType, Severity } from '@prisma/client';

export const AdjustBedsSchema = z.object({
  occupiedDelta: z.coerce.number().int(),
  reason: z.nativeEnum(BedEventReason).default(BedEventReason.admission),
  phcId: z.coerce.number().int().positive().optional(),
});
export type AdjustBedsRequest = z.infer<typeof AdjustBedsSchema>;

export const MarkAttendanceSchema = z.object({
  isPresent: z.coerce.boolean(),
});
export type MarkAttendanceRequest = z.infer<typeof MarkAttendanceSchema>;

export const EmergencyCreateSchema = z.object({
  type: z.nativeEnum(EmergencyType),
  severity: z.nativeEnum(Severity),
  patientCount: z.coerce.number().int().min(0).default(1),
  notes: z.string().max(2000).optional(),
  phcId: z.coerce.number().int().positive().optional(),
});
export type EmergencyCreateRequest = z.infer<typeof EmergencyCreateSchema>;

export const EmergencyResolveSchema = z.object({
  phcId: z.coerce.number().int().positive().optional(),
});

export const RoleChangeSchema = z.object({
  staffRole: z.nativeEnum(StaffRole),
});
export type RoleChangeRequest = z.infer<typeof RoleChangeSchema>;
