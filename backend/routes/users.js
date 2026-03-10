import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// GET /api/users — fetch all users from DB (demo route, no auth)
router.get('/', async (_req, res) => {
  const start = Date.now();
  const users = await User.find().select('-password');
  res.json({
    count: users.length,
    users,
    dbQueryMs: Date.now() - start,
  });
});

export default router;
