import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/index.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    var projectFilter = req.query.project_id ? 'AND project_id = $2' : '';
    var params = [req.userId];
    if (req.query.project_id) params.push(req.query.project_id);
    var limit = parseInt(req.query.limit, 10) || 50;
    const { rows } = await db.query(
      'SELECT id, type, description, project_id, created_at FROM activity_logs WHERE user_id = $1 ' + projectFilter + ' ORDER BY created_at DESC LIMIT $' + (params.length + 1),
      params.concat([limit])
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch activity logs:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
