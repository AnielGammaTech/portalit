import { Router } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { getServiceSupabase } from '../lib/supabase.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// M-6: Rate limit uploads — 10 per minute per IP to prevent abuse
const uploadRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many uploads. Please wait before trying again.' },
});

router.post('/', uploadRateLimit, requireAuth, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const supabase = getServiceSupabase();

    // Security: sanitize filename and validate MIME type
    const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!ALLOWED_MIMES.includes(req.file.mimetype)) {
      return res.status(400).json({ error: 'File type not allowed' });
    }
    const sanitizedName = req.file.originalname
      .replace(/[\/\\]/g, '')
      .replace(/\.\./g, '')
      .replace(/[^\w.\-]/g, '_')
      .slice(0, 200);
    const fileName = `${Date.now()}_${sanitizedName}`;

    const { error: uploadError } = await supabase.storage
      .from('uploads')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) {
      return res.status(500).json({ error: uploadError.message });
    }

    // Return a proxied URL that works regardless of bucket privacy
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const fileUrl = `${baseUrl}/api/upload/file/${encodeURIComponent(fileName)}`;

    res.json({ file_url: fileUrl });
  } catch (error) {
    next(error);
  }
});

// Public file proxy — serves files from private Supabase storage via signed URL redirect
router.get('/file/:fileName', async (req, res, next) => {
  try {
    const { fileName } = req.params;
    if (!fileName) {
      return res.status(400).json({ error: 'File name required' });
    }

    // Prevent path traversal
    const safeFile = fileName.replace(/[\/\\]/g, '').replace(/\.\./g, '').slice(0, 300);
    if (!safeFile) {
      return res.status(400).json({ error: 'Invalid file name' });
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase.storage
      .from('uploads')
      .download(safeFile);

    if (error || !data) {
      return res.status(404).json({ error: 'File not found' });
    }

    // Detect content type from filename
    const ext = safeFile.split('.').pop().toLowerCase();
    const mimeTypes = {
      jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
      webp: 'image/webp', ico: 'image/x-icon', svg: 'image/svg+xml',
      pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Stream the file content directly — avoids cross-origin issues with Supabase redirects
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Cross-Origin-Resource-Policy', 'cross-origin');
    res.set('Access-Control-Allow-Origin', '*');
    const buffer = Buffer.from(await data.arrayBuffer());
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// H-10: Authenticated download endpoint — verifies the requesting user is an admin
// before issuing a short-lived signed URL for the requested file.
// Usage: GET /api/upload/download?file=<filename>
router.get('/download', requireAuth, async (req, res, next) => {
  try {
    const { file } = req.query;

    if (!file || typeof file !== 'string') {
      return res.status(400).json({ error: 'file query parameter is required' });
    }

    // Only admins can download files from the uploads bucket
    if (req.user?.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required to download files' });
    }

    // Prevent path traversal
    const safeFile = file.replace(/[\/\\]/g, '').replace(/\.\./g, '').slice(0, 300);
    if (!safeFile) {
      return res.status(400).json({ error: 'Invalid file name' });
    }

    const supabase = getServiceSupabase();
    const { data, error } = await supabase.storage
      .from('uploads')
      .createSignedUrl(safeFile, 300); // 5-minute expiry

    if (error) {
      return res.status(404).json({ error: 'File not found or access denied' });
    }

    res.json({ signed_url: data.signedUrl });
  } catch (error) {
    next(error);
  }
});

export { router as uploadRouter };
