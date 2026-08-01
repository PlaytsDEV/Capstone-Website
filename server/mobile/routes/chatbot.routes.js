const express = require('express');
const router = express.Router();
const chatbotController = require('../controllers/chatbot.controller');
const { authMiddleware, activeTenantMiddleware, adminMiddleware, requireMobilePermission } = require('../middleware/auth');

// Regular chatbot routes
router.post('/message', authMiddleware, activeTenantMiddleware, chatbotController.sendMessage);
router.post('/request-admin', authMiddleware, activeTenantMiddleware, chatbotController.requestAdmin);
router.post('/reset', authMiddleware, activeTenantMiddleware, chatbotController.resetSession);
router.get('/live-status/:sessionId', authMiddleware, activeTenantMiddleware, chatbotController.getLiveStatus);
router.post('/close-live-chat', authMiddleware, activeTenantMiddleware, chatbotController.closeLiveChat);
router.get('/history', authMiddleware, activeTenantMiddleware, chatbotController.getChatHistory);

// Admin routes — adminMiddleware enforces owner/branch_admin role
router.get('/admin/live-chats', authMiddleware, adminMiddleware, requireMobilePermission('manageUsers', { branchScoped: true }), chatbotController.getLiveChats);
router.post('/admin/live-chat/accept', authMiddleware, adminMiddleware, requireMobilePermission('manageUsers', { branchScoped: true }), chatbotController.acceptLiveChat);
router.post('/admin/live-chat/message', authMiddleware, adminMiddleware, requireMobilePermission('manageUsers', { branchScoped: true }), chatbotController.sendAdminMessage);

module.exports = router;
