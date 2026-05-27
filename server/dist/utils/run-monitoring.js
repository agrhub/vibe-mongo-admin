"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("../agent/tracing");
const async_1 = __importDefault(require("async"));
const config_1 = require("../bootstrap/config");
const database_1 = require("../bootstrap/database");
const ConnectionStore_1 = require("../services/ConnectionStore");
const MongoService_1 = require("../services/MongoService");
var connPool = require('./connections');
var monitoring = require('./monitoring');
console.log('[CloudRunJob-Monitoring] Starting standalone monitoring run...');
// 1. Setup Config & Datastore
(0, config_1.setupConfig)();
const dbStats = (0, database_1.setupDatabaseStats)();
// Mock Express app reference for connPool registration
const mockApp = {
    locals: {
        db: {}
    }
};
// 2. Load all connection strings
ConnectionStore_1.connectionStore.listConnections().then((savedConnections) => {
    const connection_list = {};
    savedConnections.forEach(conn => {
        connection_list[conn.name] = {
            connection_string: conn.uri,
            connection_options: {}
        };
    });
    // 3. Connect to all databases
    async_1.default.forEachOf(connection_list, function (value, key, callback) {
        var common = require('../routes/common');
        try {
            common.parseMongoUri(value.connection_string);
            connPool.addConnection({ connName: key, connString: value.connection_string, connOptions: value.connection_options }, mockApp, function (err, data) {
                if (err) {
                    console.error(`Could not pre-connect to ${key}: ${err}`);
                }
                callback();
            });
        }
        catch (err) {
            callback();
        }
    }, async function (err) {
        if (err)
            console.error('[CloudRunJob-Monitoring] Connection warmup error:', err.message);
        try {
            console.log('[CloudRunJob-Monitoring] Connections warmed. Collecting metrics...');
            // 4. Run Server database status metrics collection
            monitoring.serverMonitoring(dbStats, MongoService_1.mongoService.getConnections());
            // 5. Run Arize Phoenix telemetry span metrics collection
            await monitoring.phoenixMonitoring(dbStats);
            console.log('[CloudRunJob-Monitoring] Metrics collected successfully. Persisting to NeDB...');
            // Allow asynchronous database operations to write and flush to disk
            setTimeout(() => {
                console.log('[CloudRunJob-Monitoring] Done! Exiting cleanly.');
                process.exit(0);
            }, 3000);
        }
        catch (runErr) {
            console.error('[CloudRunJob-Monitoring] Execution failed:', runErr.message);
            process.exit(1);
        }
    });
}).catch(err => {
    console.error('[CloudRunJob-Monitoring] Failed to retrieve connection strings:', err);
    process.exit(1);
});
