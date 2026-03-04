import { Router } from 'express';
import { requireAdmin } from '../middleware/auth.js';
import { getServiceSupabase } from '../lib/supabase.js';

const router = Router();

router.post('/invite', requireAdmin, async (req, res, next) => {
  try {
    const { email, role } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'email is required' });
    }

    const supabase = getServiceSupabase();

    // Invite user via Supabase Auth
    const { data, error } = await supabase.auth.admin.inviteUserByEmail(email);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    // Create user profile row
    const { error: profileError } = await supabase
      .from('users')
      .insert({
        auth_id: data.user.id,
        email,
        role: role || 'user',
        full_name: '',
      });

    if (profileError) {
      console.error('Failed to create user profile:', profileError);
    }

    res.json({ success: true, user: { id: data.user.id, email } });
  } catch (error) {
    next(error);
  }
});

export { router as usersRouter };
