import { Router } from 'express';
import multer from 'multer';
import { requireAuth } from '../middleware/auth.js';
import { getServiceSupabase } from '../lib/supabase.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.post('/', requireAuth, upload.single('file'), async (req, res, next) => {
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

    const { data: { publicUrl } } = supabase.storage
      .from('uploads')
      .getPublicUrl(fileName);

    res.json({ file_url: publicUrl });
  } catch (error) {
    next(error);
  }
});

export { router as uploadRouter };
