"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listPhoenixTools = listPhoenixTools;
exports.getSlowQueryTraces = getSlowQueryTraces;
exports.runAgentEvaluation = runAgentEvaluation;
exports.getSpanAnnotations = getSpanAnnotations;
exports.collectPhoenixSnapshot = collectPhoenixSnapshot;
exports.getPhoenixFullMetrics = getPhoenixFullMetrics;
exports.callPhoenixTool = callPhoenixTool;
exports.getPhoenixMcpClient = getPhoenixMcpClient;
const index_js_1 = require("@modelcontextprotocol/sdk/client/index.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/client/stdio.js");
let phoenixMcpClient = null;
/**
 * Lazy initializer for the Arize Phoenix MCP server subprocess.
 * Uses @arizeai/phoenix-mcp over Standard I/O.
 */
async function getPhoenixMcpClient() {
    if (phoenixMcpClient)
        return phoenixMcpClient;
    const endpoint = process.env.PHOENIX_COLLECTOR_ENDPOINT || 'http://localhost:6006';
    const apiKey = process.env.PHOENIX_API_KEY || '';
    const projectName = process.env.PHOENIX_PROJECT_NAME || 'vibe-mongo-admin';
    // For Arize Cloud (AX), the API base URL is app.phoenix.arize.com, but ingestion is otlp.arize.com
    // For Local Phoenix, both are typically http://localhost:6006
    let phoenixBaseUrl = endpoint; //'http://localhost:6006';
    // if (endpoint.includes('arize.com')) {
    //   phoenixBaseUrl = 'https://app.phoenix.arize.com';
    // } else {
    //   phoenixBaseUrl = endpoint.replace(/\/v1\/traces\/?$/, '').replace(/\/$/, '');
    // }
    try {
        console.log(`[PhoenixMCP] Spawning @arizeai/phoenix-mcp pointing to ${phoenixBaseUrl}...`);
        const env = {
            ...Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== undefined)),
            PHOENIX_BASE_URL: phoenixBaseUrl,
            PHOENIX_PROJECT_NAME: projectName,
            PHOENIX_PROJECT: projectName,
            PHOENIX_COLLECTOR_ENDPOINT: endpoint,
        };
        if (apiKey) {
            env['PHOENIX_API_KEY'] = apiKey;
            env['ARIZE_API_KEY'] = apiKey;
        }
        const transport = new stdio_js_1.StdioClientTransport({
            command: 'npx',
            args: ['-y', '@arizeai/phoenix-mcp@latest', '--baseUrl', phoenixBaseUrl],
            env,
        });
        const client = new index_js_1.Client({ name: 'phoenix-agent-client', version: '1.0.0' }, { capabilities: {} });
        await client.connect(transport);
        phoenixMcpClient = client;
        console.log('[PhoenixMCP] Connected to Arize Phoenix MCP server successfully!');
        return phoenixMcpClient;
    }
    catch (err) {
        console.error('[PhoenixMCP] Failed to connect to Phoenix MCP server:', err.message);
        return null;
    }
}
/**
 * Generic tool caller for Phoenix MCP.
 */
async function callPhoenixTool(toolName, args) {
    const client = await getPhoenixMcpClient();
    if (!client)
        return null;
    try {
        console.log(`[PhoenixMCP] Calling tool: ${toolName}`, args);
        const response = await client.callTool({ name: toolName, arguments: args });
        const content = (response.content || []);
        if (response.isError) {
            const msg = content.find((c) => c.type === 'text')?.text || 'Unknown Phoenix MCP error';
            throw new Error(msg);
        }
        const text = content.find((c) => c.type === 'text')?.text || '{}';
        try {
            return JSON.parse(text);
        }
        catch (parseErr) {
            // If it's not JSON (e.g. "ok"), return the raw text if it's not empty
            return text && text !== '{}' ? text : null;
        }
    }
    catch (err) {
        console.error(`[PhoenixMCP] Tool call failed for ${toolName}:`, err.message);
        return null;
    }
}
/**
 * Lists available tools in the Phoenix MCP server.
 */
async function listPhoenixTools() {
    const client = await getPhoenixMcpClient();
    if (!client)
        return [];
    try {
        const toolsResult = await client.listTools();
        console.log('[PhoenixMCP] Tool Schemas:', JSON.stringify(toolsResult.tools, null, 2));
        return (toolsResult.tools || []).map((t) => t.name);
    }
    catch (err) {
        console.error('[PhoenixMCP] Failed to list tools:', err.message);
        return [];
    }
}
/**
 * Get a summary of slow database span traces from Arize Phoenix.
 * Falls back to simulated data if Phoenix is not reachable.
 */
async function getSlowQueryTraces(minDurationMs = 500) {
    const client = await getPhoenixMcpClient();
    const projectName = process.env.PHOENIX_PROJECT_NAME || 'vibe-mongo-admin';
    if (client) {
        // Try to use Phoenix MCP's query/search capabilities
        const tools = await listPhoenixTools();
        console.log('[PhoenixMCP] Available tools:', tools);
        // Try candidates first (these are the most likely tools)
        const candidates = [
            { name: 'list-traces', params: { projectIdentifier: projectName, limit: 10 } },
            { name: 'get-spans', params: { projectIdentifier: projectName, limit: 10 } },
            { name: 'list-projects', params: { limit: 10 } },
        ];
        for (const candidate of candidates) {
            if (tools.includes(candidate.name)) {
                try {
                    const result = await callPhoenixTool(candidate.name, candidate.params);
                    if (result && result !== 'ok') {
                        return { source: 'phoenix_mcp', tool: candidate.name, data: result };
                    }
                }
                catch (e) {
                    console.warn(`[PhoenixMCP] Candidate ${candidate.name} failed, trying next...`);
                }
            }
        }
        // Fallback search for any tool that looks like it queries spans/traces
        const spanQueryTools = tools.filter(t => (t.includes('span') || t.includes('trace') || t.includes('query')) &&
            !['get-trace', 'get-session', 'get-prompt', 'get-span-annotations'].includes(t));
        for (const tool of spanQueryTools) {
            try {
                const result = await callPhoenixTool(tool, {
                    projectIdentifier: projectName,
                    project_name: projectName,
                    limit: 10,
                });
                if (result && result !== 'ok') {
                    return { source: 'phoenix_mcp', tool, data: result };
                }
            }
            catch (e) {
                // Continue to next tool
            }
        }
    }
    // Graceful fallback — simulated for demo if Phoenix is not running
    console.warn('[PhoenixMCP] Phoenix not reachable. Returning simulated trace data for demo.');
    return {
        source: 'simulated',
        note: 'Connect a running Arize Phoenix instance (PHOENIX_COLLECTOR_ENDPOINT) for live traces.',
        status: 'WARNING',
        cpuUsage: 89.2,
        memoryUsagePercent: 74.5,
        activeSpanCount: 1420,
        traceSummary: 'Critical slow queries detected on MongoDB connection (simulated demo data).',
        slowQueries: [
            {
                traceId: 'span-98124a',
                db: 'sample_mflix',
                collection: 'comments',
                operation: 'find',
                filter: '{"movie_id": {"$oid": "573a1390f293160aaa410519"}}',
                durationMs: 2150,
                frequencyPerMin: 45
            },
            {
                traceId: 'span-98125b',
                db: 'sample_mflix',
                collection: 'movies',
                operation: 'find',
                filter: '{"year": {"$lt": 1990}, "genres": "Drama"}',
                durationMs: 1820,
                frequencyPerMin: 12
            }
        ]
    };
}
/**
 * Run an evaluation on a specific trace or dataset using Phoenix MCP.
 */
async function runAgentEvaluation(traceId) {
    const client = await getPhoenixMcpClient();
    if (!client) {
        console.warn('[PhoenixMCP] Phoenix not reachable. Returning simulated evaluation data.');
        return { status: 'simulated', traceId, safetyScore: 0.95, correctnessScore: 0.88, feedback: 'Simulated: Query logic is mostly sound but missing an index.' };
    }
    const projectName = process.env.PHOENIX_PROJECT_NAME || 'vibe-mongo-admin';
    return await callPhoenixTool('run-evaluation', { projectIdentifier: projectName, traceId });
}
/**
 * Retrieve annotations (user feedback, eval results) for a specific span.
 */
async function getSpanAnnotations(spanId) {
    const client = await getPhoenixMcpClient();
    if (!client) {
        console.warn('[PhoenixMCP] Phoenix not reachable. Returning simulated annotation data.');
        return [{ id: 'anno-1', spanId, name: 'user_feedback', score: 1, label: 'thumbs_up' }];
    }
    return await callPhoenixTool('get-span-annotations', { spanId });
}
/**
 * Collect a single Phoenix metrics snapshot by fetching real spans from MCP.
 * Falls back to simulated data if Phoenix is not reachable.
 * This is intended to be called periodically by the monitoring cron job.
 */
async function collectPhoenixSnapshot() {
    const client = await getPhoenixMcpClient();
    const projectName = process.env.PHOENIX_PROJECT_NAME || 'vibe-mongo-admin';
    const now = new Date();
    const dateKey = `${now.getMonth() + 1}/${now.getDate()}`;
    if (client) {
        try {
            // Try to use get-spans first (full span list with latency info)
            let rawSpans = null;
            const spansResult = await callPhoenixTool('get-spans', {
                projectIdentifier: projectName,
                limit: 200,
            });
            // Phoenix MCP may return spans as an array or as an object with a spans/data field
            if (Array.isArray(spansResult)) {
                rawSpans = spansResult;
            }
            else if (spansResult?.data) {
                rawSpans = Array.isArray(spansResult.data) ? spansResult.data : null;
            }
            else if (spansResult?.spans) {
                rawSpans = Array.isArray(spansResult.spans) ? spansResult.spans : null;
            }
            // If get-spans didn't work, try list-traces
            if (!rawSpans) {
                const tracesResult = await callPhoenixTool('list-traces', {
                    projectIdentifier: projectName,
                    limit: 200,
                });
                if (Array.isArray(tracesResult))
                    rawSpans = tracesResult;
                else if (tracesResult?.traces)
                    rawSpans = tracesResult.traces;
                else if (tracesResult?.data)
                    rawSpans = tracesResult.data;
            }
            if (rawSpans && rawSpans.length > 0) {
                // Debug: log first span keys so we can identify the correct field names
                const firstSpan = rawSpans[0];
                console.log('[PhoenixMonitor] First span keys:', Object.keys(firstSpan));
                console.log('[PhoenixMonitor] First span sample:', JSON.stringify(firstSpan, null, 2).substring(0, 500));
                // Extract latency values (in ms). Try all known Phoenix field name variants
                const extractLatencyMs = (s) => {
                    // Direct ms fields
                    if (typeof s.durationMs === 'number' && s.durationMs > 0)
                        return s.durationMs;
                    if (typeof s.latencyMs === 'number' && s.latencyMs > 0)
                        return s.latencyMs;
                    if (typeof s.duration_ms === 'number' && s.duration_ms > 0)
                        return s.duration_ms;
                    if (typeof s.latency_ms === 'number' && s.latency_ms > 0)
                        return s.latency_ms;
                    // Seconds fields (convert to ms)
                    if (typeof s.latencySeconds === 'number' && s.latencySeconds > 0)
                        return s.latencySeconds * 1000;
                    if (typeof s.latency_seconds === 'number' && s.latency_seconds > 0)
                        return s.latency_seconds * 1000;
                    if (typeof s.duration === 'number' && s.duration > 0)
                        return s.duration > 1000 ? s.duration : s.duration * 1000;
                    // Nanosecond fields (convert to ms)
                    if (typeof s.durationNs === 'number' && s.durationNs > 0)
                        return s.durationNs / 1_000_000;
                    if (typeof s.duration_ns === 'number' && s.duration_ns > 0)
                        return s.duration_ns / 1_000_000;
                    // Cumulative token fields as proxy (less accurate)
                    if (typeof s.cumulative_llm_token_count_completion === 'number')
                        return null;
                    return null;
                };
                const latencies = rawSpans
                    .map(extractLatencyMs)
                    .filter((v) => v !== null && v > 0);
                latencies.sort((a, b) => a - b);
                const percentile = (arr, p) => {
                    if (arr.length === 0)
                        return 0;
                    const idx = Math.max(0, Math.ceil((p / 100) * arr.length) - 1);
                    return arr[idx];
                };
                const p50 = parseFloat((percentile(latencies, 50) / 1000).toFixed(3));
                const p75 = parseFloat((percentile(latencies, 75) / 1000).toFixed(3));
                const p90 = parseFloat((percentile(latencies, 90) / 1000).toFixed(3));
                const p95 = parseFloat((percentile(latencies, 95) / 1000).toFixed(3));
                const p99 = parseFloat((percentile(latencies, 99) / 1000).toFixed(3));
                // Count OK vs Error spans
                const isError = (s) => (s.statusCode ?? s.status_code ?? s.status ?? '').toString().toUpperCase() === 'ERROR';
                const okCount = rawSpans.filter(s => !isError(s)).length;
                const errorCount = rawSpans.filter(s => isError(s)).length;
                // Categorize by span kind
                const llmSpans = rawSpans.filter((s) => (s.spanKind ?? s.span_kind ?? s.kind ?? '').toString().toLowerCase().includes('llm'));
                const toolSpans = rawSpans.filter((s) => (s.spanKind ?? s.span_kind ?? s.kind ?? '').toString().toLowerCase().includes('tool'));
                // Token usage (summed)
                const promptTokens = rawSpans.reduce((sum, s) => sum + (s.llmTokenCountPrompt ?? s.prompt_token_count ?? s.cumulative_llm_token_count_prompt ?? 0), 0);
                const completionTokens = rawSpans.reduce((sum, s) => sum + (s.llmTokenCountCompletion ?? s.completion_token_count ?? s.cumulative_llm_token_count_completion ?? 0), 0);
                console.log(`[PhoenixMonitor] Snapshot collected: ${rawSpans.length} spans, P50=${p50}s, P99=${p99}s, OK=${okCount}, ERR=${errorCount}, LLM=${llmSpans.length}, Tool=${toolSpans.length}`);
                return {
                    source: 'live',
                    date: dateKey,
                    timestamp: now,
                    totalSpans: rawSpans.length,
                    ok: okCount,
                    error: errorCount,
                    p50, p75, p90, p95, p99,
                    llmOk: llmSpans.filter(s => !isError(s)).length,
                    llmErr: llmSpans.filter(s => isError(s)).length,
                    toolOk: toolSpans.filter(s => !isError(s)).length,
                    toolErr: toolSpans.filter(s => isError(s)).length,
                    promptTokens,
                    completionTokens,
                    // Root spans for the Spans table
                    rootSpans: rawSpans.slice(0, 50).map((s) => ({
                        traceId: s.traceId ?? s.trace_id ?? s.id ?? '',
                        name: s.name ?? s.spanName ?? 'unknown',
                        durationMs: s.durationMs ?? s.latencyMs ?? s.duration_ms ?? 0,
                        statusCode: (s.statusCode ?? s.status_code ?? s.status ?? 'OK').toString(),
                        db: '',
                        collection: '',
                    })),
                };
            }
        }
        catch (err) {
            console.warn('[PhoenixMonitor] Failed to collect live snapshot:', err.message);
        }
    }
    // Graceful fallback — simulated for demo if Phoenix is not running
    console.warn('[PhoenixMonitor] Phoenix not reachable. Generating simulated snapshot.');
    const ok = Math.floor(Math.random() * 50) + 10;
    const error = Math.floor(Math.random() * 5);
    const llmOk = Math.floor(ok * 0.6);
    const toolOk = Math.floor(ok * 0.3);
    return {
        source: 'simulated',
        date: dateKey,
        timestamp: now,
        totalSpans: ok + error,
        ok, error,
        p50: parseFloat((Math.random() * 0.3 + 0.05).toFixed(3)),
        p75: parseFloat((Math.random() * 0.8 + 0.2).toFixed(3)),
        p90: parseFloat((Math.random() * 1.5 + 0.3).toFixed(3)),
        p95: parseFloat((Math.random() * 3 + 0.8).toFixed(3)),
        p99: parseFloat((Math.random() * 5 + 1).toFixed(3)),
        llmOk, llmErr: Math.floor(Math.random() * 3),
        toolOk, toolErr: Math.floor(Math.random() * 2),
        promptTokens: Math.floor(Math.random() * 5000),
        completionTokens: Math.floor(Math.random() * 2000),
        rootSpans: [],
    };
}
/**
 * @deprecated Use collectPhoenixSnapshot + stored NeDB data instead.
 * Kept for backward compatibility.
 */
async function getPhoenixFullMetrics() {
    return collectPhoenixSnapshot();
}
