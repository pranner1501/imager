// imageRoute.js
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Worker } from 'worker_threads';
import Image from '../models/Image.js';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
import { compressImage } from '../workers/imageWorkerPool.js';

const router = Router();
const ROOT = process.cwd();

// --- ES module __dirname ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Multer config (store files on disk per-user) ---
const storage = multer.diskStorage({
  destination(req, file, cb) {
    // username is stored in a normal cookie (not httpOnly) in your userRoute
    const username = req.cookies.username;

    if (!username) {
      return cb(new Error('No username cookie found'));
    }

    const uploadPath = path.join('users', username);

    // create user folder if not exists
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }

    cb(null, uploadPath);
  },

  filename(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, file.fieldname + '-' + uniqueSuffix + ext);
  },
});

const upload = multer({ storage });

// --- Routes ---

// Upload route (uses worker_threads for DB writes)
router.post(
  '/upload',
  requireAuth,
  upload.array('images'),
  async (req, res) => {
    try {
      const userId = req.cookies.userId;
      const username = req.cookies.username;

      if (!userId || !username) {
        return res.redirect('/auth.html');
      }

      const compressionJobs = [];

      for (const file of req.files) {
        // Save metadata in Mongo
        await Image.create({
          originalName: file.originalname,
          filename: file.filename,
          username: userId, // ObjectId
          path: `/users/${username}/${file.filename}`,
          size: file.size,
        });

        // Absolute path for worker
        const absPath = path.join(ROOT, 'users', username, file.filename);

        // send to worker pool
        compressionJobs.push(compressImage(absPath));
      }

      // Wait for all compressions to finish (or you can remove this await
      // if you want compression fully in background)
      await Promise.all(compressionJobs);

      return res.redirect('/');
    } catch (err) {
      console.error('Upload error:', err);
      res.status(500).send('Error uploading file');
    }
  }
);

// Get all images (for gallery)
router.get('/images', async (req, res) => {
  try {
    const images = await Image.find().sort({ createdAt: -1 });
    res.json(images);
  } catch (err) {
    console.error('Fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch images' });
  }
});

// Delete single image (DB + file)
router.delete('/image/:id', async (req, res) => {
  try {
    const image = await Image.findById(req.params.id);
    if (!image) return res.status(404).json({ error: 'Image not found' });

    const filePath = path.join(__dirname, '..', image.path);
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete file from disk:', err);
    });

    await image.deleteOne();

    res.json({ success: true });
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete image' });
  }
});

router.delete('/images/delete-all', requireAuth, async (req, res) => {
  try {
    const userId = req.cookies.userId;       // ObjectId as string
    const username = req.cookies.username;   // plain string (folder name)

    if (!userId || !username) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const images = await Image.find({ username: userId });

    for (const img of images) {
      // remove leading "/" → /users/... → users/...
      const relativePath = img.path.replace(/^\//, '');
      const filePath = path.join(__dirname, '..', relativePath);

      fs.unlink(filePath, (err) => {
        if (err) console.error('File delete error:', err);
      });
    }

    await Image.deleteMany({ username: userId });

    res.json({ success: true, message: 'All images deleted for this user' });
  } catch (err) {
    console.error('Delete user images error:', err);
    res.status(500).json({ error: 'Failed to delete user images' });
  }
});


// /:username/uploads gallery
router.get('/:username/uploads', requireAuth, async (req, res) => {
  res.sendFile(path.join(__dirname, '../public/uploads.html'));
});

router.get('/:username/uploads/data', requireAuth, async (req, res) => {
  try {
    const usernameParam = req.params.username;

    const user = await User.findOne({ username: usernameParam });
    if (!user) return res.status(404).json({ error: "User not found" });

    const images = await Image.find({ username: user._id })
      .sort({ createdAt: -1 });

    res.json(images);
  } catch (err) {
    console.error("User uploads list error:", err);
    res.status(500).json({ error: "Failed to fetch uploads" });
  }
});


export default router;
