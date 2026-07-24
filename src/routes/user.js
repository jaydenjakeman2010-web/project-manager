import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';

const router = Router();

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  email: z.string().email().optional().nullable(),
  photo_url: z.string().url().optional().nullable(),
});

router.use(requireAuth);

router.get('/', async (req, res) => {
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

router.patch('/', validate(updateSchema), async (req, res) => {
  const updates = req.validatedBody;

  if (Object.keys(updates).length === 0) {
    return res.status(422).json({ error: 'No fields to update.' });
  }

  try {
    const setClauses = [];
    const params = [];
    let idx = 1;

    if (updates.name !== undefined) { setClauses.push(`name = $${idx++}`); params.push(updates.name); }
    if (updates.email !== undefined) { setClauses.push(`email = $${idx++}`); params.push(updates.email); }
    if (updates.photo_url !== undefined) { setClauses.push(`photo_url = $${idx++}`); params.push(updates.photo_url); }

    params.push(req.userId);

    const { rows } = await db.query(
      `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id, name, email, photo_url, created_at`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to update user:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
