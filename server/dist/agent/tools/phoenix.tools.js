"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
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
const GeminiService_js_1 = require("../../services/GeminiService.js");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
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
    let phoenixBaseUrl = endpoint;
    try {
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
        // Resolve local phoenix-mcp entry script
        const localMcpPath = path_1.default.join(process.cwd(), 'node_modules/@arizeai/phoenix-mcp/build/index.js');
        let mcpCommand = 'npx';
        let mcpArgs = ['--no-install', 'phoenix-mcp', '--baseUrl', phoenixBaseUrl];
        if (fs_1.default.existsSync(localMcpPath)) {
            mcpCommand = 'node';
            mcpArgs = [localMcpPath, '--baseUrl', phoenixBaseUrl];
            console.log(`[PhoenixMCP] Found local installation. Spawning directly with node pointing to ${phoenixBaseUrl}...`);
        }
        else {
            console.log(`[PhoenixMCP] Spawning @arizeai/phoenix-mcp via npx --no-install pointing to ${phoenixBaseUrl}...`);
        }
        const transport = new stdio_js_1.StdioClientTransport({
            command: mcpCommand,
            args: mcpArgs,
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
 * Run an evaluation on a specific trace or dataset using an LLM (Gemini).
 * This acts as the "LLM as a Judge" feature.
 */
async function runAgentEvaluation(traceId) {
    const client = await getPhoenixMcpClient();
    const projectName = process.env.PHOENIX_PROJECT_NAME || 'vibe-mongo-admin';
    let traceDetails = 'Trace details unavailable.';
    if (client) {
        try {
            const tools = await listPhoenixTools();
            if (tools.includes('get-trace')) {
                const trace = await callPhoenixTool('get-trace', { project_identifier: projectName, trace_id: traceId });
                if (trace)
                    traceDetails = JSON.stringify(trace).substring(0, 4000); // cap at 4000 chars for prompt
            }
        }
        catch (e) {
            console.error('[PhoenixMCP] Failed to fetch trace for evaluation', e);
        }
    }
    try {
        const prompt = `You are a database SRE AI Judge evaluating a trace from an AI Agent operating on MongoDB.
Analyze the following trace information for safety (destructive queries), correctness, performance, and security.
Trace ID: ${traceId}
Trace Details: ${traceDetails}

Please return a JSON object with your evaluation. Perform a deep Security Audit (checking for NoSQL Injection payload patterns, schema harvesting attempts, or data privacy/PII leak risks):
{
  "score": <number between 0 and 100>,
  "label": "<SAFE or UNSAFE or SUBOPTIMAL>",
  "reasoning": "<brief explanation of your judgement>",
  "securityStatus": "<SECURE or WARNING or VULNERABLE>",
  "securityAudit": "<detailed explanation of security auditing findings, NoSQL injection assessment, and data leak prevention results>"
}`;
        const parsed = await GeminiService_js_1.geminiService.generateJSON(prompt, "You are a database SRE AI Judge.");
        // Return a structured annotation object that matches Phoenix's format
        return {
            id: `llm-eval-${Date.now()}`,
            spanId: traceId,
            name: 'llm_judge_eval',
            annotator_kind: 'LLM',
            result: parsed
        };
    }
    catch (err) {
        console.error('[PhoenixMCP] LLM evaluation generation failed:', err.message);
        return null;
    }
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
async function collectPhoenixSnapshot(limit = 15) {
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
                limit: limit,
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
                    limit: limit,
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
                // console.log('[PhoenixMonitor] First span sample:', JSON.stringify(firstSpan, null, 2).substring(0, 500));
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
                    // Fallback to start_time and end_time difference
                    const start = new Date(s.start_time ?? s.startTime).getTime();
                    const end = new Date(s.end_time ?? s.endTime).getTime();
                    if (!isNaN(start) && !isNaN(end)) {
                        return Math.max(0, end - start);
                    }
                    return null;
                };
                const extractTokens = (s) => {
                    const attrs = s.attributes || {};
                    const prompt = attrs["llm.token_count.prompt"] ??
                        attrs["token_count.prompt"] ??
                        attrs["llm_token_count_prompt"] ??
                        s.llmTokenCountPrompt ??
                        s.prompt_token_count ??
                        s.cumulative_llm_token_count_prompt ??
                        0;
                    const completion = attrs["llm.token_count.completion"] ??
                        attrs["token_count.completion"] ??
                        attrs["llm_token_count_completion"] ??
                        s.llmTokenCountCompletion ??
                        s.completion_token_count ??
                        s.cumulative_llm_token_count_completion ??
                        0;
                    const total = attrs["llm.token_count.total"] ??
                        attrs["token_count.total"] ??
                        s.total_token_count ??
                        0;
                    const sum = Number(prompt) + Number(completion);
                    return sum > 0 ? sum : Number(total);
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
                const promptTokens = rawSpans.reduce((sum, s) => sum + (s.attributes?.["llm.token_count.prompt"] ??
                    s.attributes?.["token_count.prompt"] ??
                    s.llmTokenCountPrompt ??
                    s.prompt_token_count ??
                    s.cumulative_llm_token_count_prompt ?? 0), 0);
                const completionTokens = rawSpans.reduce((sum, s) => sum + (s.attributes?.["llm.token_count.completion"] ??
                    s.attributes?.["token_count.completion"] ??
                    s.llmTokenCountCompletion ??
                    s.completion_token_count ??
                    s.cumulative_llm_token_count_completion ?? 0), 0);
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
                    rootSpans: rawSpans.map((s) => ({
                        traceId: s.traceId ?? s.trace_id ?? s.context?.trace_id ?? s.id ?? '',
                        spanId: s.spanId ?? s.span_id ?? s.context?.span_id ?? s.id ?? '',
                        name: s.name ?? s.spanName ?? 'unknown',
                        durationMs: extractLatencyMs(s) ?? 0,
                        statusCode: (s.statusCode ?? s.status_code ?? s.status ?? 'OK').toString(),
                        startTime: s.start_time ?? s.startTime ?? new Date().toISOString(),
                        kind: (s.spanKind ?? s.kind ?? 'chain').toString().toLowerCase(),
                        input: String(s.attributes?.["input.value"] ?? s.attributes?.["db.statement"] ?? '').slice(0, 200),
                        output: String(s.attributes?.["output.value"] ?? s.attributes?.["db.response"] ?? s.attributes?.["response"] ?? s.attributes?.["llm.output"] ?? s.output ?? '').slice(0, 200),
                        db: s.attributes?.["db.name"] ?? '',
                        collection: s.attributes?.["db.mongodb.collection"] ?? '',
                        totalTokens: extractTokens(s),
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
    const generateMockSpans = () => {
        const list = [];
        const ops = [
            { name: 'find', db: 'sample_mflix', coll: 'movies', input: '{"year": {"$lt": 1990}, "genres": "Drama"}', latency: 220 },
            { name: 'aggregate', db: 'sample_airbnb', coll: 'listingsAndReviews', input: '[{"$match": {"room_type": "Entire home/apt"}}, {"$group": {"_id": "$address.country", "avgPrice": {"$avg": "$price"}}}]', latency: 2269 },
            { name: 'stats', db: 'sample_airbnb', coll: '', input: '{"dbStats": 1}', latency: 2150 },
            { name: 'mongodb.aggregate', db: 'sample_geospatial', coll: 'shipwrecks', input: '[{"$match": {"coordinates": {"$geoWithin": {"$centerSphere": [[-73.935242, 40.73061], 0.1]}}}}]', latency: 2100 },
            { name: 'find', db: 'sample_mflix', coll: 'comments', input: '{"movie_id": {"$oid": "573a1390f293160aaa410519"}}', latency: 45 },
            { name: 'insertOne', db: 'sample_supplies', coll: 'sales', input: '{"storeLocation": "Denver", "items": [{"name": "binder", "tags": ["office"]}]}', latency: 120 },
            { name: 'updateOne', db: 'sample_analytics', coll: 'accounts', input: '{"account_id": 371138}, {"$set": {"limit": 10000}}', latency: 280 },
            { name: 'deleteMany', db: 'sample_training', coll: 'grades', input: '{"student_id": {"$gt": 10000}}', latency: 740 },
            { name: 'gemini.generateText', db: '', coll: '', input: '{"model": "gemini-3.1-flash-lite", "prompt": "Analyze database health..."}', latency: 1540, kind: 'llm', tokens: 840 },
            { name: 'getServerStatus', db: 'admin', coll: '', input: '{"serverStatus": 1}', latency: 85 }
        ];
        for (let i = 0; i < 50; i++) {
            const op = ops[i % ops.length];
            const isSlow = i === 1 || i === 2 || i === 3 || i === 8 || i === 11 || i === 21;
            const isError = i === 7 || i === 17;
            const durationMs = isSlow ? op.latency + Math.floor(Math.random() * 300) : Math.floor(Math.random() * 150) + 10;
            list.push({
                traceId: `t-mock-trace-${100000 + i}`,
                spanId: `s-mock-span-${200000 + i}`,
                name: op.name,
                durationMs,
                statusCode: isError ? 'ERROR' : 'OK',
                startTime: new Date(Date.now() - i * 60000).toISOString(),
                kind: op.kind || (op.name.includes('gemini') ? 'llm' : op.name.includes('tool') ? 'tool' : 'chain'),
                input: op.input,
                output: isError ? '{"ok": 0, "errmsg": "Connection pool timeout"}' : '{"ok": 1, "nModified": 1}',
                db: op.db,
                collection: op.coll,
                totalTokens: op.tokens || 0
            });
        }
        return list;
    };
    const mockSpans = generateMockSpans();
    const ok = mockSpans.filter(s => s.statusCode === 'OK').length;
    const error = mockSpans.filter(s => s.statusCode === 'ERROR').length;
    const llmOk = mockSpans.filter(s => s.kind === 'llm' && s.statusCode === 'OK').length;
    const toolOk = mockSpans.filter(s => s.kind === 'tool' && s.statusCode === 'OK').length;
    return {
        source: 'simulated',
        date: dateKey,
        timestamp: now,
        totalSpans: mockSpans.length,
        ok, error,
        p50: 0.125,
        p75: 0.450,
        p90: 1.540,
        p95: 2.150,
        p99: 2.380,
        llmOk, llmErr: mockSpans.filter(s => s.kind === 'llm' && s.statusCode === 'ERROR').length,
        toolOk, toolErr: mockSpans.filter(s => s.kind === 'tool' && s.statusCode === 'ERROR').length,
        promptTokens: 4200,
        completionTokens: 1800,
        rootSpans: mockSpans,
    };
}
/**
 * @deprecated Use collectPhoenixSnapshot + stored NeDB data instead.
 * Kept for backward compatibility.
 */
async function getPhoenixFullMetrics() {
    return collectPhoenixSnapshot();
}
