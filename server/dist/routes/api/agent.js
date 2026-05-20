"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const AgentChatService_js_1 = require("../../services/AgentChatService.js");
const MongoService_js_1 = require("../../services/MongoService.js");
const router = (0, express_1.Router)();
// ================= AGENT AI CHAT =================
/**
 * POST /api/agent/chat
 * Trigger conversational prompt
 */
router.post('/api/agent/chat', async (req, res) => {
    const { message, userId = 'admin_user', context } = req.body;
    if (!message) {
        return res.status(400).json({ error: 'Message field is required' });
    }
    try {
        // Sync agent's active connection with the UI context
        if (context && context.currentConnection) {
            const dbConnections = req.app.locals.dbConnections;
            const activeConn = dbConnections ? dbConnections[context.currentConnection] : null;
            if (activeConn && activeConn.client && activeConn.connString) {
                MongoService_js_1.mongoService.setActiveConnection(activeConn.client, activeConn.connString, context.currentConnection);
            }
        }
        const result = await AgentChatService_js_1.agentChatService.chat(userId, message, context);
        res.json(result);
    }
    catch (err) {
        console.error('Chat routing failure:', err);
        res.status(500).json({ error: err.message || 'An error occurred during chat processing' });
    }
});
/**
 * GET /api/agent/history
 * Fetch active logs
 */
router.get('/api/agent/history', (req, res) => {
    const { userId = 'admin_user' } = req.query;
    const history = AgentChatService_js_1.agentChatService.getHistory(userId);
    res.json({ history });
});
/**
 * DELETE /api/agent/session
 * Wipe active session logs
 */
router.delete('/api/agent/session', (req, res) => {
    const { userId = 'admin_user' } = req.body;
    AgentChatService_js_1.agentChatService.clearSession(userId);
    res.json({ success: true, message: 'Chat session cleared' });
});
exports.default = router;
