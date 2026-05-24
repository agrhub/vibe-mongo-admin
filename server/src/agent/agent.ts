import 'dotenv/config';
import { LlmAgent, InMemoryRunner, getFunctionResponses } from '@google/adk';
import { mongoTools } from './tools';
import { SYSTEM_INSTRUCTION } from './prompts'
import {
  rateLimitCallback,
  beforeAgent,
  beforeTool,
  afterTool,
} from './shared_libraries/callbacks';

const modelName = process.env.AGENT_MODEL || 'gemini-3.1-flash-lite';

export const rootAgent = new LlmAgent({
  model: modelName,
  name: 'MongoAgent',
  description: 'AI Database Administrator Assistant powered by Google ADK',
  instruction: SYSTEM_INSTRUCTION,
  tools: mongoTools,
  beforeToolCallback: beforeTool,
  afterToolCallback: afterTool,
  beforeModelCallback: rateLimitCallback,
});

console.log(`[Agent] Initialized MongoAgent with model: ${modelName}`);


// Instantiate ONE global runner. InMemoryRunner holds session histories internally
const runner = new InMemoryRunner({
  agent: rootAgent,
  appName: 'MongoAgent'
});

export async function chatWithAgent(
  userId: string,
  message: string,
  context?: any
): Promise<{ 
  message: string; 
  chartVisual?: any; 
  navigation?: any; 
  suggestions?: string[];
  databases?: string[];
  collectionsInfo?: { db: string; collections: string[] };
  documentsResult?: { query: string; documents: any[] };
  mongoQuery?: string;
}> {
  const { withSpan } = require('@arizeai/phoenix-otel');
  
  return await withSpan(
    async () => {
      const stateDelta = context ? { uiContext: context } : undefined;

      let userText = message;
      if (context) {
        const dbStr = context.currentDb ? `DB: "${context.currentDb}"` : 'DB: none';
        const collStr = context.currentCollection ? `Collection: "${context.currentCollection}"` : 'Collection: none';
        const routeStr = context.currentRoute ? `Route: "${context.currentRoute}"` : 'Route: none';
        const localeStr = context.currentLocale ? `Locale: "${context.currentLocale}"` : 'Locale: en';
        userText = `[UI Context | ${dbStr}, ${collStr}, ${routeStr}, ${localeStr}]\n${message}`;
      }

      // Ensure the session is initialized in Google ADK session service before running the generator
      const existingSession = await (runner as any).sessionService.getSession({
        appName: (runner as any).appName,
        userId: userId,
        sessionId: userId
      });
      if (!existingSession) {
        await (runner as any).sessionService.createSession({
          appName: (runner as any).appName,
          userId: userId,
          sessionId: userId
        });
      }

      const eventGenerator = runner.runAsync({
        userId,
        sessionId: userId, // Use userId as sessionId for persistent history
        newMessage: { role: 'user', parts: [{ text: userText }] },
        stateDelta
      });

      let responseMessage = '';
      let chartVisual: any = null;
      let navigation: any = null;
      let documentsResult: { query: string; documents: any[] } | undefined;
      let traceResult: any = undefined;

      for await (const event of eventGenerator) {
        const textParts = event.content?.parts?.map((p: any) => p.text).filter(Boolean) || [];
        if (textParts.length > 0) {
          responseMessage += textParts.join('');
        }

        const responses = getFunctionResponses(event);
        for (const resp of responses) {
          if (resp.response && (resp.response as any).chartVisual) {
            chartVisual = (resp.response as any).chartVisual;
          }
          if (resp.response && (resp.response as any).navigation) {
            navigation = (resp.response as any).navigation;
          }
        }
      }

      // Extract suggestions from [SUGGESTIONS]...[/SUGGESTIONS] block
      let suggestions: string[] = [];
      const suggRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/i;
      const match = responseMessage.match(suggRegex);
      if (match) {
        try {
          const cleanJson = match[1].replace(/```json/g, '').replace(/```/g, '').trim();
          suggestions = JSON.parse(cleanJson);
        } catch (e) {
          console.error('[Agent] Failed to parse suggestions from response:', e);
        }
        responseMessage = responseMessage.replace(suggRegex, '').trim();
      } else {
        // Fallback for untagged arrays: [SUGGESTIONS] ["A", "B"]
        const untaggedSuggRegex = /\[SUGGESTIONS\]\s*(\[[^\]]*\])/i;
        const untaggedMatch = responseMessage.match(untaggedSuggRegex);
        if (untaggedMatch) {
          try {
            suggestions = JSON.parse(untaggedMatch[1]);
          } catch (e) {}
          responseMessage = responseMessage.replace(untaggedSuggRegex, '').trim();
        }
      }
      // Cleanup any leftover empty tags
      responseMessage = responseMessage.replace(/\[\/?SUGGESTIONS\]/gi, '').trim();

      // Extract databases from [DATABASES]...[/DATABASES] block
      let databases: string[] | undefined;
      const dbRegex = /\[DATABASES\]([\s\S]*?)\[\/DATABASES\]/;
      const dbMatch = responseMessage.match(dbRegex);
      if (dbMatch) {
        try {
          const cleanJson = dbMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
          databases = JSON.parse(cleanJson);
        } catch (e) {
          console.error('[Agent] Failed to parse databases block:', e);
        }
        responseMessage = responseMessage.replace(dbRegex, '').trim();
      }

      // Extract collections from [COLLECTIONS]...[/COLLECTIONS] block
      let collectionsInfo: { db: string; collections: string[] } | undefined;
      const collRegex = /\[COLLECTIONS\]([\s\S]*?)\[\/COLLECTIONS\]/;
      const collMatch = responseMessage.match(collRegex);
      if (collMatch) {
        try {
          const cleanJson = collMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
          collectionsInfo = JSON.parse(cleanJson);
        } catch (e) {
          console.error('[Agent] Failed to parse collections block:', e);
        }
        responseMessage = responseMessage.replace(collRegex, '').trim();
      }

      // Extract navigation from [NAVIGATION]...[/NAVIGATION] block
      const navRegex = /\[NAVIGATION\]([\s\S]*?)\[\/NAVIGATION\]/;
      const navMatch = responseMessage.match(navRegex);
      if (navMatch) {
        try {
          const cleanJson = navMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
          navigation = JSON.parse(cleanJson);
        } catch (e) {
          console.error('[Agent] Failed to parse navigation block:', e);
        }
        responseMessage = responseMessage.replace(navRegex, '').trim();
      }

      // Extract chart from [CHART]...[/CHART] block
      const chartRegex = /\[CHART\]([\s\S]*?)\[\/CHART\]/;
      const chartMatch = responseMessage.match(chartRegex);
      if (chartMatch) {
        try {
          const cleanJson = chartMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
          chartVisual = JSON.parse(cleanJson);
        } catch (e) {
          console.error('[Agent] Failed to parse chart block:', e);
        }
        responseMessage = responseMessage.replace(chartRegex, '').trim();
      }

      // Extract documentsResult from [DOCUMENTS]...[/DOCUMENTS] block
      const docsRegex = /\[DOCUMENTS\]([\s\S]*?)\[\/DOCUMENTS\]/;
      const docsMatch = responseMessage.match(docsRegex);
      if (docsMatch) {
        try {
          const cleanJson = docsMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
          documentsResult = JSON.parse(cleanJson);
        } catch (e) {
          console.error('[Agent] Failed to parse documents block:', e);
        }
        responseMessage = responseMessage.replace(docsRegex, '').trim();
      }

      // Extract standalone mongoQuery from [QUERY]...[/QUERY] block
      let mongoQuery: string | undefined;
      const queryRegex = /\[QUERY\]([\s\S]*?)\[\/QUERY\]/;
      const queryMatch = responseMessage.match(queryRegex);
      if (queryMatch) {
        mongoQuery = queryMatch[1].replace(/```javascript/g, '').replace(/```json/g, '').replace(/```/g, '').trim();
        responseMessage = responseMessage.replace(queryRegex, '').trim();
      }

      // Extract traceResult from [TRACE]...[/TRACE] block
      const traceRegex = /\[TRACE\]([\s\S]*?)\[\/TRACE\]/;
      const traceMatch = responseMessage.match(traceRegex);
      if (traceMatch) {
        try {
          const cleanJson = traceMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
          traceResult = JSON.parse(cleanJson);
        } catch (e) {
          console.error('[Agent] Failed to parse trace block:', e);
        }
        responseMessage = responseMessage.replace(traceRegex, '').trim();
      }

      const { trace } = require('@arizeai/phoenix-otel');
      const span = trace.getActiveSpan();
      if (span) {
        span.setAttributes({
          'input.value': JSON.stringify({ userId, message })
        });
      }
      
      return {
        message: responseMessage,
        chartVisual: chartVisual || undefined,
        navigation: navigation || undefined,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        databases,
        collectionsInfo,
        documentsResult,
        mongoQuery,
        traceResult
      };
    },
    {
      name: 'chatWithAgent',
      kind: 'AGENT'
    }
  )().then((res: any) => {
    const { trace } = require('@arizeai/phoenix-otel');
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes({
        'output.value': JSON.stringify(res)
      });
    }
    return res;
  });
}

export async function clearAgentSession(userId: string): Promise<void> {
  try {
    await (runner as any).sessionService.deleteSession({
      appName: (runner as any).appName,
      userId: userId,
      sessionId: userId
    });
    console.log(`[Agent] Successfully deleted Google ADK session for user: ${userId}`);
  } catch (err) {
    console.error(`[Agent] Failed to delete session for ${userId}:`, err);
  }
}
