import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/user.js';
import projectRoutes from './routes/projects.js';
import taskRoutes from './routes/tasks.js';
import teamRoutes from './routes/team.js';
import eventRoutes from './routes/events.js';
import uploadRoutes from './routes/upload.js';
import activityRoutes from './routes/activity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false,
}));

app.use(express.json({ limit: '2mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Try again in 15 minutes.' },
});

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Slow down.' },
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api', apiLimiter);
app.use('/api/user', userRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/team', teamRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/activity', activityRoutes);

app.use(express.static(ROOT, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

app.get('/health', (_req, res) => { res.json({ status: 'ok' }); });

app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT, 'index.html'));
});

app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Request body too large.' });
  }
  if (err.name === 'MulterError') {
    return res.status(400).json({ error: err.message });
  }
  console.error('Unhandled error:', process.env.NODE_ENV !== 'production' ? err : err.message);
  res.status(500).json({ error: 'Internal server error.' });
});

async function start() {
  try {
    const { default: db } = await import('./db/index.js');
    await db.query('SELECT 1');
    console.log('Database connected.');

    var fs = await import('fs');
    var schemaPath = path.join(__dirname, 'db', 'schema.sql');
    var schema = fs.readFileSync(schemaPath, 'utf-8');
    await db.query(schema);
    console.log('Schema up to date.');
  } catch (err) {
    console.error('Database setup failed:', err.message);
    console.error('Make sure DATABASE_URL is set and the database is running.');
    process.exit(1);
  }

  app.listen(PORT, function () {
    console.log('Server running on http://localhost:' + PORT);
    console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
  });
}

start();
