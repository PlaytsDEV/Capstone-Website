const express = require('express');
const { authMiddleware, ownerMiddleware } = require('../middleware/auth');
const seedController = require('../controllers/seed.controller');
const router = express.Router();
const seedEnabled = (_req, res, next) => {
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_MOBILE_SEED !== 'true') return res.status(404).json({ detail: 'Not found', code: 'NOT_FOUND' });
  return next();
};
router.post('/', seedEnabled, authMiddleware, ownerMiddleware, seedController.seedData);
module.exports = router;
