import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import 'dotenv/config';
import authRoutes from './routes/auth.js';
import protectedRoutes from './routes/protected.js';
import { protect } from './middleware/authMiddleware.js';
import workerRoutes from './routes/workerThreads.js';
import userRoutes from './routes/users.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use((req, _res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});
app.use(express.urlencoded({ extended: true }));

mongoose
  .connect(process.env.MONGO_URI || 'mongodb://localhost:27017/myApp')
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB error:', err));

app.get('/', (_req, res) => res.json({ message: 'API is running' }));
app.use('/api/auth', authRoutes);
app.use('/api/getAllUsers', protect, protectedRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/users', userRoutes);

app.listen(3000, () => console.log('Server running on port 3000'));
