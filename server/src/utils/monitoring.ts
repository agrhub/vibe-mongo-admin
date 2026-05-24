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
        const snapshot = await collectPhoenixSnapshot();

        // Persist to local NeDB as a phoenix-typed record
        monitoringDB.insert({ type: 'phoenix', ...snapshot }, function (err: any) {
            if (err) console.error('[PhoenixMonitor] Failed to persist snapshot:', err);
        });

        // Cleanup old records (keep only last 24 hours)
        const cutoff = new Date();
        cutoff.setHours(cutoff.getHours() - 24);
        monitoringDB.remove({ type: 'phoenix', timestamp: { $lt: cutoff } }, { multi: true }, function () {});
    } catch (err: any) {
        console.error('[PhoenixMonitor] Background job error:', err.message);
    }
};

