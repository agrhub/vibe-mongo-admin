import './agent/tracing';
import express from "express";
import async from "async";
import nconf from "nconf";

import { setupConfig } from './bootstrap/config';
import { setupDatabaseStats } from './bootstrap/database';
import { setupMiddlewares, setupErrorHandlers } from './bootstrap/middlewares';
import { setupRoutes } from './bootstrap/routes';

import { connectionStore } from './services/ConnectionStore';
import { mongoService } from './services/MongoService';
var connPool = require('./utils/connections');
var monitoring = require('./utils/monitoring');

const app = express();

// 1. Setup Configuration
const { app_host, app_port, app_context } = setupConfig();

// 2. Setup Database Stats
const dbStats = setupDatabaseStats();

// 3. Setup Middlewares
setupMiddlewares(app, nconf.stores, app_context, dbStats);

// 4. Setup Routes
setupRoutes(app, app_context);

// 5. Setup Error Handlers
setupErrorHandlers(app);

process.on('uncaughtException', function (err) {
    console.error('Uncaught Exception:', err.stack);
});

// 6. Warm connection pool on launch and start server
connectionStore.listConnections().then((savedConnections) => {
    const connection_list: any = {};
    savedConnections.forEach(conn => {
        connection_list[conn.name] = {
            connection_string: conn.uri,
            connection_options: {}
        };
    });

    async.forEachOf(connection_list, function (value: any, key: any, callback: any) {
        var common = require('./routes/common');

        try {
            common.parseMongoUri(value.connection_string);
            connPool.addConnection({ connName: key, connString: value.connection_string, connOptions: value.connection_options }, app, function (err: any, data: any) {
                if (err) {
                    console.error(`Could not pre-connect to ${key}: ${err}`);
                }
                callback();
            });
        } catch (err) {
            callback();
        }
    }, function (err: any) {
        if (err) console.error(err.message);

        app.listen(app_port, app_host, function () {
            console.log('VibeMongo Server listening on host: http://' + app_host + ':' + app_port + app_context);

            // Trigger monitoring polling
            monitoring.serverMonitoring(dbStats, mongoService.getConnections());
            monitoring.phoenixMonitoring(dbStats);

            // Repeat monitor query ticker every 30 seconds
            setInterval(function () {
                monitoring.serverMonitoring(dbStats, mongoService.getConnections());
                monitoring.phoenixMonitoring(dbStats);
            }, 30000);
        }).on('error', function (err: any) {
            if (err.code === 'EADDRINUSE') {
                console.error('Error starting VibeMongo: Port ' + app_port + ' already in use, choose another');
            } else {
                console.error('Error starting VibeMongo: ' + err);
            }
        });
    });
}).catch(err => {
    console.error('Failed to list connections on startup:', err);
});
