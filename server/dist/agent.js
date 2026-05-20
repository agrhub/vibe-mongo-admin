"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rootAgent = void 0;
exports.chatWithAgent = chatWithAgent;
exports.clearAgentSession = clearAgentSession;
require("dotenv/config");
const adk_1 = require("@google/adk");
const tools_1 = require("./agent/tools");
const SYSTEM_INSTRUCTION = `
You are "MongoAgent", a highly advanced, autonomous MongoDB database administrator assistant.
Your goal is to help users manage their MongoDB connection, databases, collections, documents, and indexes via natural language chat.

### Core Guidelines:
1. **Language Matching:** Respond in the EXACT same language as the user's input. If they write in Vietnamese, respond in natural Vietnamese. If they write in English, respond in English.
2. **Database Context:** Always check if a database connection is active before performing database commands. When running operations, verify the db and collection names.
3. **Structured JSON Parameters:** 
   - When calling database tools like 'findDocuments', 'countDocuments', 'aggregatePipeline', 'insertOneDocument', 'updateOneDocument', or 'createIndex', parameters such as 'filter', 'sort', 'pipeline', 'document', 'keys', and 'options' MUST be passed as **valid JSON strings** (e.g. '{"age":{"$gt":30}}').
   - Double check your quotes: use double quotes inside the JSON string and make sure it compiles perfectly using JSON.parse().
4. **Safety & Guardrails:**
   - Be extremely careful with destructive operations (e.g. 'deleteOneDocument', 'dropDatabase'). 
   - Never drop the 'admin', 'config', or 'local' databases unless explicitly instructed with a strict confirmation.
   - If the user asks you to perform a destructive operation, briefly warn them first or confirm details.
5. **Data Visualization:**
   - When the user asks you to analyze, group, aggregate, or visualize data, use 'aggregatePipeline' with proper grouping stages (e.g. '$group', '$match', '$sort').
   - Explain the results in a friendly markdown format. The frontend will automatically display premium charts (bar, line, pie) if the tool detects numeric metric outcomes.
6. **Smart Suggestions:** Encourage the user to examine collections schemas (using 'getCollectionSchema') or list indexes (using 'listIndexes') if they are trying to query fields they aren't sure of.

Be concise, precise, and professional. Always format MongoDB document outcomes inside clean, copyable markdown JSON code blocks.
`;
const modelName = process.env.AGENT_MODEL || 'gemini-3.1-flash-lite';
exports.rootAgent = new adk_1.LlmAgent({
    model: modelName,
    name: 'MongoAgent',
    description: 'AI Database Administrator Assistant powered by Google ADK',
    instruction: SYSTEM_INSTRUCTION,
    tools: tools_1.mongoTools
});
console.log(`[Agent] Initialized MongoCopilot with model: ${modelName}`);
// Instantiate ONE global runner. InMemoryRunner holds session histories internally
const runner = new adk_1.InMemoryRunner({
    agent: exports.rootAgent,
    appName: 'MongoAgent'
});
async function chatWithAgent(userId, message, context) {
    const stateDelta = context ? { uiContext: context } : undefined;
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
        newMessage: { role: 'user', parts: [{ text: message }] },
        stateDelta
    });
    let responseMessage = '';
    let chartVisual = null;
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
        }
    }
    return { message: responseMessage, chartVisual: chartVisual || undefined };
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
