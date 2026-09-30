import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../../middleware/auth';
import { enforcePhcScope, resolvePhcId } from '../../middleware/phcScope';
import { prisma } from '../../prisma';
import { AdjustBedsSchema } from '../../validators/staff';
import { adjustBeds } from '../../services/dualWrite';

const router = Router();
router.use(authenticate, requireRole(Role.admin, Role.phc_staff), enforcePhcScope());

router.get('/status', async (req: Request, res: Response) => {
  const phcId = resolvePhcId(req);
  const where = phcId ? { phcId } : {};
  const rows = await prisma.phcStatus.findMany({
    where,
    include: { phc: { select: { id: true, name: true } } },
  });
  res.json({ rows });
});

router.post('/adjust', async (req: Request, res: Response) => {
  const parsed = AdjustBedsSchema.safeParse(req.body);
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
    const result = await prisma.$transaction(async (tx) => {
      return adjustBeds(tx, phcId, body.occupiedDelta, body.reason, req.user?.sub ?? null);
    });
    res.json({
      ok: true,
      eventId: result.event.id,
      bedsOccupied: result.status.bedsOccupied,
      bedsTotal: result.status.bedsTotal,
    });
  } catch (e: any) {
    res.status(400).json({ error: 'Bed adjustment failed', message: e?.message ?? String(e) });
  }
});

export default router;
