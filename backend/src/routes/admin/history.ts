import { Router, Request, Response } from 'express';
import { prisma } from '../../prisma';

const router = Router();

interface SeriesPoint { date: string; [k: string]: any }

function dayKey(d: Date) {
  // YYYY-MM-DD in local time
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function buildDateRange(days: number): string[] {
  const out: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

/** GET /history/footfall?phcId=all|id&days=30&bucket=day */
router.get('/footfall', async (req: Request, res: Response) => {
  const daysRaw = parseInt(req.query.days as string || '30', 10);
  const days = Math.max(1, Math.min(90, Number.isNaN(daysRaw) ? 30 : daysRaw));
  const phcRaw = req.query.phcId as string | undefined;
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);

  const allPhcs = await prisma.phc.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true } });
  const filterPhcIds: number[] | null = (phcRaw && phcRaw !== 'all')
    ? [parseInt(phcRaw, 10)]
    : null;

  const events = await prisma.footfallEvent.findMany({
    where: {
      createdAt: { gte: since },
      ...(filterPhcIds ? { phcId: { in: filterPhcIds } } : {}),
    },
    orderBy: { createdAt: 'asc' },
  });

  const dateRange = buildDateRange(days);
  const perPhcSeries = new Map<number, Map<string, { outpatient: number; admissions: number; discharges: number; mild: number; moderate: number; severe: number }>>();
  const aggregate = new Map<string, { outpatient: number; admissions: number; discharges: number; mild: number; moderate: number; severe: number }>();
  for (const k of dateRange) aggregate.set(k, { outpatient: 0, admissions: 0, discharges: 0, mild: 0, moderate: 0, severe: 0 });
  for (const p of allPhcs) {
    if (filterPhcIds && !filterPhcIds.includes(p.id)) continue;
    const m = new Map<string, any>();
    for (const k of dateRange) m.set(k, { outpatient: 0, admissions: 0, discharges: 0, mild: 0, moderate: 0, severe: 0 });
    perPhcSeries.set(p.id, m);
  }
  for (const e of events) {
    const k = dayKey(e.createdAt);
    if (!aggregate.has(k)) continue;
    const agg = aggregate.get(k)!;
    agg.outpatient += e.outpatientDelta;
    agg.admissions += e.admissionsDelta;
    agg.discharges += e.dischargesDelta;
    agg.mild += e.triageMildDelta;
    agg.moderate += e.triageModerateDelta;
    agg.severe += e.triageSevereDelta;
    if (perPhcSeries.has(e.phcId)) {
      const pm = perPhcSeries.get(e.phcId)!;
      if (!pm.has(k)) pm.set(k, { outpatient: 0, admissions: 0, discharges: 0, mild: 0, moderate: 0, severe: 0 });
      const row = pm.get(k)!;
      row.outpatient += e.outpatientDelta;
      row.admissions += e.admissionsDelta;
      row.discharges += e.dischargesDelta;
      row.mild += e.triageMildDelta;
      row.moderate += e.triageModerateDelta;
      row.severe += e.triageSevereDelta;
    }
  }
  const toArr = (map: Map<string, any>): SeriesPoint[] => dateRange.map((d) => ({ date: d, ...map.get(d) }));
  const byPhc: { phcId: number; phcName: string; series: SeriesPoint[] }[] = [];
  for (const p of allPhcs) {
    if (filterPhcIds && !filterPhcIds.includes(p.id)) continue;
    byPhc.push({ phcId: p.id, phcName: p.name, series: toArr(perPhcSeries.get(p.id)!) });
  }
  res.json({
    days,
    bucket: 'day',
    phcId: phcRaw || 'all',
    aggregate: toArr(aggregate),
    byPhc,
  });
});

/** GET /history/medicine/:medicineId?phcId=all&days=30 */
router.get('/medicine/:medicineId', async (req: Request, res: Response) => {
  const medicineId = parseInt(req.params.medicineId, 10);
  if (Number.isNaN(medicineId)) { res.status(400).json({ error: 'medicineId invalid' }); return; }
  const days = Math.max(3, Math.min(90, parseInt(req.query.days as string || '30', 10)));
  const phcRaw = req.query.phcId as string | undefined;
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  since.setHours(0, 0, 0, 0);
  const allPhcs = await prisma.phc.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true } });
  const filterPhcIds = (phcRaw && phcRaw !== 'all') ? [parseInt(phcRaw, 10)] : null;
  const events = await prisma.medicineEvent.findMany({
    where: { medicineId, createdAt: { gte: since }, ...(filterPhcIds ? { phcId: { in: filterPhcIds } } : {}) },
    orderBy: { createdAt: 'asc' },
  });
  const dateRange = buildDateRange(days);
  const perPhcCons = new Map<number, Map<string, number>>();
  const agg = new Map<string, number>();
  for (const d of dateRange) { agg.set(d, 0); }
  for (const p of allPhcs) {
    if (filterPhcIds && !filterPhcIds.includes(p.id)) continue;
    const m = new Map<string, number>();
    for (const d of dateRange) m.set(d, 0);
    perPhcCons.set(p.id, m);
  }
  for (const e of events) {
    const k = dayKey(e.createdAt);
    const consumed = e.changeQty < 0 ? -e.changeQty : 0;
    if (agg.has(k)) agg.set(k, (agg.get(k) || 0) + consumed);
    if (perPhcCons.has(e.phcId)) {
      const m = perPhcCons.get(e.phcId)!;
      if (m.has(k)) m.set(k, (m.get(k) || 0) + consumed);
    }
  }
  const med = await prisma.medicine.findUnique({ where: { id: medicineId } });
  res.json({
    medicine: med,
    days,
    aggregate: dateRange.map((d) => ({ date: d, consumption: agg.get(d) || 0 })),
    byPhc: Array.from(perPhcCons.entries()).map(([phcId, m]) => ({
      phcId,
      phcName: allPhcs.find(p => p.id === phcId)?.name || String(phcId),
      series: dateRange.map((d) => ({ date: d, consumption: m.get(d) || 0 })),
    })),
  });
});

/** GET /history/beds?days=7&phcId=all — daily peak occupied per PHC */
router.get('/beds', async (req: Request, res: Response) => {
  const days = Math.max(1, Math.min(60, parseInt(req.query.days as string || '7', 10)));
  const since = new Date();
  since.setDate(since.getDate() - (days - 1));
  const allPhcs = await prisma.phc.findMany({ select: { id: true, name: true } });
  // Use phc_status for current; for history use daily-aggregate of bed_events net deltas seeded against current baseline
  const statuses = await prisma.phcStatus.findMany({ select: { phcId: true, bedsOccupied: true, bedsTotal: true } });
  const events = await prisma.bedEvent.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
  });
  const dateRange = buildDateRange(days);
  const byPhc = new Map<number, Map<string, number>>();
  for (const p of allPhcs) {
    const baseline = statuses.find(s => s.phcId === p.id)?.bedsOccupied ?? 0;
    // Walk backwards; start from baseline today and subtract events going back
    const daily = new Map<string, number>();
    for (const d of dateRange) daily.set(d, baseline);
    // Only use today's events for peak tracking; simpler: set all days to baseline +/- walking window
    // (Full history reconstruction not required per prototype; store baseline in every day for charting)
    // Compute delta sum per day per phc since window start
    const perDayDelta = new Map<string, number>();
    for (const d of dateRange) perDayDelta.set(d, 0);
    for (const e of events) {
      if (e.phcId !== p.id) continue;
      const k = dayKey(e.createdAt);
      if (perDayDelta.has(k)) perDayDelta.set(k, (perDayDelta.get(k) || 0) + e.occupiedDelta);
    }
    let running = baseline;
    const today = dayKey(new Date());
    for (let i = dateRange.length - 1; i >= 0; i--) {
      const d = dateRange[i];
      // For past days subtract the delta before assigning so we reconstruct the occupied count at the start of the day
      if (d !== today) running -= perDayDelta.get(d) || 0;
      daily.set(d, Math.max(0, running));
      // For today, subtract after assigning (baseline is current value which already includes today's events)
      if (d === today) running -= perDayDelta.get(d) || 0;
    }
    byPhc.set(p.id, daily);
  }
  res.json({
    days,
    byPhc: allPhcs.map(p => ({
      phcId: p.id,
      phcName: p.name,
      bedsTotal: statuses.find(s => s.phcId === p.id)?.bedsTotal ?? 0,
      series: dateRange.map(d => ({ date: d, bedsOccupied: byPhc.get(p.id)?.get(d) ?? 0 })),
    })),
  });
});

export default router;
