import { Router, Request, Response } from 'express';
import { Role, StaffRole } from '@prisma/client';
import { authenticate, requireRole } from '../../middleware/auth';
import { enforcePhcScope, resolvePhcId } from '../../middleware/phcScope';
import { prisma } from '../../prisma';
import { MarkAttendanceSchema, EmergencyCreateSchema, EmergencyResolveSchema, RoleChangeSchema } from '../../validators/staff';
import { markAttendance, reportEmergency, resolveEmergency } from '../../services/dualWrite';

const router = Router();
router.use(authenticate, requireRole(Role.admin, Role.phc_staff));

// Attendance
router.get('/attendance', enforcePhcScope(), async (req: Request, res: Response) => {
  const phcId = resolvePhcId(req);
  if (!phcId && req.user?.role === Role.phc_staff) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }
  const where = phcId ? { phcId } : {};
  const rows = await prisma.staffRoster.findMany({
    where,
    include: { phc: { select: { id: true, name: true } } },
    orderBy: [{ phcId: 'asc' }, { staffRole: 'asc' }, { staffMemberName: 'asc' }],
  });
  res.json({ rows });
});

router.post('/attendance/:rosterId', enforcePhcScope(), async (req: Request, res: Response) => {
  const rosterId = parseInt(req.params.rosterId, 10);
  if (Number.isNaN(rosterId)) {
    res.status(400).json({ error: 'rosterId invalid' });
    return;
  }
  const parsed = MarkAttendanceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }
  const phcId = resolvePhcId(req);
  if (!phcId) {
    // Admin must scope; read the roster itself and use its phcId, but require admin
    if (req.user?.role !== Role.admin) {
      res.status(400).json({ error: 'phcId is required' });
      return;
    }
    const r = await prisma.staffRoster.findUnique({ where: { id: rosterId }, select: { phcId: true } });
    if (!r) { res.status(404).json({ error: 'Roster not found' }); return; }
    // eslint-disable-next-line no-param-reassign
    const actualPhcId = r.phcId;
    try {
      const result = await prisma.$transaction((tx) =>
        markAttendance(tx, actualPhcId, rosterId, parsed.data.isPresent, req.user!.sub)
      );
      res.json({ ok: true, eventId: result.event.id, presentCount: result.presentCount, isPresent: result.roster.isPresent });
    } catch (e: any) {
      res.status(400).json({ error: 'Attendance update failed', message: e?.message ?? String(e) });
    }
    return;
  }
  if (!req.user?.sub) { res.status(401).json({ error: 'Unauthorized' }); return; }
  try {
    const result = await prisma.$transaction((tx) =>
      markAttendance(tx, phcId, rosterId, parsed.data.isPresent, req.user!.sub)
    );
    res.json({ ok: true, eventId: result.event.id, presentCount: result.presentCount, isPresent: result.roster.isPresent });
  } catch (e: any) {
    res.status(400).json({ error: 'Attendance update failed', message: e?.message ?? String(e) });
  }
});

// Emergency
router.get('/emergencies', enforcePhcScope(), async (req: Request, res: Response) => {
  const phcId = resolvePhcId(req);
  const where = phcId ? { phcId } : {};
  const rows = await prisma.emergencyEvent.findMany({
    where,
    orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }],
    include: { phc: { select: { id: true, name: true } } },
    take: 100,
  });
  res.json({ rows });
});

router.post('/emergency', enforcePhcScope(), async (req: Request, res: Response) => {
  const parsed = EmergencyCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }
  const body = parsed.data;
  const phcId = resolvePhcId(req, body.phcId);
  if (!phcId || !req.user?.sub) { res.status(400).json({ error: 'phcId + authenticated user required' }); return; }
  try {
    const evt = await prisma.$transaction((tx) =>
      reportEmergency(tx, phcId, body.type, body.severity, body.patientCount, req.user!.sub, body.notes ?? null)
    );
    res.json({ ok: true, eventId: evt.id, isActive: evt.isActive });
  } catch (e: any) {
    res.status(400).json({ error: 'Emergency report failed', message: e?.message ?? String(e) });
  }
});

router.post('/emergency/:id/resolve', enforcePhcScope(), async (req: Request, res: Response) => {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) { res.status(400).json({ error: 'id invalid' }); return; }
  if (!req.user?.sub) { res.status(401).json({ error: 'Unauthorized' }); return; }
  const _parsed = EmergencyResolveSchema.safeParse(req.body);
  let phcId = resolvePhcId(req);
  // Admin without explicit phcId — look up the emergency's PHC from DB
  if (!phcId && req.user.role === Role.admin) {
    const em = await prisma.emergencyEvent.findUnique({ where: { id }, select: { phcId: true } });
    if (!em) { res.status(404).json({ error: 'Emergency not found' }); return; }
    phcId = em.phcId;
  }
  if (!phcId) { res.status(400).json({ error: 'phcId required' }); return; }
  try {
    const evt = await prisma.$transaction((tx) =>
      resolveEmergency(tx, phcId!, id, req.user!.sub)
    );
    res.json({ ok: true, eventId: evt.id, isActive: evt.isActive });
  } catch (e: any) {
    res.status(400).json({ error: 'Emergency resolve failed', message: e?.message ?? String(e) });
  }
});

// Role / department change (FR-11)
router.post('/roster/:rosterId/role', enforcePhcScope(), async (req: Request, res: Response) => {
  const rosterId = parseInt(req.params.rosterId, 10);
  if (Number.isNaN(rosterId)) {
    res.status(400).json({ error: 'rosterId invalid' });
    return;
  }
  const parsed = RoleChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }
  const roster = await prisma.staffRoster.findUnique({
    where: { id: rosterId },
    select: { phcId: true, staffMemberName: true, staffRole: true, isPresent: true, lastMarked: true, id: true },
  });
  if (!roster) {
    res.status(404).json({ error: 'Roster not found' });
    return;
  }
  // Self-scope enforcement: phc_staff may only edit THEIR OWN roster row (matched by displayName + phcId)
  if (req.user?.role === Role.phc_staff) {
    const selfUser = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { displayName: true, phcId: true },
    });
    if (!selfUser) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    const nameMatches = selfUser.displayName && roster.staffMemberName
      ? selfUser.displayName.trim().toUpperCase() === roster.staffMemberName.trim().toUpperCase()
      : false;
    const phcMatches = selfUser.phcId && roster.phcId === selfUser.phcId;
    if (!nameMatches || !phcMatches) {
      res.status(403).json({ error: 'Forbidden', message: 'Staff can only change their own assigned department / role.' });
      return;
    }
  }
  // Scope enforcement: phc_staff may only edit own PHC roster rows
  if (req.user?.role === Role.phc_staff && req.user.phcId && roster.phcId !== req.user.phcId) {
    res.status(403).json({ error: 'Forbidden', message: 'Cannot modify another PHC\'s roster' });
    return;
  }
  if (parsed.data.staffRole === (roster.staffRole as StaffRole)) {
    // no-op: unchanged
    res.json({ ok: true, updated: false, roster, presentCount: 0 });
    return;
  }
  const now = new Date();
  const updated = await prisma.staffRoster.update({
    where: { id: rosterId },
    data: { staffRole: parsed.data.staffRole, lastMarked: now },
  });
  const presentCount = await prisma.staffRoster.count({
    where: { phcId: roster.phcId, isPresent: true },
  });
  res.json({
    ok: true,
    updated: true,
    roster: { ...updated, phcId: roster.phcId },
    presentCount,
  });
});

export default router;
