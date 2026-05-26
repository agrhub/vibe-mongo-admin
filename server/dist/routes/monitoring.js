"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lodash_1 = __importDefault(require("lodash"));
const router = (0, express_1.Router)();
// ================= METRICS MONITORING =================
// Get monitoring charts data
router.get('/api/:conn/monitoring', function (req, res) {
    var dayBack = new Date();
    dayBack.setDate(dayBack.getDate() - 1);
    req.db.find({ connectionName: req.params.conn, eventDate: { $gte: dayBack } }).sort({ eventDate: 1 }).exec(function (err, serverEvents) {
        if (err || !serverEvents || serverEvents.length === 0) {
            return res.status(200).json({ dataRetrieved: false, data: {} });
        }
        var connectionsCurrent = [];
        var connectionsAvailable = [];
        var connectionsTotalCreated = [];
        var clientsTotal = [];
        var clientsReaders = [];
        var clientsWriters = [];
        var memoryVirtual = [];
        var memoryMapped = [];
        var memoryCurrent = [];
        var docsQueried = [];
        var docsInserted = [];
        var docsDeleted = [];
        var docsUpdated = [];
        if (serverEvents.length > 0) {
            if (serverEvents[0].dataRetrieved === true) {
                lodash_1.default.each(serverEvents, function (value, key) {
                    // connections
                    if (value.connections) {
                        connectionsCurrent.push({ x: value.eventDate, y: value.connections.current });
                        connectionsAvailable.push({ x: value.eventDate, y: value.connections.available });
                        connectionsTotalCreated.push({ x: value.eventDate, y: value.connections.totalCreated });
                    }
                    // clients
                    if (value.activeClients) {
                        clientsTotal.push({ x: value.eventDate, y: value.activeClients.total });
                        clientsReaders.push({ x: value.eventDate, y: value.activeClients.readers });
                        clientsWriters.push({ x: value.eventDate, y: value.activeClients.writers });
                    }
                    // memory
                    if (value.memory) {
                        memoryVirtual.push({ x: value.eventDate, y: value.memory.virtual });
                        memoryMapped.push({ x: value.eventDate, y: value.memory.mapped });
                        memoryCurrent.push({ x: value.eventDate, y: value.memory.resident });
                    }
                    if (value.docCounts) {
                        docsQueried.push({ x: value.eventDate, y: value.docCounts.queried });
                        docsInserted.push({ x: value.eventDate, y: value.docCounts.inserted });
                        docsDeleted.push({ x: value.eventDate, y: value.docCounts.deleted });
                        docsUpdated.push({ x: value.eventDate, y: value.docCounts.updated });
                    }
                });
            }
            var dataPointsLimit = 1000;
            var returnedData = {
                connectionsCurrent: averageDatapoints(connectionsCurrent, dataPointsLimit),
                connectionsAvailable: averageDatapoints(connectionsAvailable, dataPointsLimit),
                connectionsTotalCreated: averageDatapoints(connectionsTotalCreated, dataPointsLimit),
                clientsTotal: averageDatapoints(clientsTotal, dataPointsLimit),
                clientsReaders: averageDatapoints(clientsReaders, dataPointsLimit),
                clientsWriters: averageDatapoints(clientsWriters, dataPointsLimit),
                memoryVirtual: averageDatapoints(memoryVirtual, dataPointsLimit),
                memoryMapped: averageDatapoints(memoryMapped, dataPointsLimit),
                memoryCurrent: averageDatapoints(memoryCurrent, dataPointsLimit),
                docsQueried: averageDatapoints(docsQueried, dataPointsLimit),
                docsInserted: averageDatapoints(docsInserted, dataPointsLimit),
                docsDeleted: averageDatapoints(docsDeleted, dataPointsLimit),
                docsUpdated: averageDatapoints(docsUpdated, dataPointsLimit)
            };
            var uptime = (serverEvents[0].uptime / 60).toFixed(2);
            if (uptime > 61) {
                uptime = (uptime / 60).toFixed(2) + ' hours';
            }
            else {
                uptime = uptime + ' minutes';
            }
            if (err) {
                res.status(400).json({ 'msg': 'Could not get server monitoring' });
            }
            else {
                res.status(200).json({ data: returnedData, dataRetrieved: serverEvents[0].dataRetrieved, pid: serverEvents[0].pid, version: serverEvents[0].version, uptime: uptime });
            }
        }
    });
});
// Get Phoenix metrics from local NeDB (pre-computed by background job)
// Get Phoenix metrics from local NeDB (pre-computed by background job)
router.get('/api/:conn/monitoring/phoenix', async function (req, res) {
    try {
        const isLive = req.query.live === 'true';
        // Server-side filter params forwarded from the client search bar
        const searchText = (req.query.search || '').trim().toLowerCase();
        const filterStatus = (req.query.status || '').trim().toUpperCase();
        const filterKind = (req.query.kind || '').trim().toLowerCase();
        /** Apply search/status/kind filter to a flat rootSpans array */
        function filterSpans(spans) {
            return spans.filter((s) => {
                const kind = (s.kind ?? 'chain').toLowerCase();
                const status = (s.statusCode ?? 'OK').toUpperCase();
                const name = (s.name ?? '').toLowerCase();
                const input = (typeof s.input === 'string' ? s.input : JSON.stringify(s.input ?? '')).toLowerCase();
                const output = (typeof s.output === 'string' ? s.output : JSON.stringify(s.output ?? '')).toLowerCase();
                const db = (s.db ?? '').toLowerCase();
                if (filterStatus && status !== filterStatus)
                    return false;
                if (filterKind && kind !== filterKind)
                    return false;
                if (!searchText)
                    return true;
                // Key-value expression parser, e.g. "span_kind == 'llm'" or "latency > 500"
                const matchExpr = searchText.match(/^([a-z_.]+)\s*(==|!=|>=|<=|>|<|contains)\s*['"]?(.*?)['"]?$/i);
                if (matchExpr) {
                    const [, fieldRaw, op, val] = matchExpr;
                    const field = fieldRaw.replace(/_/g, '').replace(/\./g, '');
                    let target = '';
                    if (['spankind', 'kind'].includes(field))
                        target = kind;
                    else if (['statuscode', 'status'].includes(field))
                        target = status.toLowerCase();
                    else if (field === 'name')
                        target = name;
                    else if (field === 'input')
                        target = input;
                    else if (field === 'output')
                        target = output;
                    else if (['dbname', 'db'].includes(field))
                        target = db;
                    else if (['latency', 'durationms', 'latencyms'].includes(field)) {
                        const num = Number(s.durationMs ?? 0);
                        const valNum = Number(val);
                        if (op === '==')
                            return num === valNum;
                        if (op === '!=')
                            return num !== valNum;
                        if (op === '>')
                            return num > valNum;
                        if (op === '<')
                            return num < valNum;
                        if (op === '>=')
                            return num >= valNum;
                        if (op === '<=')
                            return num <= valNum;
                        return false;
                    }
                    else {
                        target = String(s[fieldRaw] ?? '').toLowerCase();
                    }
                    if (op === '==')
                        return target === val.toLowerCase();
                    if (op === '!=')
                        return target !== val.toLowerCase();
                    if (op === 'contains')
                        return target.includes(val.toLowerCase());
                    return false;
                }
                // Full-text fallback
                return name.includes(searchText) || kind.includes(searchText) ||
                    status.toLowerCase().includes(searchText) || input.includes(searchText) ||
                    output.includes(searchText) || db.includes(searchText);
            });
        }
        /** Build structured alerts from spans with durationMs above threshold */
        function buildAlertsFromSpans(spans, thresholdMs = 1000) {
            const slowSpans = spans
                .filter((s) => (s.durationMs ?? 0) >= thresholdMs)
                .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));
            if (slowSpans.length === 0) {
                return { source: 'live', status: 'OK', slowQueries: [] };
            }
            const slowQueries = slowSpans.map((s) => ({
                traceId: s.traceId ?? s.spanId ?? '',
                spanId: s.spanId ?? '',
                name: s.name ?? 'unknown',
                db: s.db ?? '',
                collection: s.collection ?? '',
                operation: s.kind ?? 'chain',
                durationMs: Math.round(s.durationMs ?? 0),
                statusCode: s.statusCode ?? 'OK',
                startTime: s.startTime ?? '',
            }));
            const maxMs = slowQueries[0].durationMs;
            return {
                source: 'live',
                status: 'WARNING',
                traceSummary: `${slowSpans.length} slow span(s) detected. Worst: ${slowQueries[0].name} (${maxMs}ms)`,
                slowQueries,
            };
        }
        if (isLive) {
            try {
                const { collectPhoenixSnapshot } = await import('../agent/tools/phoenix.tools.js');
                const snapshot = await collectPhoenixSnapshot();
                const d = new Date();
                const dateKey = `${d.getMonth() + 1}/${d.getDate()}`;
                const allSpans = snapshot.rootSpans ?? [];
                const alerts = buildAlertsFromSpans(allSpans);
                const spans = filterSpans(allSpans);
                return res.status(200).json({
                    success: true,
                    source: 'live',
                    alerts,
                    metrics: {
                        totalTraces: snapshot.totalSpans ?? 0,
                        latencyP50: `${Math.round((snapshot.p50 ?? 0) * 1000)}ms`,
                        latencyP99: `${((snapshot.p99 ?? 0)).toFixed(1)}s`,
                        tracesOverTime: [{ date: dateKey, ok: snapshot.ok ?? 0, error: snapshot.error ?? 0 }],
                        latencyPercentiles: [{ date: dateKey, p50: snapshot.p50 ?? 0, p90: snapshot.p90 ?? 0, p99: snapshot.p99 ?? 0 }],
                    },
                    spans,
                    total: spans.length,
                });
            }
            catch (liveErr) {
                console.error('[PhoenixMonitor] Live query failed, falling back to local NeDB storage:', liveErr.message);
            }
        }
        // Query the last 24h of stored phoenix snapshots from NeDB
        const dayBack = new Date();
        dayBack.setHours(dayBack.getHours() - 24);
        req.db.find({ type: 'phoenix', timestamp: { $gte: dayBack } })
            .sort({ timestamp: 1 })
            .exec(async function (err, snapshots) {
            // If no stored data yet, fall back to a one-time live fetch
            if (err || !snapshots || snapshots.length === 0) {
                try {
                    const { collectPhoenixSnapshot } = await import('../agent/tools/phoenix.tools.js');
                    const snapshot = await collectPhoenixSnapshot();
                    const d = new Date();
                    const dateKey = `${d.getMonth() + 1}/${d.getDate()}`;
                    const allSpans = snapshot.rootSpans ?? [];
                    const alerts = buildAlertsFromSpans(allSpans);
                    const spans = filterSpans(allSpans);
                    return res.status(200).json({
                        success: true,
                        source: 'live_fallback',
                        alerts,
                        metrics: {
                            totalTraces: snapshot.totalSpans ?? 0,
                            latencyP50: `${Math.round((snapshot.p50 ?? 0) * 1000)}ms`,
                            latencyP99: `${((snapshot.p99 ?? 0)).toFixed(1)}s`,
                            tracesOverTime: [{ date: dateKey, ok: snapshot.ok ?? 0, error: snapshot.error ?? 0 }],
                            latencyPercentiles: [{ date: dateKey, p50: snapshot.p50 ?? 0, p90: snapshot.p90 ?? 0, p99: snapshot.p99 ?? 0 }],
                        },
                        spans,
                        total: spans.length,
                    });
                }
                catch (liveErr) {
                    return res.status(500).json({ success: false, msg: 'Could not fetch Phoenix traces', error: liveErr.message });
                }
            }
            const byDate = {};
            for (const snap of snapshots) {
                const key = snap.date ?? new Date(snap.timestamp).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                if (!byDate[key])
                    byDate[key] = { ok: 0, error: 0, latencies: [], llmOk: 0, llmErr: 0, toolOk: 0, toolErr: 0, prompt: 0, completion: 0 };
                byDate[key].ok += snap.ok ?? 0;
                byDate[key].error += snap.error ?? 0;
                byDate[key].llmOk += snap.llmOk ?? 0;
                byDate[key].llmErr += snap.llmErr ?? 0;
                byDate[key].toolOk += snap.toolOk ?? 0;
                byDate[key].toolErr += snap.toolErr ?? 0;
                byDate[key].prompt += snap.promptTokens ?? 0;
                byDate[key].completion += snap.completionTokens ?? 0;
                // Collect sample latency values for percentile calc
                if (snap.p50)
                    byDate[key].latencies.push(snap.p50);
                if (snap.p90)
                    byDate[key].latencies.push(snap.p90);
                if (snap.p99)
                    byDate[key].latencies.push(snap.p99);
            }
            const percentile = (arr, p) => {
                if (arr.length === 0)
                    return 0;
                const sorted = [...arr].sort((a, b) => a - b);
                const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
                return parseFloat(sorted[idx].toFixed(3));
            };
            const tracesOverTime = Object.entries(byDate).map(([date, d]) => ({ date, ok: d.ok, error: d.error }));
            const latencyPercentiles = Object.entries(byDate).map(([date, d]) => ({
                date,
                p50: percentile(d.latencies, 50),
                p75: percentile(d.latencies, 75),
                p90: percentile(d.latencies, 90),
                p95: percentile(d.latencies, 95),
                p99: percentile(d.latencies, 99),
            }));
            const llmSpans = Object.entries(byDate).map(([date, d]) => ({ date, ok: d.llmOk, error: d.llmErr }));
            const toolSpans = Object.entries(byDate).map(([date, d]) => ({ date, ok: d.toolOk, error: d.toolErr }));
            const tokenUsage = Object.entries(byDate).map(([date, d]) => ({ date, prompt: d.prompt, completion: d.completion }));
            // Latest snapshot for summary stats and root spans
            const latest = snapshots[snapshots.length - 1];
            const totalTraces = snapshots.reduce((sum, s) => sum + (s.totalSpans ?? 0), 0);
            const allP50 = snapshots.map((s) => s.p50 ?? 0).filter(Boolean);
            const allP99 = snapshots.map((s) => s.p99 ?? 0).filter(Boolean);
            const avgP50 = allP50.length ? allP50.reduce((a, b) => a + b, 0) / allP50.length : 0;
            const avgP99 = allP99.length ? allP99.reduce((a, b) => a + b, 0) / allP99.length : 0;
            // Generate alerts from stored spans
            const { collectPhoenixSnapshot } = await import('../agent/tools/phoenix.tools.js');
            let latestLiveSpans = [];
            try {
                const freshSnap = await collectPhoenixSnapshot();
                latestLiveSpans = freshSnap.rootSpans ?? [];
            }
            catch {
                latestLiveSpans = latest?.rootSpans ?? [];
            }
            const alerts = buildAlertsFromSpans(latestLiveSpans);
            const rawStoredSpans = latestLiveSpans.length ? latestLiveSpans : (latest?.rootSpans ?? []);
            const spans = filterSpans(rawStoredSpans);
            res.status(200).json({
                success: true,
                source: 'stored',
                alerts,
                metrics: {
                    totalTraces,
                    latencyP50: `${Math.round(avgP50 * 1000)}ms`,
                    latencyP99: `${avgP99.toFixed(1)}s`,
                    tracesOverTime,
                    latencyPercentiles,
                    llmSpans,
                    toolSpans,
                    tokenUsage,
                },
                spans,
                total: spans.length,
            });
        });
    }
    catch (err) {
        console.error('[Monitoring] Phoenix health check failed:', err);
        res.status(500).json({ success: false, msg: 'Could not fetch Phoenix traces' });
    }
});
// Get detailed spans belonging to a trace
router.get('/api/:conn/monitoring/trace/:traceId', async function (req, res) {
    try {
        const { traceId } = req.params;
        const projectName = process.env.PHOENIX_PROJECT_NAME || 'vibe-mongo-admin';
        const { callPhoenixTool } = await import('../agent/tools/phoenix.tools.js');
        const trace = await callPhoenixTool('get-trace', {
            project_identifier: projectName,
            trace_id: traceId,
            include_annotations: true
        });
        if (!trace) {
            return res.status(404).json({ success: false, msg: 'Trace not found' });
        }
        return res.status(200).json({ success: true, trace });
    }
    catch (err) {
        console.error('[Monitoring] Get trace details failed:', err);
        return res.status(500).json({ success: false, msg: 'Could not fetch trace details', error: err.message });
    }
});
// Run AI Evaluation on a specific trace
router.post('/api/:conn/monitoring/trace/:traceId/evaluate', async function (req, res) {
    try {
        const { traceId } = req.params;
        const { runAgentEvaluation } = await import('../agent/tools/phoenix.tools.js');
        const evaluationResult = await runAgentEvaluation(traceId);
        if (!evaluationResult) {
            return res.status(500).json({ success: false, msg: 'Evaluation failed to return a result' });
        }
        return res.status(200).json({ success: true, data: evaluationResult });
    }
    catch (err) {
        console.error('[Monitoring] AI Evaluation failed:', err);
        return res.status(500).json({ success: false, msg: 'Could not run AI Evaluation', error: err.message });
    }
});
function averageDatapoints(datapoints, limit) {
    if (limit >= datapoints.length) {
        return datapoints;
    }
    if (datapoints.length === 0)
        return [];
    var min = new Date(datapoints[0].x).getTime();
    var max = new Date(datapoints[datapoints.length - 1].x).getTime();
    if (limit < 1) {
        return [{
                x: new Date((min + max) / 2),
                y: datapoints.reduce((a, b) => a.y + b.y, 0) / datapoints.length
            }];
    }
    var step = (max - min) / limit;
    var result = [];
    var l = min + step;
    var n = 0;
    var sumx = 0;
    var sumy = 0;
    for (var i = 0; i < datapoints.length; i++) {
        var dTime = new Date(datapoints[i].x).getTime();
        if (dTime > l) {
            if (n > 0) {
                result.push({
                    x: sumy ? new Date(sumx / sumy) : new Date(l - step / 2),
                    y: sumy / n
                });
            }
            while (dTime > l) {
                l += step;
            }
            n = 0;
            sumx = 0;
            sumy = 0;
        }
        n++;
        sumx += dTime * datapoints[i].y;
        sumy += datapoints[i].y;
    }
    if (n > 0) {
        result.push({
            x: sumy ? new Date(sumx / sumy) : new Date(l - step / 2),
            y: sumy / n
        });
    }
    return result;
}
exports.default = router;
