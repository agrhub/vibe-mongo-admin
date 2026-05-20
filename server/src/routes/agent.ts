import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import { agentChatService } from '../services/AgentChatService.js';
import { mongoService } from '../services/MongoService.js';

const router = Router();

// ================= AGENT AI CHAT =================

/**
 * POST /api/agent/chat
 * Trigger conversational prompt
 */
router.post('/api/agent/chat', async (req: Request, res: Response) => {
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
                mongoService.setActiveConnection(activeConn.client, activeConn.connString, context.currentConnection);
            }
        }

        const result = await agentChatService.chat(userId, message, context);
        res.json(result);
    } catch (err: any) {
        console.error('Chat routing failure:', err);
        res.status(500).json({ error: err.message || 'An error occurred during chat processing' });
    }
});

/**
 * GET /api/agent/history
 * Fetch active logs
 */
router.get('/api/agent/history', (req: Request, res: Response) => {
    const { userId = 'admin_user' } = req.query;
    const history = agentChatService.getHistory(userId as string);
    res.json({ history });
});

/**
 * DELETE /api/agent/session
 * Wipe active session logs
 */
router.delete('/api/agent/session', (req: Request, res: Response) => {
    const { userId = 'admin_user' } = req.body;
    agentChatService.clearSession(userId);
    res.json({ success: true, message: 'Chat session cleared' });
});

export default router;
