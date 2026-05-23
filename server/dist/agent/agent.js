"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rootAgent = void 0;
exports.chatWithAgent = chatWithAgent;
exports.clearAgentSession = clearAgentSession;
require("dotenv/config");
const adk_1 = require("@google/adk");
const tools_1 = require("./tools");
const prompts_1 = require("./prompts");
const callbacks_1 = require("./shared_libraries/callbacks");
const modelName = process.env.AGENT_MODEL || 'gemini-3.1-flash-lite';
exports.rootAgent = new adk_1.LlmAgent({
    model: modelName,
    name: 'MongoAgent',
    description: 'AI Database Administrator Assistant powered by Google ADK',
    instruction: prompts_1.SYSTEM_INSTRUCTION,
    tools: tools_1.mongoTools,
    beforeToolCallback: callbacks_1.beforeTool,
    afterToolCallback: callbacks_1.afterTool,
    beforeModelCallback: callbacks_1.rateLimitCallback,
});
console.log(`[Agent] Initialized MongoAgent with model: ${modelName}`);
// Instantiate ONE global runner. InMemoryRunner holds session histories internally
const runner = new adk_1.InMemoryRunner({
    agent: exports.rootAgent,
    appName: 'MongoAgent'
});
async function chatWithAgent(userId, message, context) {
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
    const existingSession = await runner.sessionService.getSession({
        appName: runner.appName,
        userId: userId,
        sessionId: userId
    });
    if (!existingSession) {
        await runner.sessionService.createSession({
            appName: runner.appName,
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
    let chartVisual = null;
    let navigation = null;
    let documentsResult;
    for await (const event of eventGenerator) {
        const textParts = event.content?.parts?.map((p) => p.text).filter(Boolean) || [];
        if (textParts.length > 0) {
            responseMessage += textParts.join('');
        }
        const responses = (0, adk_1.getFunctionResponses)(event);
        for (const resp of responses) {
            if (resp.response && resp.response.chartVisual) {
                chartVisual = resp.response.chartVisual;
            }
            if (resp.response && resp.response.navigation) {
                navigation = resp.response.navigation;
            }
        }
    }
    // Extract suggestions from [SUGGESTIONS]...[/SUGGESTIONS] block
    let suggestions = [];
    const suggRegex = /\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/;
    const match = responseMessage.match(suggRegex);
    if (match) {
        try {
            const cleanJson = match[1].replace(/```json/g, '').replace(/```/g, '').trim();
            suggestions = JSON.parse(cleanJson);
        }
        catch (e) {
            console.error('[Agent] Failed to parse suggestions from response:', e);
        }
        // Remove the suggestions block from the display message
        responseMessage = responseMessage.replace(suggRegex, '').trim();
    }
    // Extract databases from [DATABASES]...[/DATABASES] block
    let databases;
    const dbRegex = /\[DATABASES\]([\s\S]*?)\[\/DATABASES\]/;
    const dbMatch = responseMessage.match(dbRegex);
    if (dbMatch) {
        try {
            const cleanJson = dbMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
            databases = JSON.parse(cleanJson);
        }
        catch (e) {
            console.error('[Agent] Failed to parse databases block:', e);
        }
        responseMessage = responseMessage.replace(dbRegex, '').trim();
    }
    // Extract collections from [COLLECTIONS]...[/COLLECTIONS] block
    let collectionsInfo;
    const collRegex = /\[COLLECTIONS\]([\s\S]*?)\[\/COLLECTIONS\]/;
    const collMatch = responseMessage.match(collRegex);
    if (collMatch) {
        try {
            const cleanJson = collMatch[1].replace(/```json/g, '').replace(/```/g, '').trim();
            collectionsInfo = JSON.parse(cleanJson);
        }
        catch (e) {
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
        }
        catch (e) {
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
        }
        catch (e) {
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
        }
        catch (e) {
            console.error('[Agent] Failed to parse documents block:', e);
        }
        responseMessage = responseMessage.replace(docsRegex, '').trim();
    }
    // Extract standalone mongoQuery from [QUERY]...[/QUERY] block
    let mongoQuery;
    const queryRegex = /\[QUERY\]([\s\S]*?)\[\/QUERY\]/;
    const queryMatch = responseMessage.match(queryRegex);
    if (queryMatch) {
        mongoQuery = queryMatch[1].replace(/```javascript/g, '').replace(/```json/g, '').replace(/```/g, '').trim();
        responseMessage = responseMessage.replace(queryRegex, '').trim();
    }
    return {
        message: responseMessage,
        chartVisual: chartVisual || undefined,
        navigation: navigation || undefined,
        suggestions: suggestions.length > 0 ? suggestions : undefined,
        databases,
        collectionsInfo,
        documentsResult,
        mongoQuery
    };
}
async function clearAgentSession(userId) {
    try {
        await runner.sessionService.deleteSession({
            appName: runner.appName,
            userId: userId,
            sessionId: userId
        });
        console.log(`[Agent] Successfully deleted Google ADK session for user: ${userId}`);
    }
    catch (err) {
        console.error(`[Agent] Failed to delete session for ${userId}:`, err);
    }
}
