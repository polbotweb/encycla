import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { PlayerRecord } from '../persistence/repositories';
import { extractBearerToken, tokenHashesEqual, hashToken } from '../security/tokens';
import { SessionError, type SessionService } from '../services/session-service';
import { sendError } from './errors';

export function playerAuth(sessions: SessionService): RequestHandler {
  return (request: Request, response: Response, next: NextFunction) => {
    try {
      response.locals.player = sessions.authenticate(
        extractBearerToken(request.get('authorization')),
      ).player;
      next();
    } catch (error) {
      if (error instanceof SessionError) {
        sendError(response, 401, error.code, error.message);
        return;
      }
      next(error);
    }
  };
}

export function getPlayer(response: Response): PlayerRecord {
  return response.locals.player as PlayerRecord;
}

/** Admin routes: `Authorization: Bearer ADMIN_TOKEN`. Disabled entirely when no token is configured. */
export function adminAuth(adminToken: string | null): RequestHandler {
  const expected = adminToken ? hashToken(adminToken) : null;
  return (request: Request, response: Response, next: NextFunction) => {
    const token = extractBearerToken(request.get('authorization'));
    if (!token) {
      sendError(response, 401, 'AUTH_REQUIRED', 'Authentication is required.');
      return;
    }
    if (expected === null || !tokenHashesEqual(hashToken(token), expected)) {
      sendError(response, 403, 'FORBIDDEN', 'Admin access is required.');
      return;
    }
    next();
  };
}
