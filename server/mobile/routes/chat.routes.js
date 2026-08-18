const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chat.controller');
const { authMiddleware, activeTenantMiddleware } = require('../middleware/auth');

router.post('/start', authMiddleware, activeTenantMiddleware, chatController.startConversation);
router.get('/me', authMiddleware, activeTenantMiddleware, chatController.getMyConversations);
router.get('/:conversationId/messages', authMiddleware, activeTenantMiddleware, chatController.getConversationMessages);
router.post('/:conversationId/messages', authMiddleware, activeTenantMiddleware, chatController.sendMessage);
router.patch('/:conversationId/resolution', authMiddleware, activeTenantMiddleware, chatController.confirmResolution);
router.patch('/:conversationId/reopen', authMiddleware, activeTenantMiddleware, chatController.reopenConversation);
router.patch('/:conversationId/close', authMiddleware, activeTenantMiddleware, chatController.closeConversation);
router.get('/:conversationId/attachments/:attachmentId', authMiddleware, activeTenantMiddleware, chatController.downloadAttachment);

module.exports = router;
