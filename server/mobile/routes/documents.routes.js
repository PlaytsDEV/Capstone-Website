const express = require('express');
const router = express.Router();
const documentsController = require('../controllers/documents.controller');
const { authMiddleware, activeTenantMiddleware } = require('../middleware/auth');

router.get('/:docId', authMiddleware, activeTenantMiddleware, documentsController.downloadDocument);

module.exports = router;