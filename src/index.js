import 'dotenv/config';
import 'express-async-errors';
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
  permissionsPolicy: false,
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

app.get('/_debug', async (_req, res) => {
  var info = {
    nodeEnv: process.env.NODE_ENV,
    hasDbUrl: !!process.env.DATABASE_URL,
    dbUrlPrefix: process.env.DATABASE_URL ? process.env.DATABASE_URL.substring(0, 30) + '...' : 'NOT SET',
    port: process.env.PORT,
    corsOrigin: process.env.CORS_ORIGIN,
    hasJwtSecret: !!process.env.JWT_SECRET,
  };
  try {
    var db = (await import('./db/index.js')).default;
    var { rows } = await db.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'users' ORDER BY ordinal_position");
    info.columns = rows;
  } catch (err) {
    info.dbError = err.message;
    info.dbStack = (err.stack || '').split('\n').slice(0, 5).join('\n');
  }
  res.json(info);
});

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
  console.error('ERROR:', err?.stack || err?.message || err);
  res.status(500).json({ error: 'Internal server error.' });
});

async function tryConnectDb(retries, delayMs) {
  for (var i = 0; i < retries; i++) {
    try {
      const { default: db } = await import('./db/index.js');
      await db.query('SELECT 1');
      console.log('Database connected.');

      var fs = await import('fs');
      var schemaPath = path.join(__dirname, 'db', 'schema.sql');
      var schema = fs.readFileSync(schemaPath, 'utf-8');
      await db.query(schema);
      console.log('Schema up to date.');
      return true;
    } catch (err) {
      console.log('DB attempt ' + (i + 1) + '/' + retries + ' failed: ' + err.message);
      if (i < retries - 1) {
        await new Promise(function (r) { setTimeout(r, delayMs); });
      }
    }
  }
  return false;
}

async function start() {
  var dbOk = await tryConnectDb(5, 3000);

  if (!dbOk) {
    console.log('WARNING: No database connection. App will start but API calls will fail.');
    console.log('Set DATABASE_URL or add PostgreSQL plugin in Railway.');
    app.get('/api/*', function (_req, res) {
      res.status(503).json({ error: 'Database not connected. Add PostgreSQL in Railway.' });
    });
  }

  app.listen(PORT, function () {
    console.log('Server running on http://localhost:' + PORT);
    console.log('Environment: ' + (process.env.NODE_ENV || 'development'));
  });
}

start();
