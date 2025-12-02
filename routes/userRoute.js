import express from 'express';
import User from '../models/User.js';
const router = express.Router();

// userRoutes.js

router.post('/auth', async (req, res) => {
  try {
    let { username, password } = req.body;

    if (!username || !password)
      return res.status(400).json({ error: 'Missing username or password' });
    username = username.trim();
      password = password.trim();

    let user = await User.findOne({ username });

    if (user) {
      if (user.password !== password) {
        return res.status(401).json({ error: 'Invalid username or password' });
      }
    } else {
      user = await User.create({ username, password });
    }

    // Store USER ID in cookie instead of username
    res.cookie("userId", user._id.toString(), {
      httpOnly: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
    res.cookie("username", user.username, {
      httpOnly: false,     // important: readable via req.cookies on server
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    console.log("POST /user/auth hit1");

    return res.redirect('/');
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


router.get('/profile', async (req, res) => {
  try {
    const { userId } = req.cookies || {};

    if (!userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await User.findById(userId).select('username');

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    return res.json({ userId:user._id, username: user.username });
  } catch (err) {
    console.error('Profile error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/user', (req, res) => {
  res.redirect('/auth.html');  // or res.send('User route works');
});

router.post('/logout', (req, res) => {
  res.clearCookie('userId');
  res.clearCookie('username');
  res.json({ ok: true });
});

export default router;