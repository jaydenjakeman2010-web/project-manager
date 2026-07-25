import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1).max(200),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  time: z.string().optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  time: z.string().optional(),
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, name, date, time, created_at FROM events WHERE user_id = $1 ORDER BY date ASC, time ASC',
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch events:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/', validate(createSchema), async (req, res) => {
  const { name, date, time } = req.validatedBody;
  try {
    const { rows } = await db.query(
      'INSERT INTO events (id, user_id, name, date, time) VALUES ($1, $2, $3, $4, $5) RETURNING id, name, date, time, created_at',
      [uuid(), req.userId, name, date, time || '09:00']
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Failed to create event:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  const { id } = req.params;
  const updates = req.validatedBody;
  try {
    const setClauses = []; const params = []; let idx = 1;
    if (updates.name !== undefined) { setClauses.push(`name = $${idx++}`); params.push(updates.name); }
    if (updates.date !== undefined) { setClauses.push(`date = $${idx++}`); params.push(updates.date); }
    if (updates.time !== undefined) { setClauses.push(`time = $${idx++}`); params.push(updates.time); }
    if (setClauses.length === 0) return res.status(422).json({ error: 'No fields to update.' });
    params.push(id, req.userId);
    const { rows } = await db.query(
      `UPDATE events SET ${setClauses.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING id, name, date, time`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Event not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to update event:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      'DELETE FROM events WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, req.userId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Event not found.' });
    }
    res.json({ deleted: rows[0].id });
  } catch (err) {
    console.error('Failed to delete event:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
