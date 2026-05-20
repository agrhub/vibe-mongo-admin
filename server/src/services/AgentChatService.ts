import { chatWithAgent, clearAgentSession } from '../agent/agent';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class AgentChatService {
  private historyMap: Map<string, ChatMessage[]> = new Map();

  async chat(
    userId: string,
    message: string,
    context?: {
      currentDb?: string;
      currentCollection?: string;
      currentRoute?: string;
    }
  ): Promise<{
    message: string;
    chartVisual?: any;
    navigation?: { db?: string; collection?: string; route?: string };
    suggestions?: string[];
    databases?: string[];
    collectionsInfo?: { db: string; collections: string[] };
  }> {
    try {
      console.log(`[AgentChatService] Received chat request from user: ${userId}. Message: "${message}"`);

      // Store user message in history
      if (!this.historyMap.has(userId)) {
        this.historyMap.set(userId, []);
      }
      this.historyMap.get(userId)!.push({
        role: 'user',
        content: message,
        timestamp: Date.now()
      });

      // Invoke the imported chatWithAgent function from the sibling agent workspace
      const { message: responseMessage, chartVisual, navigation, suggestions, databases, collectionsInfo } = await chatWithAgent(userId, message, context);

      // Store assistant message in history
      this.historyMap.get(userId)!.push({
        role: 'assistant',
        content: responseMessage,
        timestamp: Date.now()
      });

      console.log(`[AgentChatService] Finished chat response: "${responseMessage.substring(0, 100)}..."`);

      return {
        message: responseMessage,
        chartVisual: chartVisual,
        navigation: navigation,
        suggestions: suggestions,
        databases,
        collectionsInfo
      };
    } catch (err: any) {
      console.error('[AgentChatService] Error during chat session:', err);
      const errMsg = `An error occurred: ${err.message || 'Unknown agent execution error'}`;
      
      // Store error message as assistant response so history stays aligned
      if (this.historyMap.has(userId)) {
        this.historyMap.get(userId)!.push({
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

  getHistory(userId: string): ChatMessage[] {
    return this.historyMap.get(userId) || [];
  }

  clearSession(userId: string): void {
    console.log(`[AgentChatService] Clearing chat session for user: ${userId}`);
    this.historyMap.delete(userId);
    clearAgentSession(userId).catch((err: any) => {
      console.error(`[AgentChatService] Failed to clear runner session for user ${userId}:`, err);
    });
  }
}

export const agentChatService = new AgentChatService();
