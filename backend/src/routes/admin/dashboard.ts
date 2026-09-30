import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';
import { AlertSeverity } from '@prisma/client';

const router = Router();

interface PhcSummary {
  id: number;
  name: string;
  city: string;
  zone: string;
  lat: number | null;
  lng: number | null;
  bedsTotal: number;
  bedsOccupied: number;
  bedsOccupiedPct: number;
  bedsEmergencyReserved: number;
  staffTotal: number;
  staffOnDuty: number;
  staffOnDutyPct: number;
  activeEmergency: boolean;
  stockHealth: number;
  lastPatientCount: number;
  lastUpdated: Date;
}

interface ForecastAlert {
  id: number;
  type: 'forecast';
  severity: AlertSeverity;
  message: string;
  createdAt: string;
  phc: { id: number; name: string };
}

function daysToShortfall(currentQty: number, dailyRate: number, reorderLevel: number): number {
  if (dailyRate <= 0) return 9999;
  const usable = Math.max(0, currentQty - reorderLevel * 0.4);
  return Math.max(0, Math.floor(usable / dailyRate));
}

router.get('/', async (_req: Request, res: Response) => {
  const phcs = await prisma.phc.findMany({
    include: {
      phcStatus: true,
      medicineInventories: { include: { medicine: true } },
    },
    orderBy: { id: 'asc' },
  });
  const now = new Date();
  const summaries: PhcSummary[] = phcs.map((p): PhcSummary => {
    const status = p.phcStatus;
    const totalMeds = p.medicineInventories.length || 1;
    // stockHealth = % of meds with quantity ABOVE criticalLevel (absolute scarcity boundary).
    // Bonus points (+weight) for meds with buffer >= reorderLevel.
    let healthScore = 0;
    for (const inv of p.medicineInventories) {
      const crit = inv.medicine.criticalLevel || 10;
      const reorder = inv.medicine.reorderLevel || 50;
      const qty = inv.currentQuantity;
      if (qty >= reorder) healthScore += 100;
      else if (qty >= crit) healthScore += Math.round(50 + 50 * (qty - crit) / Math.max(1, reorder - crit));
      else if (qty >= crit * 0.4) healthScore += Math.round(25 + 25 * (qty - crit * 0.4) / Math.max(1, crit * 0.6));
      // else 0
    }
    const stockHealth = totalMeds > 0 ? Math.round(healthScore / totalMeds) : 0;
    const bedsTotal = status?.bedsTotal ?? p.totalBeds;
    const bedsOccupied = status?.bedsOccupied ?? 0;
    const staffTotal = status?.staffTotal ?? p.totalStaff;
    const staffOnDuty = status?.staffOnDuty ?? Math.floor(p.totalStaff * 0.8);
    return {
      id: p.id,
      name: p.name,
      city: p.city,
      zone: p.zone,
      lat: p.lat ?? null,
      lng: p.lng ?? null,
      bedsTotal,
      bedsOccupied,
      bedsOccupiedPct: bedsTotal > 0 ? Math.round((bedsOccupied / bedsTotal) * 100) : 0,
      bedsEmergencyReserved: status?.bedsEmergencyReserved ?? 0,
      staffTotal,
      staffOnDuty,
      staffOnDutyPct: staffTotal > 0 ? Math.round((staffOnDuty / staffTotal) * 100) : 0,
      activeEmergency: status?.activeEmergency ?? false,
      stockHealth,
      lastPatientCount: status?.lastPatientCount ?? 0,
      lastUpdated: status?.lastUpdated || now,
    };
  });

  // Global KPIs
  const totalBeds = summaries.reduce((s, x) => s + x.bedsTotal, 0);
  const occupiedBeds = summaries.reduce((s, x) => s + x.bedsOccupied, 0);
  const totalStaff = summaries.reduce((s, x) => s + x.staffTotal, 0);
  const onDutyStaff = summaries.reduce((s, x) => s + x.staffOnDuty, 0);
  const activeEmergencies = summaries.filter((s) => s.activeEmergency).length;
  const avgStockHealth = summaries.length
    ? Math.round(summaries.reduce((s, x) => s + x.stockHealth, 0) / summaries.length)
    : 0;
  const kpis = { totalBeds, occupiedBeds, totalStaff, onDutyStaff, activeEmergencies, avgStockHealth };

  // Recent alerts (limit 20, not dismissed)
  const recentAlerts = await prisma.alert.findMany({
    where: { dismissed: false },
    orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
    take: 20,
    include: { phc: { select: { id: true, name: true } } },
  });

  // Transfer counts
  const proposedCount = await prisma.transferProposal.count({ where: { status: 'proposed' } });

  // Forecast stock-deficiency alerts (SMA on footfall, in-memory, not persisted)
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const footfallRows = await prisma.dailyFootfallAggregate.findMany({
    where: { date: { gte: twoWeeksAgo, lte: now } },
    select: { phcId: true, outpatient: true, admissions: true, date: true },
  });
  const footfallByPhc = new Map<number, number[]>();
  for (const r of footfallRows) {
    const arr = footfallByPhc.get(r.phcId) ?? [];
    arr.push(r.outpatient + r.admissions);
    footfallByPhc.set(r.phcId, arr);
  }

  const forecastAlerts: ForecastAlert[] = [];
  let fId = -1;
  for (const p of phcs) {
    const patientsArr = footfallByPhc.get(p.id);
    const avgDailyPatients = patientsArr && patientsArr.length > 0
      ? patientsArr.reduce((s, v) => s + v, 0) / patientsArr.length
      : 25; // baseline fallback
    for (const inv of p.medicineInventories) {
      const per100 = inv.medicine.defaultDailyConsumptionPer100Patients || 10;
      const dailyRate = Math.max(0.01, (avgDailyPatients / 100) * per100);
      const dts = daysToShortfall(inv.currentQuantity, dailyRate, inv.medicine.reorderLevel);
      if (dts <= 14) {
        // Map days-of-shortfall window to actual Prisma AlertSeverity enum (info / warning / critical)
        // NB: we cannot invent 'low/moderate/high' here because the Prisma/DB enum only has 3 values.
        const severity: AlertSeverity =
          dts <= 3 ? AlertSeverity.critical :
          dts <= 8 ? AlertSeverity.warning : AlertSeverity.info;
        const urgencyLabel =
          severity === AlertSeverity.critical ? 'STOCKOUT IMMINENT' :
          severity === AlertSeverity.warning ? 'WARNING' : 'MONITOR';
        forecastAlerts.push({
          id: fId--,
          type: 'forecast',
          severity,
          message: `📈 Forecast · ${urgencyLabel}: ${inv.medicine.name} expected to hit reorder level (${inv.medicine.reorderLevel}) in ~${dts} days at ${avgDailyPatients.toFixed(0)} patients/day (current ${inv.currentQuantity}).`,
          createdAt: new Date(now.getTime() + dts * 24 * 60 * 60 * 1000 - 14 * 24 * 60 * 60 * 1000).toISOString(),
          phc: { id: p.id, name: p.name },
        });
      }
    }
  }
  forecastAlerts.sort((a, b) => {
    const order: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
    const sv = order[a.severity] - order[b.severity];
    if (sv !== 0) return sv;
    return a.createdAt < b.createdAt ? -1 : 1;
  });

  res.json({
    phcs: summaries,
    kpis,
    alerts: recentAlerts,
    forecastAlerts: forecastAlerts.slice(0, 20),
    transfers: { proposedCount },
  });
});

router.get('/medicines', async (_req: Request, res: Response) => {
  const inventories = await prisma.medicineInventory.findMany({
    include: { medicine: true, phc: { select: { id: true, name: true, city: true, totalBeds: true } } },
    orderBy: [{ phcId: 'asc' }, { medicineId: 'asc' }],
  });
  // Daily consumption from last 7 days for DoRS
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const consumptionRows = await prisma.medicineEvent.groupBy({
    by: ['phcId', 'medicineId'],
    where: { createdAt: { gte: sevenDaysAgo }, changeQty: { lt: 0 } },
    _sum: { changeQty: true },
    _count: { changeQty: true },
  });
  const keyRates = new Map<string, number>();
  for (const c of consumptionRows) {
    keyRates.set(`${c.phcId}-${c.medicineId}`, Math.max(0, -(c._sum.changeQty ?? 0) / 7));
  }
  const rows = inventories.map((inv) => {
    const daily = keyRates.get(`${inv.phcId}-${inv.medicineId}`) ??
      Math.max(0.01, (inv.phc?.totalBeds ?? inv.medicine.defaultDailyConsumptionPer100Patients / 10));
    const dors = Math.round((inv.currentQuantity / daily) * 10) / 10;
    let risk = 10;
    if (dors < 3) risk = 95;
    else if (dors < inv.medicine.daysOfStockWarning) risk = 72;
    else if (dors < 14) risk = 40;
    else if (dors < 30) risk = 20;
    // promote to critical if at/below criticalLevel
    if (inv.currentQuantity <= inv.medicine.criticalLevel) risk = Math.max(risk, 92);
    else if (inv.currentQuantity <= inv.medicine.reorderLevel) risk = Math.max(risk, 68);
    return {
      inventoryId: inv.id,
      phcId: inv.phcId,
      phcName: inv.phc?.name,
      city: inv.phc?.city,
      medicineId: inv.medicineId,
      medicineName: inv.medicine.name,
      category: inv.medicine.category,
      unit: inv.medicine.unit,
      currentQuantity: inv.currentQuantity,
      reorderLevel: inv.medicine.reorderLevel,
      criticalLevel: inv.medicine.criticalLevel,
      dailyRate: Math.round(daily * 100) / 100,
      dors,
      riskScore: risk,
      lastUpdated: inv.lastUpdated,
    };
  });
  res.json({ rows });
});

router.get('/beds', async (_req: Request, res: Response) => {
  const statuses = await prisma.phcStatus.findMany({
    include: { phc: { select: { id: true, name: true, city: true, totalBeds: true, totalStaff: true } } },
    orderBy: { phcId: 'asc' },
  });
  const rows = statuses.map((s) => ({
    phcId: s.phcId,
    name: s.phc?.name,
    city: s.phc?.city,
    bedsTotal: s.bedsTotal,
    bedsOccupied: s.bedsOccupied,
    bedsOccupiedPct: s.bedsTotal > 0 ? Math.round((s.bedsOccupied / s.bedsTotal) * 100) : 0,
    bedsEmergencyReserved: s.bedsEmergencyReserved,
    staffTotal: s.staffTotal,
    staffOnDuty: s.staffOnDuty,
    staffOnDutyPct: s.staffTotal > 0 ? Math.round((s.staffOnDuty / s.staffTotal) * 100) : 0,
    activeEmergency: s.activeEmergency,
    lastUpdated: s.lastUpdated,
  }));
  res.json({ rows });
});

router.get('/staff', async (_req: Request, res: Response) => {
  // per-PHC summary
  const statuses = await prisma.phcStatus.findMany({
    include: { phc: { select: { id: true, name: true } } },
    orderBy: { phcId: 'asc' },
  });
  // roster per PHC
  const rosters = await prisma.staffRoster.groupBy({
    by: ['phcId', 'isPresent', 'staffRole'],
    _count: { _all: true },
  });
  const fullRosters = await prisma.staffRoster.findMany({
    include: { phc: { select: { id: true, name: true } } },
    orderBy: [{ phcId: 'asc' }, { staffRole: 'asc' }],
  });
  res.json({
    summary: statuses.map((s) => ({
      phcId: s.phcId,
      name: s.phc?.name,
      staffTotal: s.staffTotal,
      staffOnDuty: s.staffOnDuty,
      staffOnDutyPct: s.staffTotal > 0 ? Math.round((s.staffOnDuty / s.staffTotal) * 100) : 0,
    })),
    rosterBreakdown: rosters,
    rosters: fullRosters,
  });
});

export default router;
