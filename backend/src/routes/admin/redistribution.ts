import { Router, Request, Response } from 'express';
import { TransferProposedBy, TransferStatus, TransferProposal } from '@prisma/client';
import { prisma } from '../../prisma';

const router = Router();

const EARTH_RADIUS_KM = 6371;
function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

export interface PhcBaseline {
  id: number;
  name: string;
  city: string;
  zone: string;
  lat: number | null;
  lng: number | null;
  bedsTotal: number;
  bedsOccupied: number;
  bedsEmergencyReserved: number;
  staffTotal: number;
  staffOnDuty: number;
  lastPatientCount: number;
  activeEmergency: boolean;
}

export interface MedicineSuggestion {
  id: string;
  sourcePhcId: number;
  destPhcId: number;
  sourcePhcName: string;
  destPhcName: string;
  medicineId: number;
  medicineName: string;
  proposedQty: number;
  rationale: string;
  riskScore: number;
  sourceStock: number;
  destStock: number;
  destReorderLevel: number;
  estimatedDaysShortfall: number;
}

export interface StaffSuggestion {
  id: string;
  sourcePhcId: number;
  destPhcId: number;
  sourcePhcName: string;
  destPhcName: string;
  role: string;
  rationale: string;
  gapCount: number;
  distanceKm: number;
}

export interface BedsSuggestion {
  id: string;
  sourcePhcId: number;
  destPhcId: number;
  sourcePhcName: string;
  destPhcName: string;
  rationale: string;
  freeBedsAtSource: number;
  overflowAtDest: number;
  distanceKm: number;
}

export interface SuggestionResponse {
  medicines: MedicineSuggestion[];
  staff: StaffSuggestion[];
  beds: BedsSuggestion[];
  generatedAt: string;
  analyticsConnected: boolean;
}

function estimateDailyRate(
  last14Aggs: Array<{ phcId: number; outpatient: number; admissions: number }>,
  phcId: number,
  defaultPer100: number
): number {
  const rows = last14Aggs.filter((r) => r.phcId === phcId);
  if (rows.length === 0) return defaultPer100;
  const totalOut = rows.reduce((s, r) => s + r.outpatient, 0);
  const totalAdm = rows.reduce((s, r) => s + r.admissions, 0);
  const avgDailyPatients = (totalOut + totalAdm) / Math.max(1, rows.length);
  const rate = (avgDailyPatients / 100) * defaultPer100;
  return Math.max(0.1, rate);
}

router.get('/admin/suggestions', async (_req: Request, res: Response<SuggestionResponse | { error: string }>) => {
  try {
    const phcs = await prisma.phc.findMany({
      include: {
        phcStatus: {
          select: {
            bedsTotal: true,
            bedsOccupied: true,
            bedsEmergencyReserved: true,
            staffTotal: true,
            staffOnDuty: true,
            lastPatientCount: true,
            activeEmergency: true,
          },
        },
      },
      orderBy: { id: 'asc' },
    });

    const baseline: PhcBaseline[] = phcs.map((p) => ({
      id: p.id,
      name: p.name,
      city: p.city,
      zone: p.zone,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      bedsTotal: p.phcStatus?.bedsTotal ?? p.totalBeds,
      bedsOccupied: p.phcStatus?.bedsOccupied ?? 0,
      bedsEmergencyReserved: p.phcStatus?.bedsEmergencyReserved ?? 0,
      staffTotal: p.phcStatus?.staffTotal ?? p.totalStaff,
      staffOnDuty: p.phcStatus?.staffOnDuty ?? 0,
      lastPatientCount: p.phcStatus?.lastPatientCount ?? 0,
      activeEmergency: !!p.phcStatus?.activeEmergency,
    }));

    const inventories = await prisma.medicineInventory.findMany({
      include: {
        medicine: {
          select: { id: true, name: true, defaultDailyConsumptionPer100Patients: true, reorderLevel: true, criticalLevel: true, daysOfStockWarning: true },
        },
      },
    });

    const today = new Date();
    const twoWeeksAgo = new Date(today.getTime() - 14 * 24 * 60 * 60 * 1000);
    const footfallAggs = await prisma.dailyFootfallAggregate.findMany({
      where: { date: { gte: twoWeeksAgo, lte: today } },
      select: { phcId: true, outpatient: true, admissions: true, date: true },
    });

    const medicines: MedicineSuggestion[] = [];
    const allMedIds = new Set<number>([...inventories.map((i) => i.medicineId)]);

    for (const medId of allMedIds) {
      const rows = inventories.filter((i) => i.medicineId === medId);
      const med = rows[0]?.medicine;
      if (!med) continue;

      type scoredPhc = {
        phcId: number;
        qty: number;
        daily: number;
        dors: number;
      };
      const scored: scoredPhc[] = rows.map((r) => {
        const daily = estimateDailyRate(
          footfallAggs,
          r.phcId,
          med.defaultDailyConsumptionPer100Patients
        );
        const dors = r.currentQuantity / Math.max(0.01, daily);
        return {
          phcId: r.phcId,
          qty: r.currentQuantity,
          daily,
          dors,
        };
      });

      const dests = scored
        .filter((s) => s.dors < (med.daysOfStockWarning ?? 7))
        .map((s) => {
          const risk =
            s.qty <= med.criticalLevel
              ? 95
              : s.qty <= med.reorderLevel
              ? 75
              : 60 + (med.daysOfStockWarning - s.dors) * 3;
          return { ...s, risk: Math.min(99, Math.max(50, risk)) };
        })
        .sort((a, b) => b.risk - a.risk);

      const sources = scored
        .filter((s) => s.dors > 45)
        .sort((a, b) => b.dors - a.dors);

      for (const dest of dests) {
        if (dest.qty >= med.reorderLevel) continue;
        const shortfallQty = med.reorderLevel - dest.qty + Math.ceil(dest.daily * 3);
        let remaining = shortfallQty;
        for (const src of sources) {
          if (src.phcId === dest.phcId) continue;
          if (remaining <= 0) break;
          const surplusFloor = Math.ceil(src.daily * 21);
          const transferable = Math.max(0, src.qty - surplusFloor);
          if (transferable <= 0) continue;
          const qty = Math.min(remaining, transferable);
          const srcPhc = baseline.find((b) => b.id === src.phcId);
          const destPhc = baseline.find((b) => b.id === dest.phcId);
          medicines.push({
            id: `med-${medId}-${src.phcId}-${dest.phcId}-${medicines.length}`,
            sourcePhcId: src.phcId,
            destPhcId: dest.phcId,
            sourcePhcName: srcPhc?.name ?? `PHC ${src.phcId}`,
            destPhcName: destPhc?.name ?? `PHC ${dest.phcId}`,
            medicineId: medId,
            medicineName: med.name,
            proposedQty: qty,
            sourceStock: src.qty,
            destStock: dest.qty,
            destReorderLevel: med.reorderLevel,
            estimatedDaysShortfall: Math.round(dest.dors),
            riskScore: dest.risk,
            rationale: `${destPhc?.name ?? 'Dest'} has ${Math.round(dest.dors)} days of ${med.name} (qty ${dest.qty}, below reorder ${med.reorderLevel}). ${srcPhc?.name ?? 'Source'} has ${Math.round(src.dors)} days surplus (qty ${src.qty}). Recommended transfer ${qty}.`,
          });
          remaining -= qty;
        }
      }
    }
    medicines.sort((a, b) => b.riskScore - a.riskScore);

    // -------- Staff suggestions --------
    const staff: StaffSuggestion[] = [];
    const staffScored = baseline
      .filter((b) => b.staffTotal > 0)
      .map((b) => ({
        phc: b,
        onDutyPct: b.staffTotal === 0 ? 0 : (b.staffOnDuty / b.staffTotal) * 100,
        shortage: Math.max(0, Math.ceil(b.staffTotal * 0.75) - b.staffOnDuty),
        surplus: b.staffOnDuty - Math.ceil(b.staffTotal * 0.85),
      }));
    const destsStaff = staffScored.filter((s) => s.shortage > 0).sort((a, b) => b.shortage - a.shortage);
    const srcsStaff = staffScored.filter((s) => s.surplus > 0).sort((a, b) => b.surplus - a.surplus);
    for (const dest of destsStaff) {
      for (const src of srcsStaff) {
        if (src.phc.id === dest.phc.id) continue;
        if (src.surplus <= 0 || dest.shortage <= 0) continue;
        const latOk =
          typeof src.phc.lat === 'number' &&
          typeof src.phc.lng === 'number' &&
          typeof dest.phc.lat === 'number' &&
          typeof dest.phc.lng === 'number';
        const distanceKm = latOk
          ? haversineKm(src.phc.lat as number, src.phc.lng as number, dest.phc.lat as number, dest.phc.lng as number)
          : 25;
        if (distanceKm > 35) continue;
        const move = Math.min(src.surplus, dest.shortage, 2);
        staff.push({
          id: `staff-${src.phc.id}-${dest.phc.id}-${staff.length}`,
          sourcePhcId: src.phc.id,
          destPhcId: dest.phc.id,
          sourcePhcName: src.phc.name,
          destPhcName: dest.phc.name,
          role: 'Nurse / Support',
          rationale: `${dest.phc.name} understaffed (${dest.phc.staffOnDuty}/${dest.phc.staffTotal} on-duty). ${src.phc.name} has ${src.surplus} surplus on-duty. Reallocate ${move}.`,
          gapCount: move,
          distanceKm: Math.round(distanceKm * 10) / 10,
        });
        src.surplus -= move;
        dest.shortage -= move;
      }
    }

    // -------- Beds suggestions --------
    const beds: BedsSuggestion[] = [];
    const bedScored = baseline.map((b) => {
      const usable = Math.max(0, b.bedsTotal - b.bedsEmergencyReserved);
      const occupied = b.bedsOccupied;
      const pct = usable === 0 ? 0 : (occupied / usable) * 100;
      const overflow = occupied - Math.floor(usable * 0.85);
      const free = Math.max(0, Math.floor(usable * 0.55) - occupied);
      return { phc: b, pct, overflow: Math.max(0, overflow), free };
    });
    const destsBeds = bedScored.filter((s) => s.overflow > 0 || s.phc.activeEmergency).sort((a, b) => b.overflow - a.overflow);
    const srcsBeds = bedScored.filter((s) => s.free > 0).sort((a, b) => b.free - a.free);
    for (const dest of destsBeds) {
      for (const src of srcsBeds) {
        if (src.phc.id === dest.phc.id) continue;
        if (src.free <= 0 || dest.overflow <= 0) continue;
        const latOk =
          typeof src.phc.lat === 'number' &&
          typeof src.phc.lng === 'number' &&
          typeof dest.phc.lat === 'number' &&
          typeof dest.phc.lng === 'number';
        const distanceKm = latOk
          ? haversineKm(src.phc.lat as number, src.phc.lng as number, dest.phc.lat as number, dest.phc.lng as number)
          : 20;
        if (distanceKm > 30) continue;
        const move = Math.min(src.free, dest.overflow);
        beds.push({
          id: `beds-${src.phc.id}-${dest.phc.id}-${beds.length}`,
          sourcePhcId: src.phc.id,
          destPhcId: dest.phc.id,
          sourcePhcName: src.phc.name,
          destPhcName: dest.phc.name,
          freeBedsAtSource: src.free,
          overflowAtDest: dest.overflow,
          distanceKm: Math.round(distanceKm * 10) / 10,
          rationale: `${dest.phc.name} ${dest.phc.activeEmergency ? 'active emergency + ' : ''}overflows by ${dest.overflow} beds (${Math.round(dest.pct)}% occupancy). ${src.phc.name} has ${src.free} free beds (${Math.round(src.pct)}% occ). Redirect ${move} patients (${Math.round(distanceKm)} km).`,
        });
        src.free -= move;
        dest.overflow -= move;
      }
    }

    res.json({
      medicines: medicines.slice(0, 30),
      staff: staff.slice(0, 15),
      beds: beds.slice(0, 15),
      generatedAt: new Date().toISOString(),
      analyticsConnected: false,
    });
  } catch (e: any) {
    res.status(500).json({ error: e?.message ?? 'Suggestion generation failed' });
  }
});

export interface TransferProposeBody {
  sourcePhcId: number;
  destPhcId: number;
  medicineId: number;
  proposedQty: number;
  rationale: string;
  riskScore: number;
}

function isTransferProposeBody(v: unknown): v is TransferProposeBody {
  if (typeof v !== 'object' || v === null) return false;
  const x = v as Record<string, unknown>;
  return (
    Number.isInteger(x.sourcePhcId) &&
    (x.sourcePhcId as number) > 0 &&
    Number.isInteger(x.destPhcId) &&
    (x.destPhcId as number) > 0 &&
    x.sourcePhcId !== x.destPhcId &&
    Number.isInteger(x.medicineId) &&
    (x.medicineId as number) > 0 &&
    Number.isInteger(x.proposedQty) &&
    (x.proposedQty as number) > 0 &&
    typeof x.rationale === 'string' &&
    (x.rationale as string).length <= 2000 &&
    typeof x.riskScore === 'number'
  );
}

router.post('/admin/transfers/propose', async (req: Request, res: Response<{ ok: boolean; proposal?: TransferProposal; error?: string; issues?: string }>) => {
  try {
    const body = req.body as TransferProposeBody;
    if (!isTransferProposeBody(body)) {
      res.status(400).json({ ok: false, error: 'Invalid input', issues: 'Bad payload shape' });
      return;
    }
    const adminId = req.user?.sub ?? null;
    const [srcOk, dstOk, medOk] = await Promise.all([
      prisma.phc.findUnique({ where: { id: body.sourcePhcId }, select: { id: true } }),
      prisma.phc.findUnique({ where: { id: body.destPhcId }, select: { id: true } }),
      prisma.medicine.findUnique({ where: { id: body.medicineId }, select: { id: true } }),
    ]);
    if (!srcOk || !dstOk || !medOk) {
      res.status(404).json({ ok: false, error: 'Phc or Medicine not found' });
      return;
    }
    const proposal = await prisma.transferProposal.create({
      data: {
        sourcePhcId: body.sourcePhcId,
        destPhcId: body.destPhcId,
        medicineId: body.medicineId,
        proposedQty: body.proposedQty,
        rationale: body.rationale,
        riskScore: body.riskScore,
        status: TransferStatus.proposed,
        proposedBy: TransferProposedBy.ai,
        adminId,
      },
    });
    res.json({ ok: true, proposal });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'Propose failed' });
  }
});

type TransferRow = TransferProposal & {
  sourcePhc: { id: number; name: string; city: string };
  destPhc: { id: number; name: string; city: string };
  medicine: { id: number; name: string; unit: string };
  admin: { id: number; displayName: string } | null;
};

router.get('/admin/transfers', async (req: Request, res: Response<{ rows: TransferRow[]; counts: Record<string, number> }>) => {
  const statusFilter = (req.query.status as string)?.trim().toLowerCase();
  const where: any = {};
  if (statusFilter && Object.values(TransferStatus).includes(statusFilter as TransferStatus)) {
    where.status = statusFilter as TransferStatus;
  }
  const rowsPromise = prisma.transferProposal.findMany({
    where,
    include: {
      sourcePhc: { select: { id: true, name: true, city: true } },
      destPhc: { select: { id: true, name: true, city: true } },
      medicine: { select: { id: true, name: true, unit: true } },
      admin: { select: { id: true, displayName: true } },
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 200,
  }) as Promise<TransferRow[]>;
  const countsPromise = prisma.transferProposal.groupBy({
    by: ['status'],
    _count: { status: true },
  });
  const [rows, countsGrp] = await Promise.all([rowsPromise, countsPromise]);
  const counts: Record<string, number> = { proposed: 0, approved: 0, rejected: 0, executed: 0, total: 0 };
  for (const g of countsGrp) {
    counts[g.status] = g._count.status;
    counts.total += g._count.status;
  }
  res.json({ rows, counts });
});

const VALID_STATUS_TRANSITIONS: Record<TransferStatus, TransferStatus[]> = {
  [TransferStatus.proposed]:   [TransferStatus.approved, TransferStatus.rejected],
  [TransferStatus.approved]:   [TransferStatus.executed, TransferStatus.rejected],
  [TransferStatus.rejected]:   [],
  [TransferStatus.executed]:   [],
};

router.patch('/admin/transfers/:id/status', async (req: Request, res: Response<{ ok: boolean; proposal?: TransferProposal; error?: string }>) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ ok: false, error: 'Invalid transfer id' });
      return;
    }
    const nextStatus = (req.body?.status as string | undefined)?.trim() as TransferStatus | undefined;
    if (!nextStatus || !Object.values(TransferStatus).includes(nextStatus)) {
      res.status(400).json({ ok: false, error: `Invalid status. Must be one of: ${Object.values(TransferStatus).join(', ')}` });
      return;
    }
    const existing = await prisma.transferProposal.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ ok: false, error: 'Transfer proposal not found' });
      return;
    }
    const allowed = VALID_STATUS_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(nextStatus)) {
      res.status(409).json({ ok: false, error: `Cannot transition '${existing.status}' → '${nextStatus}'. Allowed: ${allowed.join(', ') || '(none)'}` });
      return;
    }
    const adminId = req.user?.sub ?? null;
    const update: any = {
      status: nextStatus,
      adminId: adminId ?? existing.adminId,
    };
    if (nextStatus === TransferStatus.approved) update.decidedAt = new Date();
    if (nextStatus === TransferStatus.executed) {
      update.decidedAt = existing.decidedAt ?? new Date();
      update.executedAt = new Date();
      // On execute: also move the medicine qty between inventories (source -qty, dest +qty), within a tx
      const result = await prisma.$transaction(async (tx) => {
        const srcInv = await tx.medicineInventory.findUnique({ where: { phcId_medicineId: { phcId: existing.sourcePhcId, medicineId: existing.medicineId } } });
        const dstInv = await tx.medicineInventory.findUnique({ where: { phcId_medicineId: { phcId: existing.destPhcId, medicineId: existing.medicineId } } });
        if (!srcInv || srcInv.currentQuantity < existing.proposedQty) {
          throw new Error(`Source PHC inventory has insufficient stock for transfer (need ${existing.proposedQty})`);
        }
        await tx.medicineInventory.update({
          where: { phcId_medicineId: { phcId: existing.sourcePhcId, medicineId: existing.medicineId } },
          data: { currentQuantity: { decrement: existing.proposedQty } },
        });
        if (dstInv) {
          await tx.medicineInventory.update({
            where: { phcId_medicineId: { phcId: existing.destPhcId, medicineId: existing.medicineId } },
            data: { currentQuantity: { increment: existing.proposedQty } },
          });
        } else {
          await tx.medicineInventory.create({
            data: { phcId: existing.destPhcId, medicineId: existing.medicineId, currentQuantity: existing.proposedQty },
          });
        }
        return tx.transferProposal.update({ where: { id }, data: update });
      });
      res.json({ ok: true, proposal: result });
      return;
    }
    if (nextStatus === TransferStatus.rejected) update.decidedAt = new Date();
    const proposal = await prisma.transferProposal.update({ where: { id }, data: update });
    res.json({ ok: true, proposal });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message ?? 'Status update failed' });
  }
});

export default router;
