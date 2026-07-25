import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';

var router = Router();
var createSchema = z.object({ name: z.string().min(1).max(200), target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), progress: z.number().int().min(0).max(100).optional() });
var updateSchema = z.object({ name: z.string().min(1).max(200).optional(), target_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(), progress: z.number().int().min(0).max(100).optional() });

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    var { rows } = await db.query('SELECT id, name, target_date, progress, created_at FROM goals WHERE user_id = $1 ORDER BY target_date ASC NULLS LAST', [req.userId]);
    res.json(rows);
  } catch (err) { console.error('Failed to fetch goals:', err.message); res.status(500).json({ error: 'Internal server error.' }); }
});

router.post('/', validate(createSchema), async (req, res) => {
  var { name, target_date, progress } = req.validatedBody;
  try {
    var { rows } = await db.query('INSERT INTO goals (id, user_id, name, target_date, progress) VALUES ($1,$2,$3,$4,$5) RETURNING id, name, target_date, progress, created_at', [uuid(), req.userId, name, target_date || null, progress || 0]);
    res.status(201).json(rows[0]);
  } catch (err) { console.error('Failed to create goal:', err.message); res.status(500).json({ error: 'Internal server error.' }); }
});

router.patch('/:id', validate(updateSchema), async (req, res) => {
  var updates = req.validatedBody;
  try {
    var sets = []; var params = []; var idx = 1;
    if (updates.name !== undefined) { sets.push('name = $' + idx++); params.push(updates.name); }
    if (updates.target_date !== undefined) { sets.push('target_date = $' + idx++); params.push(updates.target_date); }
    if (updates.progress !== undefined) { sets.push('progress = $' + idx++); params.push(updates.progress); }
    if (!sets.length) return res.status(422).json({ error: 'No fields.' });
    params.push(req.params.id, req.userId);
    var { rows } = await db.query('UPDATE goals SET ' + sets.join(', ') + ' WHERE id = $' + idx++ + ' AND user_id = $' + idx + ' RETURNING id, name, target_date, progress, created_at', params);
    if (!rows.length) return res.status(404).json({ error: 'Goal not found.' });
    res.json(rows[0]);
  } catch (err) { console.error('Failed to update goal:', err.message); res.status(500).json({ error: 'Internal server error.' }); }
});

router.delete('/:id', async (req, res) => {
  try {
    var { rows } = await db.query('DELETE FROM goals WHERE id = $1 AND user_id = $2 RETURNING id', [req.params.id, req.userId]);
    if (!rows.length) return res.status(404).json({ error: 'Goal not found.' });
    res.json({ deleted: rows[0].id });
  } catch (err) { console.error('Failed to delete goal:', err.message); res.status(500).json({ error: 'Internal server error.' }); }
});

export default router;
