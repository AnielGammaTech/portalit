import { getServiceSupabase } from '../lib/supabase.js';

export async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const supabase = getServiceSupabase();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Fetch user profile with role and customer info
    const { data: profile } = await supabase
      .from('users')
      .select('*')
      .eq('auth_id', user.id)
      .single();

    req.user = {
      id: user.id,
      email: user.email,
      ...profile,
    };

    next();
  } catch (err) {
    console.error('Auth middleware error:', err);
    return res.status(401).json({ error: 'Authentication failed' });
  }
}

export async function requireAdmin(req, res, next) {
  // Use promise-based pattern to avoid nested callback race conditions
  const authResult = await new Promise((resolve) => {
    requireAuth(req, res, (err) => resolve(err === undefined ? 'ok' : err));
  });

  // If requireAuth already sent a response, stop here
  if (authResult !== 'ok') return;
  if (res.headersSent) return;

  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required' });
  }
  next();
}

export async function requireAdminOrSales(req, res, next) {
  const authResult = await new Promise((resolve) => {
    requireAuth(req, res, (err) => resolve(err === undefined ? 'ok' : err));
  });

  if (authResult !== 'ok') return;
  if (res.headersSent) return;

  if (req.user?.role !== 'admin' && req.user?.role !== 'sales') {
    return res.status(403).json({ error: 'Forbidden: Admin or Sales access required' });
  }
  next();
}
