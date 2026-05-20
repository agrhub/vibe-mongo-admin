"use strict";
/**
 * Callbacks for the Mongo Agent
 * Mirrors the pattern from google/adk-samples customer_service/shared_libraries/callbacks.ts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.rateLimitCallback = rateLimitCallback;
exports.beforeAgent = beforeAgent;
exports.beforeTool = beforeTool;
exports.afterTool = afterTool;
// Simple in-memory rate limiter
const requestTimestamps = [];
const RATE_LIMIT_WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 50;
/**
 * Rate limit callback — prevents hammering the Gemini API
 */
async function rateLimitCallback({ context, request }) {
    const now = Date.now();
    // Remove timestamps outside the window
    while (requestTimestamps.length > 0 && requestTimestamps[0] < now - RATE_LIMIT_WINDOW_MS) {
        requestTimestamps.shift();
    }
    if (requestTimestamps.length >= MAX_REQUESTS_PER_WINDOW) {
        console.warn('[RateLimit] Too many requests, throttling...');
        return undefined;
    }
    requestTimestamps.push(now);
    return undefined;
}
/**
 * Before agent callback — log agent start
 */
async function beforeAgent(context) {
    console.log(`[Agent] 🚀 Session: ${context.invocationContext?.session?.id || 'unknown'}`);
    return undefined;
}
/**
 * Before tool callback — log tool invocation
 */
async function beforeTool({ tool, args, context }) {
    console.log(`[Tool] ▶ ${tool.name}(${JSON.stringify(args).substring(0, 100)})`);
    return undefined;
}
/**
 * After tool callback — log tool result and handle errors
 */
async function afterTool({ tool, args, context, response }) {
    if (response?.error || response?.success === false) {
        console.error(`[Tool] ✗ ${tool.name} FAILED:`, response.error || 'Unknown error');
    }
    else {
        console.log(`[Tool] ✓ ${tool.name} → OK`);
    }
    return undefined;
}
