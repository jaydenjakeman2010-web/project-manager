import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';

const router = Router();

const createSchema = z.object({
  task_id: z.string().uuid(),
  text: z.string().min(1).max(2000),
  author: z.string().min(1).max(200),
});

router.use(requireAuth);

router.post('/', validate(createSchema), async (req, res) => {
  const { task_id, text, author } = req.validatedBody;
  try {
    const { rows: [task] } = await db.query(
      'SELECT id FROM tasks WHERE id = $1 AND user_id = $2',
      [task_id, req.userId]
    );
    if (!task) return res.status(404).json({ error: 'Task not found.' });

    const { rows } = await db.query(
      'INSERT INTO comments (id, task_id, text, author) VALUES ($1, $2, $3, $4) RETURNING id, task_id, text, author, created_at',
      [uuid(), task_id, text, author]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('Failed to create comment:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await db.query(
      'DELETE FROM comments WHERE id = $1 RETURNING id',
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'Comment not found.' });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    console.error('Failed to delete comment:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
