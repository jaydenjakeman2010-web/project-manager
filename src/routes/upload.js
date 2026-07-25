import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import db from '../db/index.js';

const router = Router();

const ALLOWED_TYPES = [
  { mime: 'image/jpeg', magic: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png', magic: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/webp', magic: [0x52, 0x49, 0x46, 0x46] },
  { mime: 'image/gif', magic: [0x47, 0x49, 0x46] },
];

const MAX_SIZE = parseInt(process.env.MAX_UPLOAD_SIZE || '5242880', 10);

function detectImageType(buffer) {
  for (const type of ALLOWED_TYPES) {
    const magic = type.magic;
    if (buffer.length >= magic.length && magic.every((b, i) => buffer[i] === b)) {
      return type.mime;
    }
  }
  return null;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Allowed: JPEG, PNG, WebP, GIF'));
    }
  },
});

router.use(requireAuth);

router.post('/', upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(422).json({ error: 'No file uploaded. Use field name "photo".' });
    }

    const mime = detectImageType(req.file.buffer);
    if (!mime) {
      return res.status(422).json({ error: 'Invalid or corrupted image file.' });
    }

    const maxDimension = 400;
    let sharp;

    try {
      sharp = (await import('sharp')).default;
    } catch {
      const base64 = req.file.buffer.toString('base64');
      const dataUrl = `data:${mime};base64,${base64}`;

      await db.query(
        'UPDATE users SET photo_url = $1 WHERE id = $2',
        [dataUrl, req.userId]
      );

      return res.json({ photo_url: dataUrl, note: 'sharp not available; stored as base64' });
    }

    const resized = await sharp(req.file.buffer)
      .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();

    const base64 = resized.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    await db.query(
      'UPDATE users SET photo_url = $1 WHERE id = $2',
      [dataUrl, req.userId]
    );

    res.json({ photo_url: dataUrl });
  } catch (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: `File too large. Maximum is ${Math.round(MAX_SIZE / 1024 / 1024 * 10) / 10}MB.` });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err.message?.includes('Invalid file type')) {
      return res.status(422).json({ error: err.message });
    }
    console.error('Upload failed:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

router.post('/task-attachment', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(422).json({ error: 'No file uploaded.' });
    var base64 = req.file.buffer.toString('base64');
    var dataUrl = 'data:' + req.file.mimetype + ';base64,' + base64;
    var name = req.file.originalname;
    res.json({ name: name, url: dataUrl, size: req.file.size });
  } catch (err) {
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large.' });
    }
    console.error('Attachment upload failed:', err.message);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

export default router;
