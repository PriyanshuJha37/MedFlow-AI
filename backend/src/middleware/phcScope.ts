import { Request, Response, NextFunction } from 'express';

/**
 * Returns the scoped phcId for the current request.
 * - Staff: always their assigned phcId (any phcId in body/params is ignored; mismatches cause 403).
 * - Admin: phcId from body/query/params (if provided), or undefined for "all".
 */
export function resolvePhcId(req: Request, explicitPhcId?: number | string | null): number | null {
  if (!req.user) return null;
  if (req.user.role === 'phc_staff') return req.user.phcId ?? null;
  // admin
  if (explicitPhcId === undefined || explicitPhcId === null || explicitPhcId === '') return null;
  const n = typeof explicitPhcId === 'string' ? parseInt(explicitPhcId, 10) : explicitPhcId;
  if (Number.isNaN(n)) return null;
  return n;
}

/**
 * Middleware: if user is staff, ensures the request does NOT attempt to target another PHC.
 * If the request carries phcId in body/query/params and it differs from the staff's assigned phcId, → 403.
 */
export function enforcePhcScope(
  opts: { paramName?: string; bodyName?: string; queryName?: string } = {}
) {
  const { paramName, bodyName = 'phcId', queryName = 'phcId' } = opts;
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    if (req.user.role === 'admin') return next();
    const staffPhc = req.user.phcId;
    if (!staffPhc) {
      res.status(403).json({ error: 'Forbidden', message: 'Staff user has no assigned PHC' });
      return;
    }
    const candidates: (string | number | undefined)[] = [];
    if (paramName) candidates.push(req.params[paramName]);
    if (bodyName && req.body) candidates.push((req.body as any)[bodyName]);
    if (queryName && req.query) candidates.push((req.query as any)[queryName]);
    for (const c of candidates) {
      if (c === undefined || c === null || c === '') continue;
      const n = typeof c === 'string' ? parseInt(c, 10) : c;
      if (!Number.isNaN(n) && n !== staffPhc) {
        res.status(403).json({ error: 'Forbidden', message: 'Staff can only access their assigned PHC' });
        return;
      }
    }
    next();
  };
}
