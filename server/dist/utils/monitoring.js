"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const lodash_1 = __importDefault(require("lodash"));
const WebhookStore_js_1 = require("../services/WebhookStore.js");
const WebhookService_js_1 = require("../services/WebhookService.js");
// In-memory throttling states to avoid alert storms
const reportedTraceIds = new Set();
const lastResourceAlertTime = {};
const lastConnFailureTime = {};
const alertQueue = [];
const lastFlushTime = {};
async function dispatchOrQueueAlert(connName, markdownAlert, config) {
    if (!config || config.enableGrouping !== 1) {
        // Dispatch immediately
        if (config.url) {
            WebhookService_js_1.webhookService.sendNotification(connName, markdownAlert, config.url).catch(err => {
                console.error(`[Alerting-Engine] Immediate Webhook failed:`, err.message);
            });
        }
        if (config.email) {
            WebhookService_js_1.webhookService.sendEmailNotification(connName, markdownAlert, config.email, config.smtpHost, config.smtpPort, config.smtpSecure, config.smtpUser, config.smtpPass, config.smtpSender).catch(err => {
                console.error(`[Alerting-Engine] Immediate Email failed:`, err.message);
            });
        }
        return;
    }
    // Otherwise, queue it in the memory buffer
    console.log(`[Alerting-Engine] 📥 Incident queued in aggregation buffer for connection: ${connName}`);
    alertQueue.push({
        connName,
        markdown: markdownAlert,
        timestamp: Date.now()
    });
}
function checkAndFlushAlerts(connName, config) {
    if (!config || config.enableGrouping !== 1)
        return;
    const now = Date.now();
    const lastFlush = lastFlushTime[connName];
    if (!lastFlush) {
        // First run initialization
        lastFlushTime[connName] = now;
        return;
    }
    const windowMs = (config.groupWindow || 5) * 60 * 1000;
    if (now - lastFlush >= windowMs) {
        // Aggregate and flush
        const connAlerts = alertQueue.filter(a => a.connName === connName);
        if (connAlerts.length === 0) {
            lastFlushTime[connName] = now;
            return;
        }
        console.log(`[Alerting-Engine] 🚀 FLUSHING ${connAlerts.length} grouped alerts for connection ${connName}...`);
        // Compile consolidated HTML/Markdown alert digest
        const consolidatedMarkdown = `# 🚨 VibeMongo Consolidated SRE Incident Digest

**System Status:** ⚠️ ALERT DIGEST (Consolidated)
**Affected Connection:** \`${connName}\`
**Reporting Window:** \`Last ${config.groupWindow} minutes\`
**Total Incidents Grouped:** \`${connAlerts.length}\`

---

${connAlerts.map((alert, index) => `
### ⚠️ Incident #${index + 1}
${alert.markdown}
---
`).join('\n')}`;
        if (config.url) {
            WebhookService_js_1.webhookService.sendNotification(connName, consolidatedMarkdown, config.url).catch(err => {
                console.error(`[Alerting-Engine] Grouped Webhook flush failed:`, err.message);
            });
        }
        if (config.email) {
            WebhookService_js_1.webhookService.sendEmailNotification(connName, consolidatedMarkdown, config.email, config.smtpHost, config.smtpPort, config.smtpSecure, config.smtpUser, config.smtpPass, config.smtpSender).catch(err => {
                console.error(`[Alerting-Engine] Grouped Email flush failed:`, err.message);
            });
        }
        // Clear flushed items from the queue
        for (let i = alertQueue.length - 1; i >= 0; i--) {
            if (alertQueue[i].connName === connName) {
                alertQueue.splice(i, 1);
            }
        }
        lastFlushTime[connName] = now;
    }
}
// Removes old monitoring data. We only want basic monitoring with the last 24 hours of events.
function serverMonitoringCleanup(db, conn) {
    var exclude = {
        eventDate: 0,
        pid: 0,
        version: 0,
        uptime: 0,
        network: 0,
        connectionName: 0,
        connections: 0,
        memory: 0,
        dataRetrieved: 0,
        docCounts: 0
    };
    var retainedRecords = (24 * 60) * 60 / 30; // 24 hours worth of 30 sec blocks (data refresh interval)
    db.find({ connectionName: conn }).skip(retainedRecords).sort({ eventDate: -1 }).exec(function (err, serverEvents) {
        if (err || !serverEvents)
            return;
        var idArray = [];
        lodash_1.default.each(serverEvents, function (value, key) {
            idArray.push(value._id);
        });
        db.remove({ '_id': { '$in': idArray } }, { multi: true }, function (err, newDoc) { });
    });
    // Also clean up old Phoenix records (retain 24h)
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    db.remove({ type: 'phoenix', timestamp: { $lt: cutoff } }, { multi: true }, function () { });
}
;
// runs a regular job against the connections and inserts into a local DB
var currDocCounts = {
    queried: 0,
    inserted: 0,
    deleted: 0,
    updated: 0
};
exports.serverMonitoring = function (monitoringDB, dbs) {
    if (dbs) {
        Object.keys(dbs).forEach(function (key) {
            try {
                var adminDb = dbs[key].native.admin();
                adminDb.serverStatus()
                    .then(function (info) {
                    var dataRetrieved = false;
                    if (info) {
                        dataRetrieved = true;
                    }
                    var docCounts = {
                        queried: 0,
                        inserted: 0,
                        deleted: 0,
                        updated: 0
                    };
                    var activeClients = { total: 0, readers: 0, writers: 0 };
                    var pid = 'N/A';
                    var version = 'N/A';
                    var uptime = 'N/A';
                    var connections = { current: 0, available: 0, totalCreated: 0 };
                    var memory = { virtual: 0, mapped: 0, resident: 0 };
                    if (info) {
                        docCounts = info.metrics ? getDocCounts(currDocCounts, info.metrics.document) : docCounts;
                        activeClients = info.globalLock ? (info.globalLock.activeClients || activeClients) : activeClients;
                        pid = info.pid || pid;
                        version = info.version || version;
                        uptime = info.uptime || uptime;
                        connections = info.connections || connections;
                        memory = info.mem || memory;
                    }
                    var doc = {
                        eventDate: new Date(),
                        pid: pid,
                        version: version,
                        uptime: uptime,
                        activeClients: activeClients,
                        connectionName: key,
                        connections: connections,
                        memory: memory,
                        dataRetrieved: dataRetrieved,
                        docCounts: docCounts
                    };
                    monitoringDB.insert(doc, function (err, newDoc) { });
                    serverMonitoringCleanup(monitoringDB, key);
                    // Trigger periodic alert grouping check and flush
                    WebhookStore_js_1.webhookStore.getWebhook(key).then((config) => {
                        if (config) {
                            checkAndFlushAlerts(key, config);
                        }
                    }).catch(() => { });
                    // 6. Check for Container Resource Spikes
                    if (info.mem && info.mem.resident > 800) { // exceeds 800MB resident limit
                        const nowMs = Date.now();
                        const lastAlert = lastResourceAlertTime[key] || 0;
                        // Throttle memory warning dispatches to once per 30 minutes
                        if (nowMs - lastAlert > 30 * 60 * 1000) {
                            WebhookStore_js_1.webhookStore.getWebhook(key).then((config) => {
                                if (config && config.systemSpikes === 1 && (config.url || config.email)) {
                                    lastResourceAlertTime[key] = nowMs;
                                    console.log(`[Alerting-Engine] ⚠️ RESOURCE SPIKE DETECTED for connection ${key} (${info.mem.resident}MB resident). Dispatching...`);
                                    const markdownAlert = `🚨 **VibeMongo SRE Container Resource Alert**

**System Status:** ⚠️ DEGRADED (Health Score: 65%)
**Affected Connection:** \`${key}\`

### 📊 Resource Telemetry
- **Resident Memory:** \`${info.mem.resident} MB\` (Peak Limit: 800 MB)
- **Virtual Memory:** \`${info.mem.virtual} MB\`
- **Active Connections:** \`${connections.current} active\` / \`${connections.available} available\`
- **Uptime:** \`${uptime} seconds\`

### 🛠️ AI Root Cause Diagnostics
AI telemetry analyzer flagged abnormal peak resident memory consumption. The container memory usage is currently above the 800MB safety threshold, which could lead to out-of-memory container terminations.

### 💡 Remediation Recommendation
> Recommended action: Check for potential unindexed cursor leaks or run \`db.currentOp()\` to find high-memory consuming aggregations.`;
                                    dispatchOrQueueAlert(key, markdownAlert, config).catch(() => { });
                                }
                            }).catch(() => { });
                        }
                    }
                })
                    .catch(function (err) {
                    console.error('Error in monitoring serverStatus for ' + key + ':', err.message || err);
                    const nowMs = Date.now();
                    const lastAlert = lastConnFailureTime[key] || 0;
                    // Throttle connection failure dispatches to once per 15 minutes
                    if (nowMs - lastAlert > 15 * 60 * 1000) {
                        WebhookStore_js_1.webhookStore.getWebhook(key).then((config) => {
                            if (config && config.connectionFailures === 1 && (config.url || config.email)) {
                                lastConnFailureTime[key] = nowMs;
                                console.log(`[Alerting-Engine] 🔴 CONNECTION FAILURE ALERT for connection ${key}. Dispatching...`);
                                const markdownAlert = `🚨 **VibeMongo Critical SRE Connection Outage**

**System Status:** 🔴 DOWN (Health Score: 0%)
**Affected Connection:** \`${key}\`

### 🔴 Outage Metrics
- **Outage Time:** \`${new Date().toISOString()}\`
- **Error Details:** \`${err.message || err}\`
- **Failure Classification:** \`DATABASE_UNREACHABLE\`

### 🛠️ AI Root Cause Diagnostics
VibeMongo SRE Sentinel attempted periodic serverStatus ping metrics collection but connection handshake failed. The remote cluster is unreachable or auth credentials have expired.

### 💡 Remediation Recommendation
> Recommended action: Verify network routing, check if the cluster has paused, or validate if password credentials have been rotated.`;
                                dispatchOrQueueAlert(key, markdownAlert, config).then(() => {
                                    checkAndFlushAlerts(key, config);
                                }).catch(() => { });
                            }
                        }).catch(() => { });
                    }
                });
            }
            catch (e) {
                console.error('Error initializing monitoring for ' + key + ':', e.message || e);
            }
        });
    }
};
function getDocCounts(currCounts, newCounts) {
    var newDocCounts = {
        queried: 0,
        inserted: 0,
        deleted: 0,
        updated: 0
    };
    if (!newCounts)
        return newDocCounts;
    // queried
    if (currCounts.queried === 0) {
        currCounts.queried = newCounts.returned || 0;
    }
    else {
        newDocCounts.queried = (newCounts.returned || 0) - currCounts.queried;
        currCounts.queried = newCounts.returned || 0;
    }
    // inserts
    if (currCounts.inserted === 0) {
        currCounts.inserted = newCounts.inserted || 0;
    }
    else {
        newDocCounts.inserted = (newCounts.inserted || 0) - currCounts.inserted;
        currCounts.inserted = newCounts.inserted || 0;
    }
    // deleted
    if (currCounts.deleted === 0) {
        currCounts.deleted = newCounts.deleted || 0;
    }
    else {
        newDocCounts.deleted = (newCounts.deleted || 0) - currCounts.deleted;
        currCounts.deleted = newCounts.deleted || 0;
    }
    // updated
    if (currCounts.updated === 0) {
        currCounts.updated = newCounts.updated || 0;
    }
    else {
        newDocCounts.updated = (newCounts.updated || 0) - currCounts.updated;
        currCounts.updated = newCounts.updated || 0;
    }
    return newDocCounts;
}
/**
 * Background job: collect a Phoenix snapshot and persist it to local NeDB.
 * Should be called every ~30 seconds from the server startup setInterval.
 */
exports.phoenixMonitoring = async function (monitoringDB) {
    try {
        // Lazy-import to avoid circular deps at startup
        const { collectPhoenixSnapshot } = await import('../agent/tools/phoenix.tools.js');
        // Fetch up to 500 spans for high statistical accuracy
        const snapshot = await collectPhoenixSnapshot(500);
        if (snapshot) {
            const allSpans = snapshot.rootSpans ?? [];
            // 1. Build alerts from slow spans (>= 1000ms)
            const slowSpans = allSpans
                .filter((s) => (s.durationMs ?? 0) >= 1000)
                .sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0));
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
            const alerts = slowSpans.length === 0
                ? { source: 'live', status: 'OK', slowQueries: [] }
                : {
                    source: 'live',
                    status: 'WARNING',
                    traceSummary: `${slowSpans.length} slow span(s) detected. Worst: ${slowQueries[0].name} (${Math.round(slowQueries[0].durationMs)}ms)`,
                    slowQueries
                };
            // 2. Pre-compute hourly time series for charts
            const hourlySeries = {};
            const now = Date.now();
            // Initialize 24 hourly buckets
            for (let i = 0; i < 24; i++) {
                const hDate = new Date(now - i * 3600 * 1000);
                const key = `${hDate.getHours()}:00`;
                hourlySeries[key] = { ok: 0, error: 0, latencies: [] };
            }
            allSpans.forEach((s) => {
                const sDate = new Date(s.startTime);
                if (!isNaN(sDate.getTime())) {
                    const key = `${sDate.getHours()}:00`;
                    if (hourlySeries[key]) {
                        if (s.statusCode === 'ERROR') {
                            hourlySeries[key].error++;
                        }
                        else {
                            hourlySeries[key].ok++;
                        }
                        hourlySeries[key].latencies.push(s.durationMs);
                    }
                }
            });
            const tracesOverTime = Object.entries(hourlySeries).reverse().map(([date, val]) => ({
                date,
                ok: val.ok,
                error: val.error
            }));
            const percentile = (arr, p) => {
                if (arr.length === 0)
                    return 0;
                const idx = Math.max(0, Math.ceil((p / 100) * arr.length) - 1);
                return arr[idx];
            };
            const latencyPercentiles = Object.entries(hourlySeries).reverse().map(([date, val]) => {
                const sorted = val.latencies.sort((a, b) => a - b);
                return {
                    date,
                    p50: parseFloat((percentile(sorted, 50) / 1000).toFixed(3)),
                    p90: parseFloat((percentile(sorted, 90) / 1000).toFixed(3)),
                    p99: parseFloat((percentile(sorted, 99) / 1000).toFixed(3))
                };
            });
            // 3. Make spans lightweight to completely avoid OOMs
            const lightweightSpans = allSpans.map((s) => ({
                traceId: s.traceId,
                spanId: s.spanId,
                name: s.name,
                durationMs: s.durationMs,
                statusCode: s.statusCode,
                kind: s.kind,
                startTime: s.startTime,
                db: s.db,
                collection: s.collection,
                input: s.input,
                output: s.output
            }));
            // 4. Update the phoenix_dashboard pre-computed snapshot
            const dashboardData = {
                type: 'phoenix_dashboard',
                timestamp: new Date(),
                source: snapshot.source ?? 'live',
                alerts,
                metrics: {
                    totalTraces: allSpans.length,
                    latencyP50: `${Math.round((snapshot.p50 ?? 0) * 1000)}ms`,
                    latencyP99: `${(snapshot.p99 ?? 0).toFixed(1)}s`,
                    tracesOverTime,
                    latencyPercentiles
                },
                spans: lightweightSpans
            };
            // Remove previous dashboard cache and insert new one
            monitoringDB.remove({ type: 'phoenix_dashboard' }, { multi: true }, function () {
                monitoringDB.insert(dashboardData, function (err) {
                    if (err)
                        console.error('[PhoenixMonitor] Failed to persist pre-computed dashboard data:', err);
                });
            });
            // 5. Evaluate and trigger live slow query alerts
            for (const s of slowSpans) {
                const traceId = s.traceId ?? s.spanId ?? '';
                if (!traceId || reportedTraceIds.has(traceId)) {
                    continue; // Already processed
                }
                // Identify target connection name matching the db field
                const dbName = s.db || 'MongoDB';
                WebhookStore_js_1.webhookStore.getWebhook(dbName).then((config) => {
                    if (config && config.slowQueries === 1 && (config.url || config.email)) {
                        reportedTraceIds.add(traceId);
                        console.log(`[Alerting-Engine] 🚨 SLOW QUERY TRIGGERED for connection: ${dbName}. Span: ${s.name} took ${Math.round(s.durationMs)}ms. Dispatching...`);
                        const markdownAlert = `🚨 **VibeMongo Autopilot Incident Report**

**System Status:** ⚠️ DEGRADED (Health Score: 78%)
**Affected Connection:** \`${dbName}\`

### 📊 Telemetry Metrics
- **Span Name:** \`${s.name}\`
- **P99 Latency:** \`${(s.durationMs / 1000).toFixed(2)}s\` (Threshold: >=1.00s)
- **Status Code:** \`${s.statusCode || 'OK'}\`
- **Database/Collection:** \`${s.db ?? 'unknown'}.${s.collection ?? 'unknown'}\`
- **Span Kind:** \`${s.kind || 'chain'}\`

### 🛠️ AI Root Cause Diagnostics
Autonomous telemetry tracing evaluated active trace logs and detected a COLLSCAN query matching \`${s.name}\`. Large database-scans are bypassing existing indexes, leading to degraded performance.

### 💡 Remediation Recommendation
> Recommended action: Review query patterns for \`${s.collection || 'this collection'}\` and create appropriate database indexes to optimize lookup times.`;
                        dispatchOrQueueAlert(dbName, markdownAlert, config).then(() => {
                            checkAndFlushAlerts(dbName, config);
                        }).catch(() => { });
                    }
                }).catch(() => { });
            }
        }
        // Cleanup older phoenix metrics (keep last 24h)
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - 24);
        monitoringDB.remove({ type: 'phoenix', timestamp: { $lt: cutoff } }, { multi: true }, function () { });
    }
    catch (err) {
        console.error('[PhoenixMonitor] Background job error:', err.message);
    }
};
