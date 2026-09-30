import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../../middleware/auth';
import { enforcePhcScope, resolvePhcId } from '../../middleware/phcScope';
import { prisma } from '../../prisma';
import { FootfallDeltasSchema } from '../../validators/footfall';
import { recordFootfall, startOfDay } from '../../services/dualWrite';

const router = Router();
router.use(authenticate, requireRole(Role.admin, Role.phc_staff), enforcePhcScope());

router.get('/today', async (req: Request, res: Response) => {
  const phcId = resolvePhcId(req);
  if (!phcId && req.user?.role === Role.phc_staff) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const where = phcId ? { phcId } : {};
  const today = startOfDay();
  const rows = await prisma.dailyFootfallAggregate.findMany({
    where: { ...where, date: { gte: today } },
    include: { phc: { select: { id: true, name: true } } },
  });
  res.json({ rows, date: today.toISOString() });
});

router.post('/', async (req: Request, res: Response) => {
  const parsed = FootfallDeltasSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }
  const body = parsed.data;
  const phcId = resolvePhcId(req, body.phcId);
  if (!phcId) {
    res.status(400).json({ error: 'phcId is required' });
    return;
  }
  try {
    const evt = await prisma.$transaction(async (tx) => {
      return recordFootfall(tx, phcId, body, body.source, req.user?.sub ?? null);
    });
    res.json({ ok: true, eventId: evt.id });
  } catch (e: any) {
    res.status(400).json({ error: 'Footfall record failed', message: e?.message ?? String(e) });
  }
});

export default router;
