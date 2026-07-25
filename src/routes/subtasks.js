import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

const createSchema = z.object({
  task_id: z.string().uuid(),
  text: z.string().min(1).max(500),
});

const updateSchema = z.object({
  text: z.string().min(1).max(500).optional(),
  done: z.boolean().optional(),
});

router.use(requireAuth);

router.post('/', validate(createSchema), async (req, res) => {
  const { task_id, text } = req.validatedBody;
  try {
    const { rows: [task] } = await db.query(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
      [task_id, req.userId]
    );
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const { rows } = await db.query(
      'INSERT INTO subtasks (id, task_id, text, done) VALUES ($1, $2, $3, $4) RETURNING id, task_id, text, done',
      [uuid(), task_id, text, false]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Failed to create subtask:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  const { id } = req.params;
  const updates = req.validatedBody;
  try {
    const setClauses = []; const params = []; let idx = 1;
    if (updates.text !== undefined) { setClauses.push(`text = $${idx++}`); params.push(updates.text); }
    if (updates.done !== undefined) { setClauses.push(`done = $${idx++}`); params.push(updates.done); }
    if (setClauses.length === 0) return res.status(422).json({ error: 'No fields to update.' });
    params.push(id);
    const { rows } = await db.query(
      `UPDATE subtasks SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING id, task_id, text, done`,
      params
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Subtask not found.' });
    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to update subtask:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      'DELETE FROM subtasks WHERE id = $1 RETURNING id',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Subtask not found.' });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    console.error('Failed to delete subtask:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
