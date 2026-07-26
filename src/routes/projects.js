import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { broadcast } from '../sse.js';

const router = Router();

const createSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name too long'),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid hex color').optional(),
});

var shareSchema = z.object({
  email: z.string().email(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  archived: z.boolean().optional(),
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    var email = req.userEmail || '';
    var archivedFilter = req.query.archived === 'true' ? 'AND p.archived = TRUE' : 'AND (p.archived = FALSE OR p.user_id != $1)';
    const { rows } = await db.query(
      `SELECT p.id, p.name, p.color, p.archived, p.shared_with, p.created_at, p.user_id AS owner_id
       FROM projects p WHERE (p.user_id = $1` + (email ? ` OR p.shared_with @> ARRAY[$2])` : `)`) + ` ${archivedFilter} ORDER BY p.created_at DESC`,
      email ? [req.userId, email] : [req.userId]
    );
    var mapped = rows.map(function (r) { return { ...r, is_owner: r.owner_id === req.userId }; });
    res.json(mapped);
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
      [uuid(), req.userId, name, color || '#7C3AED']
    );
    await db.query(
      'INSERT INTO activity_logs (id, user_id, type, description, project_id) VALUES ($1, $2, $3, $4, $5)',
      [uuid(), req.userId, 'project-created', `Created project "${name}"`, rows[0].id]
    );
    broadcast({ type: 'project-created', userId: req.userId });
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
    if (updates.archived !== undefined) { setClauses.push(`archived = $${idx++}`); params.push(updates.archived); }

    params.push(id, req.userId);

    const { rows } = await db.query(
      `UPDATE projects SET ${setClauses.join(', ')} WHERE id = $${idx++} AND user_id = $${idx} RETURNING id, name, color, archived, created_at`,
      params
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Project not found.' });
    }
    broadcast({ type: 'project-updated', userId: req.userId });
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
    broadcast({ type: 'project-deleted', userId: req.userId });
    res.json({ deleted: rows[0].id });
  } catch (err) {
    console.error('Failed to delete project:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/:id/share', validate(shareSchema), async (req, res) => {
  var { id } = req.params;
  var { email } = req.validatedBody;
  try {
    await db.query('UPDATE projects SET shared_with = array_append(shared_with, $1) WHERE id = $2 AND user_id = $3', [email, id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to share project:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/:id/unshare', async (req, res) => {
  var { id } = req.params;
  var { email } = req.body;
  if (!email) return res.status(422).json({ error: 'Email required.' });
  try {
    await db.query('UPDATE projects SET shared_with = array_remove(shared_with, $1) WHERE id = $2 AND user_id = $3', [email, id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to unshare project:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
