"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initTracing = initTracing;
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
 *    (no API key required for local)
 */
const exporter_trace_otlp_proto_1 = require("@opentelemetry/exporter-trace-otlp-proto");
const instrumentation_1 = require("@opentelemetry/instrumentation");
const resources_1 = require("@opentelemetry/resources");
const sdk_trace_node_1 = require("@opentelemetry/sdk-trace-node");
const instrumentation_mongodb_1 = require("@opentelemetry/instrumentation-mongodb");
const projectName = process.env.PHOENIX_PROJECT_NAME || 'vibe-mongo-admin';
const endpoint = process.env.PHOENIX_COLLECTOR_ENDPOINT || 'http://localhost:6006/v1/traces';
const apiKey = process.env.PHOENIX_API_KEY || '';
const arizeSpaceId = process.env.ARIZE_SPACE_ID || '';
// Build headers — supports both Arize cloud format and Phoenix local server format
const headers = {};
if (arizeSpaceId && apiKey) {
    // Arize Cloud mode: requires space_id + api_key headers
    headers['space_id'] = arizeSpaceId;
    headers['api_key'] = apiKey;
}
else {
    // Phoenix Local/Cloud mode: project name header
    headers['phoenix-project-name'] = projectName;
    if (apiKey) {
        headers['authorization'] = `Bearer ${apiKey}`;
    }
}
const exporter = new exporter_trace_otlp_proto_1.OTLPTraceExporter({ url: endpoint, headers });
const provider = new sdk_trace_node_1.NodeTracerProvider({
    resource: (0, resources_1.resourceFromAttributes)({
        'openinference.project.name': projectName,
        'service.name': projectName,
    }),
    spanProcessors: [new sdk_trace_node_1.SimpleSpanProcessor(exporter)],
});
// Register MongoDB driver instrumentation — all DB operations will become OTEL spans
(0, instrumentation_1.registerInstrumentations)({
    instrumentations: [
        new instrumentation_mongodb_1.MongoDBInstrumentation({
            enhancedDatabaseReporting: true,
        }),
    ],
    tracerProvider: provider,
});
function initTracing() {
    try {
        provider.register();
        const mode = arizeSpaceId ? 'Arize Cloud' : 'Phoenix (local/cloud)';
        console.log(`[OTEL] Tracing initialized in ${mode} mode → ${endpoint} (project: ${projectName})`);
    }
    catch (err) {
        console.warn(`[OTEL] Tracing initialization skipped: ${err.message}`);
    }
}
process.on('SIGTERM', () => {
    provider.shutdown()
        .then(() => console.log('[OTEL] Tracing terminated.'))
        .catch((error) => console.error('[OTEL] Error shutting down tracing:', error))
        .finally(() => process.exit(0));
});
