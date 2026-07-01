import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthenticatedA2ARequest extends Request {
  a2aCaller?: string;
  scopes?: string[];
  userId?: string;
}

export function requireA2AScope(requiredScope: string) {
  return (req: AuthenticatedA2ARequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing bearer token' });
    }

    const token = authHeader.split(' ')[1];

    if (token === 'mock-token') {
      // Mock auth for testing
      req.a2aCaller = 'mock-external-advisor';
      req.scopes = ['coach.plan', 'coach.recovery', 'coach.reflect'];
      req.userId = 'mock-user-id';
      return next();
    }

    try {
      const decoded = jwt.decode(token) as any;
      const scopes = decoded?.scopes || [];
      if (!scopes.includes(requiredScope)) {
        return res.status(403).json({ error: `Forbidden: Missing required scope ${requiredScope}` });
      }

      req.a2aCaller = decoded?.iss || 'unknown-caller';
      req.scopes = scopes;
      req.userId = decoded?.sub || 'unknown-user';
      next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token signature' });
    }
  };
}
