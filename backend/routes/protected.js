import express from 'express';
import User from '../models/User.js';

const router = express.Router();

router.get('/all', async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
