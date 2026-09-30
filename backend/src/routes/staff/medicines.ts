import { Router, Request, Response } from 'express';
import { Role } from '@prisma/client';
import { authenticate, requireRole } from '../../middleware/auth';
import { enforcePhcScope, resolvePhcId } from '../../middleware/phcScope';
import { prisma } from '../../prisma';
import { AdjustMedicineSchema } from '../../validators/medicine';
import { adjustMedicineInventory } from '../../services/dualWrite';

const router = Router();

router.use(authenticate, requireRole(Role.admin, Role.phc_staff), enforcePhcScope());

router.get('/', async (req: Request, res: Response) => {
  const phcId = resolvePhcId(req);
  if (!phcId && req.user?.role === Role.phc_staff) {
    res.status(403).json({ error: 'Forbidden', message: 'Staff must be assigned to a PHC' });
    return;
  }
  const where = phcId ? { phcId } : {};
  const rows = await prisma.medicineInventory.findMany({
    where,
    include: { medicine: true, phc: { select: { id: true, name: true } } },
    orderBy: [{ phcId: 'asc' }, { medicineId: 'asc' }],
  });
  res.json({ rows });
});

router.post('/adjust', async (req: Request, res: Response) => {
  const parsed = AdjustMedicineSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }
  const body = parsed.data;
  const phcId = resolvePhcId(req, body.phcId);
  if (!phcId) {
    res.status(400).json({ error: 'phcId is required for admin requests' });
    return;
  }
  try {
    const result = await prisma.$transaction(async (tx) => {
      return adjustMedicineInventory(
        tx,
        phcId,
        body.medicineId,
        body.delta,
        body.reason,
        req.user?.sub ?? null,
        { referenceId: body.referenceId }
      );
    });
    res.json({
      ok: true,
      inventoryId: result.inventory.id,
      newQuantity: result.inventory.currentQuantity,
      eventId: result.event.id,
    });
  } catch (e: any) {
    res.status(400).json({ error: 'Adjustment failed', message: e?.message ?? String(e) });
  }
});

export default router;
