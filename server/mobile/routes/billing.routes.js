const express = require('express');
const router = express.Router();
const billingController = require('../controllers/billing.controller');
const { authMiddleware, activeTenantMiddleware } = require('../middleware/auth');

router.get('/me', authMiddleware, activeTenantMiddleware, billingController.getMyBilling);
router.get('/me/latest', authMiddleware, activeTenantMiddleware, billingController.getLatestBilling);
router.get('/history', authMiddleware, activeTenantMiddleware, billingController.getPaymentHistory);
router.get('/:billingId/pdf', authMiddleware, activeTenantMiddleware, billingController.downloadBillPdf);
router.post('/', authMiddleware, activeTenantMiddleware, billingController.createBilling);
router.put('/:billingId', authMiddleware, activeTenantMiddleware, billingController.updateBilling);

module.exports = router;
