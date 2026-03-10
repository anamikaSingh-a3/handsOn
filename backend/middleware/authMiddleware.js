import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token' });
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const id = typeof decoded === 'object' ? decoded.id : null;
    req.user = await User.findById(id).select('-password');
    next();
  } catch (err) {
    console.error('Auth error:', err.message);
    res.status(401).json({ message: 'Not authorized, invalid token' });
  }
};
