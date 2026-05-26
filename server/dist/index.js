"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./agent/tracing");
const express_1 = __importDefault(require("express"));
const async_1 = __importDefault(require("async"));
const nconf_1 = __importDefault(require("nconf"));
const config_1 = require("./bootstrap/config");
const database_1 = require("./bootstrap/database");
const middlewares_1 = require("./bootstrap/middlewares");
const routes_1 = require("./bootstrap/routes");
const ConnectionStore_1 = require("./services/ConnectionStore");
const MongoService_1 = require("./services/MongoService");
var connPool = require('./utils/connections');
var monitoring = require('./utils/monitoring');
const app = (0, express_1.default)();
// 1. Setup Configuration
const { app_host, app_port, app_context } = (0, config_1.setupConfig)();
// 2. Setup Database Stats
const dbStats = (0, database_1.setupDatabaseStats)();
// 3. Setup Middlewares
(0, middlewares_1.setupMiddlewares)(app, nconf_1.default.stores, app_context, dbStats);
// 4. Setup Routes
(0, routes_1.setupRoutes)(app, app_context);
// 5. Setup Error Handlers
(0, middlewares_1.setupErrorHandlers)(app);
process.on('uncaughtException', function (err) {
    console.error('Uncaught Exception:', err.stack);
});
// 6. Warm connection pool on launch and start server
ConnectionStore_1.connectionStore.listConnections().then((savedConnections) => {
    const connection_list = {};
    savedConnections.forEach(conn => {
        connection_list[conn.name] = {
            connection_string: conn.uri,
            connection_options: {}
        };
    });
    async_1.default.forEachOf(connection_list, function (value, key, callback) {
        var common = require('./routes/common');
        try {
            common.parseMongoUri(value.connection_string);
            connPool.addConnection({ connName: key, connString: value.connection_string, connOptions: value.connection_options }, app, function (err, data) {
                if (err) {
                    console.error(`Could not pre-connect to ${key}: ${err}`);
                }
                callback();
            });
        }
        catch (err) {
            callback();
        }
    }, function (err) {
        if (err)
            console.error(err.message);
        app.listen(app_port, app_host, function () {
            console.log('VibeMongo Server listening on host: http://' + app_host + ':' + app_port + app_context);
            // Trigger monitoring polling
            monitoring.serverMonitoring(dbStats, MongoService_1.mongoService.getConnections());
            monitoring.phoenixMonitoring(dbStats);
            // Repeat monitor query ticker every 30 seconds
            setInterval(function () {
                monitoring.serverMonitoring(dbStats, MongoService_1.mongoService.getConnections());
                monitoring.phoenixMonitoring(dbStats);
            }, 30000);
        }).on('error', function (err) {
            if (err.code === 'EADDRINUSE') {
                console.error('Error starting VibeMongo: Port ' + app_port + ' already in use, choose another');
            }
            else {
                console.error('Error starting VibeMongo: ' + err);
            }
        });
    });
}).catch(err => {
    console.error('Failed to list connections on startup:', err);
});
