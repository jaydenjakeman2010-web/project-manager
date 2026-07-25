import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import db from '../db/index.js';
import { v4 as uuid } from 'uuid';
import { broadcast } from '../sse.js';

const router = Router();

const createSchema = z.object({
  project_id: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(500, 'Name too long'),
  description: z.string().max(5000).optional(),
  status: z.enum(['backlog', 'todo', 'inprogress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
  tags: z.string().max(500).optional(),
});

const updateSchema = z.object({
  name: z.string().min(1).max(500).optional(),
  description: z.string().max(5000).optional(),
  status: z.enum(['backlog', 'todo', 'inprogress', 'review', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/).optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  recurrence: z.enum(['none', 'daily', 'weekly', 'monthly']).optional(),
  time_spent: z.number().int().min(0).optional(),
  tags: z.string().max(500).optional(),
  attachments: z.string().optional(),
});

router.use(requireAuth);

router.get('/', async (req, res) => {
  const { project_id, status, search } = req.query;
  const conditions = ['t.user_id = $1'];
  const params = [req.userId];
  let idx = 2;

  if (project_id) {
    conditions.push(`t.project_id = $${idx++}`);
    params.push(project_id);
  }
  if (status) {
    conditions.push(`t.status = $${idx++}`);
    params.push(status);
  }
  if (search) {
    const escaped = search.toLowerCase().replace(/[%_]/g, '\\$&');
    conditions.push(`(LOWER(t.name) LIKE $${idx} OR LOWER(t.description) LIKE $${idx})`);
    params.push(`%${escaped}%`);
    idx++;
  }

  const whereClause = conditions.join(' AND ');

  try {
    const { rows } = await db.query(
      `SELECT t.id, t.name, t.description, t.status, t.priority, t.due_date,
              t.assignee_id, t.recurrence, t.time_spent, t.tags, t.attachments, t.created_at, t.project_id
       FROM tasks t WHERE ${whereClause}
       ORDER BY t.created_at DESC`,
      params
    );

    const taskIds = rows.map(r => r.id);
    let subtaskRows = [];
    let commentRows = [];

    if (taskIds.length > 0) {
      const placeholders = taskIds.map((_, i) => `$${i + 1}`).join(',');
      [subtaskRows, commentRows] = await Promise.all([
        db.query(`SELECT id, task_id, text, done FROM subtasks WHERE task_id IN (${placeholders}) ORDER BY id`, taskIds),
        db.query(`SELECT id, task_id, text, author, created_at FROM comments WHERE task_id IN (${placeholders}) ORDER BY created_at ASC`, taskIds),
      ]);
    }

    const subtasksByTask = {};
    for (const s of subtaskRows.rows) {
      if (!subtasksByTask[s.task_id]) subtasksByTask[s.task_id] = [];
      subtasksByTask[s.task_id].push({ id: s.id, text: s.text, done: s.done });
    }

    const commentsByTask = {};
    for (const c of commentRows.rows) {
      if (!commentsByTask[c.task_id]) commentsByTask[c.task_id] = [];
      commentsByTask[c.task_id].push({ id: c.id, text: c.text, author: c.author, created_at: c.created_at });
    }

    const tasks = rows.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      status: r.status,
      priority: r.priority,
      due_date: r.due_date,
      assignee_id: r.assignee_id,
      recurrence: r.recurrence,
      time_spent: r.time_spent || 0,
      tags: r.tags || '',
      attachments: r.attachments || '[]',
      created_at: r.created_at,
      project_id: r.project_id,
      subtasks: subtasksByTask[r.id] || [],
      comments: commentsByTask[r.id] || [],
    }));

    res.json(tasks);
  } catch (err) {
    console.error('Failed to fetch tasks:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/', validate(createSchema), async (req, res) => {
  const { project_id, name, description, status, priority, due_date, assignee_id, recurrence } = req.validatedBody;

  try {
    const { rows: [project] } = await db.query(
      'SELECT id FROM projects WHERE id = $1 AND (user_id = $2' + (req.userEmail ? ' OR $3 = ANY(shared_with))' : ')') + ' LIMIT 1',
      req.userEmail ? [project_id, req.userId, req.userEmail] : [project_id, req.userId]
    );
    if (!project) {
      return res.status(404).json({ error: 'Project not found.' });
    }

    const { rows } = await db.query(
      `INSERT INTO tasks (id, user_id, project_id, name, description, status, priority, due_date, assignee_id, recurrence, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id, name, description, status, priority, due_date, assignee_id, recurrence, time_spent, tags, attachments, created_at, project_id`,
      [uuid(), req.userId, project_id, name, description || '', status || 'todo', priority || 'medium', due_date || null, assignee_id || null, recurrence || 'none', req.validatedBody.tags || '']
    );

    await db.query(
      'INSERT INTO activity_logs (id, user_id, type, description, project_id) VALUES ($1, $2, $3, $4, $5)',
      [uuid(), req.userId, 'task-created', `Created task "${name}"`, project_id]
    );

    broadcast({ type: 'task-created', userId: req.userId });
    res.status(201).json({ ...rows[0], subtasks: [], comments: [] });
  } catch (err) {
    console.error('Failed to create task:', err.message);
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
    const allowedFields = ['name', 'description', 'status', 'priority', 'due_date', 'assignee_id', 'recurrence', 'time_spent', 'tags', 'attachments'];
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

    params.push(id);
    var email = req.userEmail || '';
    var accessCheck;
    if (email) {
      params.push(req.userId, email);
      accessCheck = '(t.user_id = $' + (params.length - 1) + ' OR EXISTS (SELECT 1 FROM projects WHERE id = t.project_id AND $' + params.length + ' = ANY(shared_with)))';
    } else {
      params.push(req.userId);
      accessCheck = 't.user_id = $' + params.length;
    }
    var tidx = params.length + 1;

    const { rows } = await db.query(
      `UPDATE tasks t SET ${setClauses.join(', ')} FROM projects p WHERE t.project_id = p.id AND t.id = $${tidx} AND ${accessCheck}
       RETURNING t.id, t.name, t.description, t.status, t.priority, t.due_date, t.assignee_id, t.recurrence, t.time_spent, t.tags, t.attachments, t.created_at, t.project_id`,
      allParams.concat([id])
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    broadcast({ type: 'task-updated', userId: req.userId });
    res.json(rows[0]);
  } catch (err) {
    console.error('Failed to update task:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    var email = req.userEmail || '';
    var accessCheck = email ? '(t.user_id = $2 OR EXISTS (SELECT 1 FROM projects WHERE id = t.project_id AND $3 = ANY(shared_with)))' : 't.user_id = $2';
    var params = [id, req.userId];
    if (email) params.push(email);
    const { rows } = await db.query(
      'DELETE FROM tasks t USING projects p WHERE t.project_id = p.id AND t.id = $1 AND ' + accessCheck + ' RETURNING t.id, t.name, t.project_id',
      params
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    await db.query(
      'INSERT INTO activity_logs (id, user_id, type, description) VALUES ($1, $2, $3, $4)',
      [uuid(), req.userId, 'task-deleted', `Deleted task "${rows[0].name}"`]
    );
    broadcast({ type: 'task-deleted', userId: req.userId });
    res.json({ deleted: rows[0].id, project_id: rows[0].project_id });
  } catch (err) {
    console.error('Failed to delete task:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.patch('/:id/toggle', async (req, res) => {
  const { id } = req.params;
  try {
    var email = req.userEmail || '';
    var accessCheck = email ? '(t.user_id = $2 OR EXISTS (SELECT 1 FROM projects WHERE id = t.project_id AND $3 = ANY(shared_with)))' : 't.user_id = $2';
    var params = [id, req.userId];
    if (email) params.push(email);
    const { rows } = await db.query(
      `UPDATE tasks t SET status = CASE WHEN status = 'done' THEN 'todo' ELSE 'done' END
       FROM projects p WHERE t.project_id = p.id AND t.id = $1 AND ` + accessCheck + `
       RETURNING t.id, t.status, t.name, t.project_id`,
      params
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    if (rows[0].status === 'done') {
      await db.query(
        'INSERT INTO activity_logs (id, user_id, type, description, project_id) VALUES ($1, $2, $3, $4, $5)',
        [uuid(), req.userId, 'task-completed', `Completed task "${rows[0].name}"`, rows[0].project_id]
      );
    }
    broadcast({ type: 'task-toggled', userId: req.userId });
    res.json({ id: rows[0].id, status: rows[0].status });
  } catch (err) {
    console.error('Failed to toggle task:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
