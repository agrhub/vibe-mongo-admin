"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentChatService = exports.AgentChatService = void 0;
const agent_1 = require("../agent/agent");
class AgentChatService {
    historyMap = new Map();
    async chat(userId, message, context) {
        try {
            console.log(`[AgentChatService] Received chat request from user: ${userId}. Message: "${message}"`);
            // Store user message in history
            if (!this.historyMap.has(userId)) {
                this.historyMap.set(userId, []);
            }
            this.historyMap.get(userId).push({
                role: 'user',
                content: message,
                timestamp: Date.now()
            });
            // Invoke the imported chatWithAgent function from the sibling agent workspace
            const { message: responseMessage, chartVisual, navigation, suggestions, databases, collectionsInfo, documentsResult, mongoQuery, refreshRequired, traceResult } = await (0, agent_1.chatWithAgent)(userId, message, context);
            // Force chart type if hint was passed from Analysis UI
            if (context?.chartTypeHint && chartVisual) {
                chartVisual.type = context.chartTypeHint;
            }
            // Store assistant message in history with full metadata
            this.historyMap.get(userId).push({
                role: 'assistant',
                content: responseMessage,
                chartVisual,
                navigation,
                suggestions,
                databases,
                collectionsInfo,
                documentsResult,
                mongoQuery,
                traceResult,
                timestamp: Date.now()
            });
            console.log(`[AgentChatService] Finished chat response: "${responseMessage.substring(0, 100)}..."`);
            return {
                message: responseMessage,
                chartVisual: chartVisual,
                navigation: navigation,
                suggestions: suggestions,
                databases,
                collectionsInfo,
                documentsResult,
                mongoQuery,
                refreshRequired,
                traceResult
            };
        }
        catch (err) {
            console.error('[AgentChatService] Error during chat session:', err);
            const errMsg = `An error occurred: ${err.message || 'Unknown agent execution error'}`;
            // Store error message as assistant response so history stays aligned
            if (this.historyMap.has(userId)) {
                this.historyMap.get(userId).push({
                    role: 'assistant',
                    content: errMsg,
                    timestamp: Date.now()
                });
            }
            return {
                message: errMsg,
                navigation: undefined
            };
        }
    }
    getHistory(userId) {
        return this.historyMap.get(userId) || [];
    }
    clearSession(userId) {
        console.log(`[AgentChatService] Clearing chat session for user: ${userId}`);
        this.historyMap.delete(userId);
        (0, agent_1.clearAgentSession)(userId).catch((err) => {
            console.error(`[AgentChatService] Failed to clear runner session for user ${userId}:`, err);
        });
    }
}
exports.AgentChatService = AgentChatService;
exports.agentChatService = new AgentChatService();
