import { verifyToken } from '../auth/jwt.js';

export function requireAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Authorization header must be: Bearer <token>' });
  }

  const token = parts[1];

  try {
    const payload = verifyToken(token);
    req.userId = payload.sub;
    req.userEmail = payload.email;
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired. Please sign in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }
    return res.status(401).json({ error: 'Authentication failed.' });
  }
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;

  if (!header) {
    req.userId = null;
    return next();
  }

  const parts = header.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    req.userId = null;
    return next();
  }

  try {
    const payload = verifyToken(parts[1]);
    req.userId = payload.sub;
  } catch {
    req.userId = null;
  }
  next();
}
