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
}> {
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
  const suggRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/;
  const match = responseMessage.match(suggRegex);
  if (match) {
    try {
      const cleanJson = match[1].replace(/```json/g, '').replace(/```/g, '').trim();
      suggestions = JSON.parse(cleanJson);
    } catch (e) {
      console.error('[Agent] Failed to parse suggestions from response:', e);
    }
    // Remove the suggestions block from the display message
    responseMessage = responseMessage.replace(suggRegex, '').trim();
  }

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

  return {
    message: responseMessage,
    chartVisual: chartVisual || undefined,
    navigation: navigation || undefined,
    suggestions: suggestions.length > 0 ? suggestions : undefined,
    databases,
    collectionsInfo
  };
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
