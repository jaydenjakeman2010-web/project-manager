import { Router } from 'express';
import passport from '../auth/passport.js';
import { signToken } from '../auth/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/index.js';

const router = Router();

function issueToken(req, res) {
  if (!req.user) {
    return res.redirect('/?error=auth_failed');
  }
  const token = signToken({ sub: req.user.id });
  var redirectUrl = (process.env.CORS_ORIGIN || 'http://localhost:3001') + '/?token=' + encodeURIComponent(token);
  res.redirect(redirectUrl);
}

function hasStrategy(name) {
  try { return passport._strategies && name in passport._strategies; }
  catch { return false; }
}

function checkGoogleAuth(req, res, next) {
  if (!hasStrategy('google')) {
    return res.status(501).json({ error: 'Google OAuth is not configured.' });
  }
  next();
}

function checkGitHubAuth(req, res, next) {
  if (!hasStrategy('github')) {
    return res.status(501).json({ error: 'GitHub OAuth is not configured.' });
  }
  next();
}

router.get('/google', checkGoogleAuth, passport.authenticate('google', { session: false }));

router.get(
  '/google/callback',
  checkGoogleAuth,
  passport.authenticate('google', { session: false, failureRedirect: '/?error=google' }),
  issueToken
);

router.get('/github', checkGitHubAuth, passport.authenticate('github', { session: false }));

router.get(
  '/github/callback',
  checkGitHubAuth,
  passport.authenticate('github', { session: false, failureRedirect: '/?error=github' }),
  issueToken
);

router.get('/me', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, email, photo_url, created_at FROM users WHERE id = $1 LIMIT 1',
      [req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to fetch user:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
