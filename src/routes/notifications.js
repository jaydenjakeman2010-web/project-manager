import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/index.js';

var router = Router();
router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    var { rows } = await db.query(
      'SELECT id, type, message, task_id, read, created_at FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50',
      [req.userId]
    );
    res.json(rows);
  } catch (err) {
    console.error('Failed to fetch notifications:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2', [req.params.id, req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to mark notification read:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/read-all', async (req, res) => {
  try {
    await db.query('UPDATE notifications SET read = TRUE WHERE user_id = $1', [req.userId]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Failed to mark all read:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
