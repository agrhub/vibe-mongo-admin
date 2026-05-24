import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import _ from 'lodash';

const router = Router();

// ================= METRICS MONITORING =================

// Get monitoring charts data
router.get('/api/:conn/monitoring', function (req: Request, res: Response) {
    var dayBack = new Date();
    dayBack.setDate(dayBack.getDate() - 1);

    req.db.find({ connectionName: req.params.conn, eventDate: { $gte: dayBack } }).sort({ eventDate: 1 }).exec(function (err: any, serverEvents: any) {
        if (err || !serverEvents || serverEvents.length === 0) {
            return res.status(200).json({ dataRetrieved: false, data: {} });
        }

        var connectionsCurrent: any[] = [];
        var connectionsAvailable: any[] = [];
        var connectionsTotalCreated: any[] = [];

        var clientsTotal: any[] = [];
        var clientsReaders: any[] = [];
        var clientsWriters: any[] = [];

        var memoryVirtual: any[] = [];
        var memoryMapped: any[] = [];
        var memoryCurrent: any[] = [];

        var docsQueried: any[] = [];
        var docsInserted: any[] = [];
        var docsDeleted: any[] = [];
        var docsUpdated: any[] = [];

        if (serverEvents.length > 0) {
            if (serverEvents[0].dataRetrieved === true) {
                _.each(serverEvents, function (value: any, key: any) {
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

            var uptime: any = (serverEvents[0].uptime / 60).toFixed(2);
            if (uptime > 61) {
                uptime = (uptime / 60).toFixed(2) + ' hours';
            } else {
                uptime = uptime + ' minutes';
            }

            if (err) {
                res.status(400).json({ 'msg': 'Could not get server monitoring' });
            } else {
                res.status(200).json({ data: returnedData, dataRetrieved: serverEvents[0].dataRetrieved, pid: serverEvents[0].pid, version: serverEvents[0].version, uptime: uptime });
            }
        }
    });
});

// Get Phoenix metrics from local NeDB (pre-computed by background job)
router.get('/api/:conn/monitoring/phoenix', async function (req: Request, res: Response) {
    try {
        // Query the last 24h of stored phoenix snapshots from NeDB
        const dayBack = new Date();
        dayBack.setHours(dayBack.getHours() - 24);

        req.db.find({ type: 'phoenix', timestamp: { $gte: dayBack } })
            .sort({ timestamp: 1 })
            .exec(async function (err: any, snapshots: any[]) {
                // If no stored data yet, fall back to a one-time live fetch
                if (err || !snapshots || snapshots.length === 0) {
                    try {
                        const { getSlowQueryTraces, collectPhoenixSnapshot } = await import('../agent/tools/phoenix.tools.js');
                        const [slowData, snapshot] = await Promise.all([
                            getSlowQueryTraces(500),
                            collectPhoenixSnapshot()
                        ]);
                        const d = new Date();
                        const dateKey = `${d.getMonth() + 1}/${d.getDate()}`;
                        return res.status(200).json({
                            success: true,
                            source: 'live_fallback',
                            alerts: slowData,
                            metrics: {
                                totalTraces: snapshot.totalSpans ?? 0,
                                latencyP50: `${Math.round((snapshot.p50 ?? 0) * 1000)}ms`,
                                latencyP99: `${((snapshot.p99 ?? 0)).toFixed(1)}s`,
                                tracesOverTime: [{ date: dateKey, ok: snapshot.ok ?? 0, error: snapshot.error ?? 0 }],
                                latencyPercentiles: [{ date: dateKey, p50: snapshot.p50 ?? 0, p90: snapshot.p90 ?? 0, p99: snapshot.p99 ?? 0 }],
                            },
                            spans: snapshot.rootSpans ?? [],
                        });
                    } catch (liveErr: any) {
                        return res.status(500).json({ success: false, msg: 'Could not fetch Phoenix traces', error: liveErr.message });
                    }
                }

                // --- Aggregate stored snapshots into chart data ---

                // Group by date label for tracesOverTime and latencyPercentiles
                type DateBucket = { ok: number; error: number; latencies: number[]; llmOk: number; llmErr: number; toolOk: number; toolErr: number; prompt: number; completion: number };
                const byDate: Record<string, DateBucket> = {};

                for (const snap of snapshots) {
                    const key = snap.date ?? new Date(snap.timestamp).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' });
                    if (!byDate[key]) byDate[key] = { ok: 0, error: 0, latencies: [], llmOk: 0, llmErr: 0, toolOk: 0, toolErr: 0, prompt: 0, completion: 0 };
                    byDate[key].ok    += snap.ok    ?? 0;
                    byDate[key].error += snap.error ?? 0;
                    byDate[key].llmOk  += snap.llmOk  ?? 0;
                    byDate[key].llmErr += snap.llmErr  ?? 0;
                    byDate[key].toolOk  += snap.toolOk  ?? 0;
                    byDate[key].toolErr += snap.toolErr ?? 0;
                    byDate[key].prompt     += snap.promptTokens     ?? 0;
                    byDate[key].completion += snap.completionTokens ?? 0;
                    // Collect sample latency values for percentile calc
                    if (snap.p50) byDate[key].latencies.push(snap.p50);
                    if (snap.p90) byDate[key].latencies.push(snap.p90);
                    if (snap.p99) byDate[key].latencies.push(snap.p99);
                }

                const percentile = (arr: number[], p: number) => {
                    if (arr.length === 0) return 0;
                    const sorted = [...arr].sort((a, b) => a - b);
                    const idx = Math.max(0, Math.ceil((p / 100) * sorted.length) - 1);
                    return parseFloat(sorted[idx].toFixed(3));
                };

                const tracesOverTime   = Object.entries(byDate).map(([date, d]) => ({ date, ok: d.ok, error: d.error }));
                const latencyPercentiles = Object.entries(byDate).map(([date, d]) => ({
                    date,
                    p50: percentile(d.latencies, 50),
                    p75: percentile(d.latencies, 75),
                    p90: percentile(d.latencies, 90),
                    p95: percentile(d.latencies, 95),
                    p99: percentile(d.latencies, 99),
                }));
                const llmSpans  = Object.entries(byDate).map(([date, d]) => ({ date, ok: d.llmOk,  error: d.llmErr }));
                const toolSpans = Object.entries(byDate).map(([date, d]) => ({ date, ok: d.toolOk, error: d.toolErr }));
                const tokenUsage = Object.entries(byDate).map(([date, d]) => ({ date, prompt: d.prompt, completion: d.completion }));

                // Latest snapshot for summary stats and root spans
                const latest = snapshots[snapshots.length - 1];
                const totalTraces = snapshots.reduce((sum, s) => sum + (s.totalSpans ?? 0), 0);
                const allP50 = snapshots.map((s: any) => s.p50 ?? 0).filter(Boolean);
                const allP99 = snapshots.map((s: any) => s.p99 ?? 0).filter(Boolean);
                const avgP50 = allP50.length ? allP50.reduce((a, b) => a + b, 0) / allP50.length : 0;
                const avgP99 = allP99.length ? allP99.reduce((a, b) => a + b, 0) / allP99.length : 0;

                // Get slow queries from latest snapshot spans or fallback
                const { getSlowQueryTraces } = await import('../agent/tools/phoenix.tools.js');
                const slowData = await getSlowQueryTraces(500);

                res.status(200).json({
                    success: true,
                    source: 'stored',
                    alerts: slowData,
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
                    spans: latest?.rootSpans ?? [],
                });
            });
    } catch (err: any) {
        console.error('[Monitoring] Phoenix health check failed:', err);
        res.status(500).json({ success: false, msg: 'Could not fetch Phoenix traces' });
    }
});


function averageDatapoints(datapoints: any, limit: number) {
    if (limit >= datapoints.length) {
        return datapoints;
    }

    if (datapoints.length === 0) return [];

    var min = new Date(datapoints[0].x).getTime();
    var max = new Date(datapoints[datapoints.length - 1].x).getTime();

    if (limit < 1) {
        return [{
            x: new Date((min + max) / 2),
            y: datapoints.reduce((a: any, b: any) => a.y + b.y, 0) / datapoints.length
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

export default router;
