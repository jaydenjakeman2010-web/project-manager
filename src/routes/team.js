import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  role: z.enum(['Owner', 'Admin', 'Member']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  photo_url: z.string().url().optional().nullable(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  role: z.enum(['Owner', 'Admin', 'Member']).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  photo_url: z.string().url().optional().nullable(),
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, role, color, photo_url FROM team_members WHERE user_id = $1 ORDER BY created_at ASC',
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch team members:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/', validate(createSchema), async (req, res) => {
  const { name, role, color, photo_url } = req.validatedBody;
  try {
    const { rows } = await db.query(
      'INSERT INTO team_members (id, user_id, name, role, color, photo_url) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, name, role, color, photo_url',
      [uuid(), req.userId, name, role || 'Member', color || '#1B5E3B', photo_url || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Failed to create team member:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  const { id } = req.params;
  const updates = req.validatedBody;

  if (Object.keys(updates).length === 0) {
    return res.status(422).json({ error: 'No fields to update.' });
  }

  try {
    const allowedFields = ['name', 'role', 'color', 'photo_url'];
    const setClauses = [];
    const params = [];
    let idx = 1;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        setClauses.push(`${key} = $${idx++}`);
        params.push(value !== undefined ? value : null);
      }
    }

    if (setClauses.length === 0) {
      return res.status(422).json({ error: 'No valid fields to update.' });
    }

    params.push(id, req.userId);

    const { rows } = await db.query(
      `UPDATE team_members SET ${setClauses.join(', ')} WHERE id = $${idx++} AND user_id = $${idx}
       RETURNING id, name, role, color, photo_url`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to update team member:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await db.query(
      'UPDATE tasks SET assignee_id = NULL WHERE assignee_id = $1 AND user_id = $2',
      [id, req.userId]
    );
    const { rows } = await db.query(
      'DELETE FROM team_members WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Team member not found.' });
    }
    res.json({ deleted: rows[0].id });
  } catch (err) {
    console.error('Failed to delete team member:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
