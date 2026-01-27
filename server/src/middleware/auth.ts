import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';

export interface AuthRequest extends Request {
  userId?: string;
}

export const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const auth = getAuth(req);

  if (!auth.userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  req.userId = auth.userId;
  next();
};

export const optionalAuth = (req: AuthRequest, _res: Response, next: NextFunction) => {
  const auth = getAuth(req);
  req.userId = auth.userId || undefined;
  next();
};
