"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTracing = initTracing;
exports.traceMongoApiMiddleware = traceMongoApiMiddleware;
/**
 * OpenTelemetry Tracing — Arize Phoenix Integration
 *
 * Supports two modes:
 * 1. Arize Cloud (https://app.arize.com):
 *    Set PHOENIX_COLLECTOR_ENDPOINT=https://otlp.arize.com/v1/traces
 *    Set ARIZE_SPACE_ID=<your_space_id>
 *    Set PHOENIX_API_KEY=<your_api_key>
 *
 * 2. Local Phoenix Server (http://localhost:6006):
 *    pip install arize-phoenix && python -m phoenix.server.main serve
 *    Set PHOENIX_COLLECTOR_ENDPOINT=http://localhost:6006/v1/traces
 *    Set PHOENIX_PROJECT_NAME=vibe-mongo-admin
 */
const phoenix_otel_1 = require("@arizeai/phoenix-otel");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const instrumentation_mongodb_1 = require("@opentelemetry/instrumentation-mongodb");
const projectName = process.env.PHOENIX_PROJECT_NAME || 'vibe-mongo-admin';
const endpoint = process.env.PHOENIX_COLLECTOR_ENDPOINT || 'http://localhost:6006';
const apiKey = process.env.PHOENIX_API_KEY || '';
const sampleTrace = (0, phoenix_otel_1.traceChain)((input) => {
    // Your logic here
    return `Processed: ${input}`;
}, { name: "sample-trace" });
const sampleLLM = (0, phoenix_otel_1.withSpan)(async (messages) => {
    return "sampleLLM response";
}, {
    name: "sample-llm",
    kind: "LLM",
});
function initTracing() {
    try {
        const headers = {};
        // Use the official Phoenix OTel wrapper
        (0, phoenix_otel_1.register)({
            projectName,
            url: endpoint,
            headers: Object.keys(headers).length > 0 ? headers : undefined,
            // If not using Arize Cloud, Phoenix local doesn't require apiKey but respects it
            apiKey: apiKey ? apiKey : undefined,
        });
        // Register MongoDB driver instrumentation
        (0, instrumentation_1.registerInstrumentations)({
            instrumentations: [
                new instrumentation_mongodb_1.MongoDBInstrumentation({
                    enhancedDatabaseReporting: true,
                    // Tag every MongoDB driver span with OpenInference kind and populate
                    // input.value / output.value so the Phoenix Info tab shows query data.
                    responseHook: (span, responseInfo) => {
                        span.setAttributes({ 'openinference.span.kind': 'RETRIEVER' });
                        // db.statement is already set by MongoDBInstrumentation — reuse it as input
                        const dbStatement = span.attributes?.['db.statement'];
                        if (dbStatement) {
                            span.setAttributes({ 'input.value': dbStatement });
                        }
                        // Capture MongoDB command reply as output (truncated to 2000 chars)
                        try {
                            const reply = responseInfo?.data?.reply ?? responseInfo?.data;
                            if (reply !== undefined && reply !== null) {
                                span.setAttributes({
                                    'output.value': JSON.stringify(reply).slice(0, 2000)
                                });
                            }
                        }
                        catch { }
                    },
                }),
            ],
        });
        const mode = 'Phoenix (local/cloud)';
        console.log(`[OTEL] Tracing initialized in ${mode} mode → ${endpoint} (project: ${projectName})`);
        // sampleTrace(`[OTEL] Tracing initialized in ${mode} mode → ${endpoint} (project: ${projectName})`);
        // sampleLLM([]);
    }
    catch (err) {
        console.warn(`[OTEL] Tracing initialization skipped: ${err.message}`);
    }
}
// Auto-initialize tracing immediately when this module is imported
initTracing();
/**
 * Express middleware that wraps each MongoDB API request in an OpenInference RETRIEVAL span.
 * This ensures that standard UI database browsing operations (viewing documents,
 * listing collections, etc.) appear in the Arize Phoenix Traces panel alongside AI spans.
 */
function traceMongoApiMiddleware(req, res, next) {
    const { withSpan, trace } = require('@arizeai/phoenix-otel');
    const url = req.originalUrl || req.url || '';
    const method = req.method || 'GET';
    const spanName = `${method} ${url.split('?')[0]}`;
    withSpan(async () => {
        const span = trace.getActiveSpan();
        if (span) {
            const inputData = { method, url };
            if (['POST', 'PUT', 'PATCH'].includes(method) && req.body && Object.keys(req.body).length > 0) {
                try {
                    inputData.body = JSON.parse(JSON.stringify(req.body));
                }
                catch { }
            }
            span.setAttributes({ 'input.value': JSON.stringify(inputData) });
        }
        // Intercept JSON response to capture output
        const originalJson = res.json.bind(res);
        res.json = (body) => {
            const span = trace.getActiveSpan();
            if (span) {
                try {
                    const output = typeof body === 'string' ? body : JSON.stringify(body).slice(0, 2000);
                    span.setAttributes({ 'output.value': output });
                }
                catch { }
            }
            return originalJson(body);
        };
        return new Promise((resolve) => {
            res.on('finish', () => resolve());
            next();
        });
    }, { name: spanName, kind: 'CHAIN' })();
}
