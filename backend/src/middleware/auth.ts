import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { config } from '../config';
import { prisma } from '../prisma';

export interface JWTPayload {
  sub: number;        // user id
  role: Role;
  phcId?: number;
  username: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JWTPayload & { dbRole: Role };
    }
  }
}

export function signToken(u: { id: number; username: string; role: Role; phcId?: number | null }): string {
  const payload: object & JWTPayload = {
    sub: u.id,
    role: u.role,
    phcId: u.phcId ?? undefined,
    username: u.username,
  } as object & JWTPayload;
  return jwt.sign(payload as object, config.jwtSecret as jwt.Secret, {
    expiresIn: config.jwtExpiry as any,
  });
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized', message: 'Missing bearer token' });
    return;
  }
  const token = header.slice(7);
  try {
    const decoded = jwt.verify(token, config.jwtSecret as jwt.Secret) as unknown as JWTPayload;
    // Ensure user still exists in DB (cheap check; accept cached payload otherwise)
    const user = await prisma.user.findUnique({ where: { id: decoded.sub }, select: { id: true, role: true, phcId: true, username: true } });
    if (!user) {
      res.status(401).json({ error: 'Unauthorized', message: 'User not found' });
      return;
    }
    req.user = {
      sub: user.id,
      role: user.role,
      phcId: user.phcId ?? undefined,
      username: user.username,
      dbRole: user.role,
    };
    next();
  } catch (e: any) {
    res.status(401).json({ error: 'Unauthorized', message: e?.message || 'Invalid token' });
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden', message: `Required roles: ${roles.join(',')}` });
      return;
    }
    next();
  };
}
