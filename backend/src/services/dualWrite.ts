import {
  Prisma,
  PrismaClient,
  MedicineEventReason,
  FootfallEventSource,
  BedEventReason,
  EmergencyType,
  Severity,
} from '@prisma/client';

type TX = Prisma.TransactionClient | PrismaClient;

/**
 * Adjust medicine inventory — appends medicine_event AND updates (or inserts) medicine_inventories.
 * Caller MUST pass a Prisma transaction client for atomicity.
 * Throws if resulting quantity would be < 0.
 */
export async function adjustMedicineInventory(
  tx: TX,
  phcId: number,
  medicineId: number,
  delta: number,
  reason: MedicineEventReason,
  operatorId: number | null,
  opts?: { referenceId?: string }
) {
  // Upsert current inventory row; then apply delta; then write event.
  const inv = await tx.medicineInventory.upsert({
    where: { phcId_medicineId: { phcId, medicineId } },
    create: { phcId, medicineId, currentQuantity: 0 },
    update: {},
  });
  const nextQty = inv.currentQuantity + delta;
  if (nextQty < 0) {
    throw new Error(
      `Medicine stock would go negative (phc=${phcId}, med=${medicineId}, have=${inv.currentQuantity}, delta=${delta})`
    );
  }
  const updated = await tx.medicineInventory.update({
    where: { id: inv.id },
    data: { currentQuantity: nextQty, lastUpdated: new Date() },
  });
  const event = await tx.medicineEvent.create({
    data: {
      phcId,
      medicineId,
      inventoryId: inv.id,
      changeQty: delta,
      reason,
      referenceId: opts?.referenceId ?? null,
      operatorId,
    },
  });
  return { inventory: updated, event };
}

export function startOfDay(d: Date = new Date()): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/**
 * Append footfall event, update today's daily aggregate, and refresh phc_status.last_patient_count.
 */
export async function recordFootfall(
  tx: TX,
  phcId: number,
  deltas: {
    outpatientDelta: number;
    admissionsDelta: number;
    dischargesDelta: number;
    triageMildDelta: number;
    triageModerateDelta: number;
    triageSevereDelta: number;
  },
  source: FootfallEventSource = FootfallEventSource.manual,
  operatorId: number | null
) {
  const event = await tx.footfallEvent.create({
    data: { phcId, source, operatorId, ...deltas },
  });
  const today = startOfDay();
  await tx.dailyFootfallAggregate.upsert({
    where: { phcId_date: { phcId, date: today } },
    create: {
      phcId,
      date: today,
      outpatient: Math.max(0, deltas.outpatientDelta),
      admissions: Math.max(0, deltas.admissionsDelta),
      discharges: Math.max(0, deltas.dischargesDelta),
      triageMild: Math.max(0, deltas.triageMildDelta),
      triageModerate: Math.max(0, deltas.triageModerateDelta),
      triageSevere: Math.max(0, deltas.triageSevereDelta),
    },
    update: {
      outpatient: { increment: Math.max(0, deltas.outpatientDelta) },
      admissions: { increment: Math.max(0, deltas.admissionsDelta) },
      discharges: { increment: Math.max(0, deltas.dischargesDelta) },
      triageMild: { increment: Math.max(0, deltas.triageMildDelta) },
      triageModerate: { increment: Math.max(0, deltas.triageModerateDelta) },
      triageSevere: { increment: Math.max(0, deltas.triageSevereDelta) },
    },
  });
  // Update phc_status.lastPatientCount with outpatientDelta net for this event
  await tx.phcStatus.upsert({
    where: { phcId },
    create: {
      phcId,
      bedsTotal: 20,
      bedsOccupied: 0,
      bedsEmergencyReserved: 2,
      staffTotal: 10,
      staffOnDuty: 8,
      lastPatientCount: deltas.outpatientDelta,
    },
    update: {
      lastPatientCount: { increment: deltas.outpatientDelta },
      lastUpdated: new Date(),
    },
  });
  // If there are admissions/discharges, apply to beds too (best-effort consistency)
  if (deltas.admissionsDelta - deltas.dischargesDelta !== 0) {
    const bedDelta = deltas.admissionsDelta - deltas.dischargesDelta;
    await adjustBeds(tx, phcId, bedDelta, BedEventReason.admission, operatorId);
  }
  return event;
}

/**
 * Append bed_event + update phc_status.bedsOccupied (clamped 0..bedsTotal).
 */
export async function adjustBeds(
  tx: TX,
  phcId: number,
  occupiedDelta: number,
  reason: BedEventReason,
  operatorId: number | null
) {
  const status = await tx.phcStatus.upsert({
    where: { phcId },
    create: {
      phcId,
      bedsTotal: 20,
      bedsOccupied: 0,
      bedsEmergencyReserved: 2,
      staffTotal: 10,
      staffOnDuty: 8,
      lastPatientCount: 0,
    },
    update: {},
  });
  const nextOccupied = Math.max(0, Math.min(status.bedsTotal, status.bedsOccupied + occupiedDelta));
  const actualDelta = nextOccupied - status.bedsOccupied;
  if (actualDelta !== 0) {
    await tx.phcStatus.update({
      where: { id: status.id },
      data: { bedsOccupied: nextOccupied, lastUpdated: new Date() },
    });
  }
  const event = await tx.bedEvent.create({
    data: { phcId, occupiedDelta, reason, operatorId },
  });
  return { status: { ...status, bedsOccupied: nextOccupied }, event };
}

/**
 * Mark attendance for a staff roster row. Appends attendance_event and updates roster.isPresent.
 * Recomputes phc_status.staffOnDuty from the current roster table counts after update.
 */
export async function markAttendance(
  tx: TX,
  phcId: number,
  rosterId: number,
  isPresent: boolean,
  operatorId: number
) {
  const roster = await tx.staffRoster.findUnique({
    where: { id: rosterId },
    select: { id: true, phcId: true, isPresent: true },
  });
  if (!roster) throw new Error('Roster not found');
  if (roster.phcId !== phcId) throw new Error('Roster does not belong to scoped PHC');
  const evt = await tx.attendanceEvent.create({
    data: { phcId, staffRosterId: rosterId, isPresent, operatorId },
  });
  const newRoster = await tx.staffRoster.update({
    where: { id: rosterId },
    data: { isPresent, lastMarked: new Date() },
  });
  // recompute staffOnDuty
  const presentCount = await tx.staffRoster.count({ where: { phcId, isPresent: true } });
  await tx.phcStatus.upsert({
    where: { phcId },
    create: {
      phcId,
      bedsTotal: 20,
      bedsOccupied: 0,
      bedsEmergencyReserved: 2,
      staffTotal: 10,
      staffOnDuty: presentCount,
    },
    update: { staffOnDuty: presentCount, lastUpdated: new Date() },
  });
  return { event: evt, roster: newRoster, presentCount };
}

export async function reportEmergency(
  tx: TX,
  phcId: number,
  type: EmergencyType,
  severity: Severity,
  patientCount: number,
  operatorId: number,
  notes?: string | null
) {
  const evt = await tx.emergencyEvent.create({
    data: {
      phcId,
      type,
      severity,
      patientCount,
      notes: notes ?? null,
      reportedById: operatorId,
      isActive: true,
    },
  });
  await tx.phcStatus.upsert({
    where: { phcId },
    create: {
      phcId,
      bedsTotal: 20,
      bedsOccupied: 0,
      bedsEmergencyReserved: 2,
      staffTotal: 10,
      staffOnDuty: 8,
      activeEmergency: true,
    },
    update: { activeEmergency: true, lastUpdated: new Date() },
  });
  return evt;
}

export async function resolveEmergency(
  tx: TX,
  phcId: number,
  emergencyId: number,
  operatorId: number
) {
  const em = await tx.emergencyEvent.findUnique({ where: { id: emergencyId }, select: { id: true, phcId: true, isActive: true } });
  if (!em) throw new Error('Emergency not found');
  if (em.phcId !== phcId) throw new Error('Emergency does not belong to scoped PHC');
  const resolved = await tx.emergencyEvent.update({
    where: { id: emergencyId },
    data: { isActive: false, resolvedById: operatorId, resolvedAt: new Date() },
  });
  // clear activeEmergency flag on phc_status only if no other active emergencies remain
  const remaining = await tx.emergencyEvent.count({ where: { phcId, isActive: true } });
  if (remaining === 0) {
    await tx.phcStatus.updateMany({ where: { phcId }, data: { activeEmergency: false, lastUpdated: new Date() } });
  }
  return resolved;
}
