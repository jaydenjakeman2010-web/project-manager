import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, color, created_at FROM projects WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch projects:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/', validate(createSchema), async (req, res) => {
  const { name, color } = req.validatedBody;
  try {
    const { rows } = await db.query(
      'INSERT INTO projects (id, user_id, name, color) VALUES ($1, $2, $3, $4) RETURNING id, name, color, created_at',
      [uuid(), req.userId, name, color || '#1B5E3B']
    );
    await db.query(
      'INSERT INTO activity_logs (id, user_id, type, description) VALUES ($1, $2, $3, $4)',
      [uuid(), req.userId, 'project-created', `Created project "${name}"`]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Failed to create project:', err.message);
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
    const setClauses = [];
    const params = [];
    let idx = 1;

    if (updates.name !== undefined) { setClauses.push(`name = $${idx++}`); params.push(updates.name); }
    if (updates.color !== undefined) { setClauses.push(`color = $${idx++}`); params.push(updates.color); }

    params.push(id, req.userId);

    const { rows } = await db.query(
      `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING id, name, color, created_at`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to update project:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      'DELETE FROM projects WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    res.json({ deleted: rows[0].id });
  } catch (err) {
    console.error('Failed to delete project:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
