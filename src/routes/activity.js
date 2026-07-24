import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/index.js';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT id, type, description, created_at FROM activity_logs WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch activity logs:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
