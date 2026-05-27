import '../agent/tracing';
import async from "async";
import { setupConfig } from '../bootstrap/config';
import { setupDatabaseStats } from '../bootstrap/database';
import { connectionStore } from '../services/ConnectionStore';
import { mongoService } from '../services/MongoService';
var connPool = require('./connections');
var monitoring = require('./monitoring');

console.log('[CloudRunJob-Monitoring] Starting standalone monitoring run...');

// 1. Setup Config & Datastore
setupConfig();
const dbStats = setupDatabaseStats();

// Mock Express app reference for connPool registration
const mockApp = {
    locals: {
        db: {} as any
    }
};

// 2. Load all connection strings
connectionStore.listConnections().then((savedConnections) => {
    const connection_list: any = {};
    savedConnections.forEach(conn => {
        connection_list[conn.name] = {
            connection_string: conn.uri,
            connection_options: {}
        };
    });

    // 3. Connect to all databases
    async.forEachOf(connection_list, function (value: any, key: any, callback: any) {
        var common = require('../routes/common');
        try {
            common.parseMongoUri(value.connection_string);
            connPool.addConnection({ connName: key, connString: value.connection_string, connOptions: value.connection_options }, mockApp, function (err: any, data: any) {
                if (err) {
                    console.error(`Could not pre-connect to ${key}: ${err}`);
                }
                callback();
            });
        } catch (err) {
            callback();
        }
    }, async function (err: any) {
        if (err) console.error('[CloudRunJob-Monitoring] Connection warmup error:', err.message);

        try {
            console.log('[CloudRunJob-Monitoring] Connections warmed. Collecting metrics...');
            
            // 4. Run Server database status metrics collection
            monitoring.serverMonitoring(dbStats, mongoService.getConnections());
            
            // 5. Run Arize Phoenix telemetry span metrics collection
            await monitoring.phoenixMonitoring(dbStats);
            
            console.log('[CloudRunJob-Monitoring] Metrics collected successfully. Persisting to NeDB...');
            
            // Allow asynchronous database operations to write and flush to disk
            setTimeout(() => {
                console.log('[CloudRunJob-Monitoring] Done! Exiting cleanly.');
                process.exit(0);
            }, 3000);

        } catch (runErr: any) {
            console.error('[CloudRunJob-Monitoring] Execution failed:', runErr.message);
            process.exit(1);
        }
    });
}).catch(err => {
    console.error('[CloudRunJob-Monitoring] Failed to retrieve connection strings:', err);
    process.exit(1);
});
