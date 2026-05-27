var _ = require('lodash');

// Removes old monitoring data. We only want basic monitoring with the last 24 hours of events.
function serverMonitoringCleanup(db: any, conn: any) {
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

    db.find({ connectionName: conn }).skip(retainedRecords).sort({ eventDate: -1 }).exec(function (err: any, serverEvents: any) {
        if (err || !serverEvents) return;
        var idArray: any = [];
        _.each(serverEvents, function (value: any, key: any) {
            idArray.push(value._id);
        });

        db.remove({ '_id': { '$in': idArray } }, { multi: true }, function (err: any, newDoc: any) { });
    });

    // Also clean up old Phoenix records (retain 24h)
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 24);
    db.remove({ type: 'phoenix', timestamp: { $lt: cutoff } }, { multi: true }, function () {});
};


// runs a regular job against the connections and inserts into a local DB
var currDocCounts = {
    queried: 0,
    inserted: 0,
    deleted: 0,
    updated: 0
};

exports.serverMonitoring = function (monitoringDB: any, dbs: any) {
    if (dbs) {
        Object.keys(dbs).forEach(function (key) {
            try {
                var adminDb = dbs[key].native.admin();
                adminDb.serverStatus()
                    .then(function (info: any) {
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

                        monitoringDB.insert(doc, function (err: any, newDoc: any) { });
                        serverMonitoringCleanup(monitoringDB, key);
                    })
                    .catch(function (err: any) {
                        console.error('Error in monitoring serverStatus for ' + key + ':', err.message || err);
                    });
            } catch (e: any) {
                console.error('Error initializing monitoring for ' + key + ':', e.message || e);
            }
        });
    }
};

function getDocCounts(currCounts: any, newCounts: any) {
    var newDocCounts = {
        queried: 0,
        inserted: 0,
        deleted: 0,
        updated: 0
    };

    if (!newCounts) return newDocCounts;

    // queried
    if (currCounts.queried === 0) {
        currCounts.queried = newCounts.returned || 0;
    } else {
        newDocCounts.queried = (newCounts.returned || 0) - currCounts.queried;
        currCounts.queried = newCounts.returned || 0;
    }

    // inserts
    if (currCounts.inserted === 0) {
        currCounts.inserted = newCounts.inserted || 0;
    } else {
        newDocCounts.inserted = (newCounts.inserted || 0) - currCounts.inserted;
        currCounts.inserted = newCounts.inserted || 0;
    }

    // deleted
    if (currCounts.deleted === 0) {
        currCounts.deleted = newCounts.deleted || 0;
    } else {
        newDocCounts.deleted = (newCounts.deleted || 0) - currCounts.deleted;
        currCounts.deleted = newCounts.deleted || 0;
    }

    // updated
    if (currCounts.updated === 0) {
        currCounts.updated = newCounts.updated || 0;
    } else {
        newDocCounts.updated = (newCounts.updated || 0) - currCounts.updated;
        currCounts.updated = newCounts.updated || 0;
    }

    return newDocCounts;
}

/**
 * Background job: collect a Phoenix snapshot and persist it to local NeDB.
 * Should be called every ~30 seconds from the server startup setInterval.
 */
exports.phoenixMonitoring = async function (monitoringDB: any) {
    try {
        // Lazy-import to avoid circular deps at startup
        const { collectPhoenixSnapshot } = await import('../agent/tools/phoenix.tools.js');
        // Fetch up to 500 spans for high statistical accuracy
        const snapshot = await collectPhoenixSnapshot(500);

        if (snapshot) {
            const allSpans = snapshot.rootSpans ?? [];

            // 1. Build alerts from slow spans (>= 1000ms)
            const slowSpans = allSpans
                .filter((s: any) => (s.durationMs ?? 0) >= 1000)
                .sort((a: any, b: any) => (b.durationMs ?? 0) - (a.durationMs ?? 0));

            const slowQueries = slowSpans.map((s: any) => ({
                traceId:    s.traceId ?? s.spanId ?? '',
                spanId:     s.spanId ?? '',
                name:       s.name ?? 'unknown',
                db:         s.db ?? '',
                collection: s.collection ?? '',
                operation:  s.kind ?? 'chain',
                durationMs: Math.round(s.durationMs ?? 0),
                statusCode: s.statusCode ?? 'OK',
                startTime:  s.startTime ?? '',
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
            const hourlySeries: { [hour: string]: { ok: number, error: number, latencies: number[] } } = {};
            const now = Date.now();
            
            // Initialize 24 hourly buckets
            for (let i = 0; i < 24; i++) {
                const hDate = new Date(now - i * 3600 * 1000);
                const key = `${hDate.getHours()}:00`;
                hourlySeries[key] = { ok: 0, error: 0, latencies: [] };
            }

            allSpans.forEach((s: any) => {
                const sDate = new Date(s.startTime);
                if (!isNaN(sDate.getTime())) {
                    const key = `${sDate.getHours()}:00`;
                    if (hourlySeries[key]) {
                        if (s.statusCode === 'ERROR') {
                            hourlySeries[key].error++;
                        } else {
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

            const percentile = (arr: number[], p: number) => {
                if (arr.length === 0) return 0;
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
            const lightweightSpans = allSpans.map((s: any) => ({
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
                monitoringDB.insert(dashboardData, function (err: any) {
                    if (err) console.error('[PhoenixMonitor] Failed to persist pre-computed dashboard data:', err);
                });
            });
        }

        // Cleanup older phoenix metrics (keep last 24h)
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - 24);
        monitoringDB.remove({ type: 'phoenix', timestamp: { $lt: cutoff } }, { multi: true }, function () {});
    } catch (err: any) {
        console.error('[PhoenixMonitor] Background job error:', err.message);
    }
};

