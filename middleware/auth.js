// middleware/auth.js
import User from '../models/User.js';

export async function requireAuth(req, res, next) {
  try {
    const { userId } = req.cookies || {};

    if (!userId) {
      return res.redirect('/auth.html');
    }

    const user = await User.findById(userId).select('username');

    if (!user) {
      return res.redirect('/auth.html');
    }

    // Attach user to req so Multer destination & routes can use it
    req.user = user; // { _id, username }

    next();
  } catch (err) {
    console.error('Auth error:', err);
    return res.status(500).send('Auth error');
  }
}
