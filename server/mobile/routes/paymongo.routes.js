const express = require('express');
const router = express.Router();
const paymongoController = require('../controllers/paymongo.controller');
const { authMiddleware, activeTenantMiddleware } = require('../middleware/auth');

// Create a PayMongo checkout session (requires auth)
router.post('/checkout', authMiddleware, activeTenantMiddleware, paymongoController.createCheckoutSession);

// Check checkout session status (requires auth)
router.get('/checkout/:checkoutId/status', authMiddleware, activeTenantMiddleware, paymongoController.getCheckoutStatus);

// PayMongo webhook (NO auth Ã¢â‚¬â€ called by PayMongo servers)
router.post('/webhook', paymongoController.handleWebhook);

// Redirect handlers Ã¢â‚¬â€ PayMongo redirects the browser here after payment,
// then we bounce the user back to the app via deep link (NO auth needed)
router.get('/redirect/success', paymongoController.redirectSuccess);
router.get('/redirect/cancel', paymongoController.redirectCancel);

module.exports = router;
