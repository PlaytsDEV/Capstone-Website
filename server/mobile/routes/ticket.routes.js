const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticket.controller');
const { authMiddleware, activeTenantMiddleware } = require('../middleware/auth');

router.get('/me', authMiddleware, activeTenantMiddleware, ticketController.getMyTickets);
router.post('/', authMiddleware, activeTenantMiddleware, ticketController.createTicket);
router.get('/:ticketId', authMiddleware, activeTenantMiddleware, ticketController.getTicket);
router.post('/:ticketId/respond', authMiddleware, activeTenantMiddleware, ticketController.respondToTicket);
router.put('/:ticketId/status', authMiddleware, activeTenantMiddleware, ticketController.updateTicketStatus);

module.exports = router;
