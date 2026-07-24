import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { signToken } from '../auth/jwt.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';
import email from '../email.js';

var router = Router();

var signupSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

var loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

var verifySchema = z.object({
  token: z.string().uuid(),
});

var forgotSchema = z.object({
  email: z.string().email(),
});

var resetSchema = z.object({
  token: z.string().uuid(),
  password: z.string().min(8).max(128),
});

router.post('/signup', validate(signupSchema), async function (req, res) {
  try {
    var { name, email: emailAddr, password } = req.validatedBody;

    var { rows: existing } = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [emailAddr]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    var passwordHash = await bcrypt.hash(password, 12);
    var verificationToken = uuid();
    var expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    var { rows } = await db.query(
      `INSERT INTO users (id, name, email, password_hash, verification_token, verification_token_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, name, email`,
      [uuid(), name, emailAddr.toLowerCase(), passwordHash, verificationToken, expiresAt]
    );

    var baseUrl = process.env.CORS_ORIGIN || 'http://localhost:3001';
    var verifyLink = baseUrl + '/verify?token=' + verificationToken;

    email.sendEmail(
      emailAddr,
      'Verify your Project Manager account',
      email.buildVerifyEmail(verifyLink)
    ).catch(function (err) {
      console.error('Failed to send verification email:', err.message);
    });

    res.status(201).json({
      message: 'Account created. Check your email for a verification link.',
      userId: rows[0].id,
    });
  } catch (err) {
    console.error('Signup failed:', err);
    console.error('Stack:', err.stack);
    res.status(500).json({ error: 'Internal server error. Check server logs for details.' });
  }
});

router.post('/login', validate(loginSchema), async function (req, res) {
  try {
    var { email: emailAddr, password } = req.validatedBody;

    var { rows } = await db.query(
      'SELECT id, name, email, password_hash, email_verified FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [emailAddr]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    var user = rows[0];

    var passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (!user.email_verified) {
      return res.status(403).json({ error: 'Please verify your email before signing in.' });
    }

    var token = signToken({ sub: user.id });
    res.json({ token: token, userId: user.id });
  } catch (err) {
    console.error('Login failed:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/verify', validate(verifySchema), async function (req, res) {
  try {
    var { token } = req.validatedBody;

    var { rows } = await db.query(
      `SELECT id FROM users
       WHERE verification_token = $1
       AND verification_token_expires_at > NOW()
       AND email_verified = FALSE
       LIMIT 1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired verification token.' });
    }

    await db.query(
      `UPDATE users SET email_verified = TRUE, verification_token = NULL, verification_token_expires_at = NULL
       WHERE id = $1`,
      [rows[0].id]
    );

    res.json({ message: 'Email verified. You can now sign in.' });
  } catch (err) {
    console.error('Verification failed:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/forgot', validate(forgotSchema), async function (req, res) {
  try {
    var { email: emailAddr } = req.validatedBody;

    var { rows } = await db.query(
      'SELECT id, email FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1',
      [emailAddr]
    );

    if (rows.length === 0) {
      return res.json({ message: 'If that email is registered, you will receive a password reset link.' });
    }

    var resetToken = uuid();
    var expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await db.query(
      'UPDATE users SET reset_token = $1, reset_token_expires_at = $2 WHERE id = $3',
      [resetToken, expiresAt, rows[0].id]
    );

    var baseUrl = process.env.CORS_ORIGIN || 'http://localhost:3001';
    var resetLink = baseUrl + '/reset?token=' + resetToken;

    email.sendEmail(
      emailAddr,
      'Reset your Project Manager password',
      email.buildResetEmail(resetLink)
    ).catch(function (err) {
      console.error('Failed to send reset email:', err.message);
    });

    res.json({ message: 'If that email is registered, you will receive a password reset link.' });
  } catch (err) {
    console.error('Forgot password failed:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/reset', validate(resetSchema), async function (req, res) {
  try {
    var { token, password } = req.validatedBody;

    var { rows } = await db.query(
      `SELECT id FROM users
       WHERE reset_token = $1
       AND reset_token_expires_at > NOW()
       LIMIT 1`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset token.' });
    }

    var passwordHash = await bcrypt.hash(password, 12);

    await db.query(
      'UPDATE users SET password_hash = $1, reset_token = NULL, reset_token_expires_at = NULL WHERE id = $2',
      [passwordHash, rows[0].id]
    );

    res.json({ message: 'Password reset successful. You can now sign in with your new password.' });
  } catch (err) {
    console.error('Password reset failed:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.get('/me', requireAuth, async function (req, res) {
  try {
    var { rows } = await db.query(
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
