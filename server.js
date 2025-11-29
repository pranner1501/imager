import express from 'express';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import cookieParser from 'cookie-parser';

import { requireAuth } from './middleware/auth.js';
import userRoutes from './routes/userRoute.js';
import imageRoutes from './routes/imageRoute.js';

dotenv.config();

const app = express();
// let argv = process.argv.slice(2);
// console.log('Command line arguments:', argv);

// --- MongoDB connection ---
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('Mongo error:', err));

// --- Middlewares ---
app.use(express.static('public'));
app.use('/users', express.static('users'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
// --- Routes ---
app.use('/user', userRoutes);
app.use('/', requireAuth, imageRoutes); 
const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`Server running at http://localhost:${PORT}`)
);
