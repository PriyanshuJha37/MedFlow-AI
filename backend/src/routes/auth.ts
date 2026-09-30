import { Router, Request, Response } from 'express';
import * as bcrypt from 'bcrypt';
import { prisma } from '../prisma';
import { authenticate, requireRole, signToken } from '../middleware/auth';
import { LoginRequestSchema } from '../validators/auth';
import { Role } from '@prisma/client';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const parsed = LoginRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', issues: parsed.error.issues });
    return;
  }
  const { username, password } = parsed.data;
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      phcId: user.phcId ?? null,
      displayName: user.displayName,
    },
  });
});

router.get('/me', authenticate, requireRole(Role.admin, Role.phc_staff), (req: Request, res: Response) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  res.json({
    id: req.user.sub,
    username: req.user.username,
    role: req.user.role,
    phcId: req.user.phcId ?? null,
  });
});

export default router;
