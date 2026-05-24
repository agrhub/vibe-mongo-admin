"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("./agent/tracing");
const tracing_1 = require("./agent/tracing");
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const nconf_1 = __importDefault(require("nconf"));
const express_session_1 = __importDefault(require("express-session"));
const async_1 = __importDefault(require("async"));
const fs_1 = __importDefault(require("fs"));
const ConnectionStore_1 = require("./services/ConnectionStore");
var apiRoute = require('./routes/api');
// var dir_base = __dirname;
var app = (0, express_1.default)();
// Removed locales loading
// Setup DB for server stats using modern @seald-io/nedb fork
var Datastore = require('@seald-io/nedb');
const isProd = process.env.NODE_ENV === 'production';
var dir_data = path_1.default.join(__dirname, '../data/');
var dbStatsPath = path_1.default.join(dir_data, isProd ? 'dbStats.db?nolock=1' : 'dbStats.db');
// Check existence of data dir
if (!fs_1.default.existsSync(dir_data))
    fs_1.default.mkdirSync(dir_data);
var db = new Datastore({ filename: dbStatsPath, autoload: true });
// Check existence of backups dir, create if nothing
var dir_backups = path_1.default.join(__dirname, '../backups/');
if (!fs_1.default.existsSync(dir_backups))
    fs_1.default.mkdirSync(dir_backups);
// setup nconf files
nconf_1.default.add('app', {
    type: 'literal', store: {
        app: {
            "port": Number(process.env.PORT) || 4000,
            "host": process.env.HOST || "localhost",
            "context": process.env.CONTEXT || "",
            "password": process.env.PASSWORD || "admin"
        }
    }
});
// set app defaults
var app_host = process.env.HOST || 'localhost';
var app_port = Number(process.env.PORT) || 1234;
if (nconf_1.default.stores.app.get('app:host') !== undefined) {
    app_host = nconf_1.default.stores.app.get('app:host');
}
if (nconf_1.default.stores.app.get('app:port') !== undefined) {
    app_port = Number(nconf_1.default.stores.app.get('app:port')) || 1234;
}
app.locals.app_host = app_host;
app.locals.app_port = app_port;
var app_context = '';
if (nconf_1.default.stores.app.get('app:context') !== undefined && nconf_1.default.stores.app.get('app:context') !== '') {
    app_context = '/' + nconf_1.default.stores.app.get('app:context');
}
app.use((0, morgan_1.default)('dev'));
app.use(express_1.default.json({ limit: '1gb' }));
app.use(express_1.default.urlencoded({ extended: false, limit: '1gb' }));
app.use((0, cookie_parser_1.default)());
// CORS configuration (highly useful for frontend hot reloading in development)
app.use(function (req, res, next) {
    var origin = req.headers.origin;
    if (origin) {
        res.header("Access-Control-Allow-Origin", origin);
    }
    else {
        res.header("Access-Control-Allow-Origin", "*");
    }
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});
// setup session
app.use((0, express_session_1.default)({
    secret: '858SGTUyX8w1L6JNm1m93Cvm8uX1QX2D',
    resave: true,
    saveUninitialized: true
}));
// Make helper components accessible to routing context with dynamic localization
app.use(function (req, res, next) {
    req.nconf = nconf_1.default.stores;
    // req.i18n removed, moving translation logic to client
    req.app_context = app_context;
    req.db = db;
    next();
});
// Trace all /api/ requests as OpenInference RETRIEVAL spans in Arize Phoenix
app.use('/api', tracing_1.traceMongoApiMiddleware);
// Mount JSON API routes
if (app_context !== '') {
    app.use(app_context, apiRoute);
}
else {
    app.use('/', apiRoute);
}
// Serve client production static files from client/dist
var distPath = path_1.default.join(__dirname, '../../client/dist');
app.use(app_context + '/', express_1.default.static(distPath));
// Fallback to client SPA for non-API route hits
app.get('*', function (req, res, next) {
    if (req.path.startsWith('/api/')) {
        return next();
    }
    res.sendFile(path_1.default.join(distPath, 'index.html'));
});
// catch 404 and forward to error handler
app.use(function (req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});
// Error handlers
app.use(function (err, req, res, next) {
    console.error(err.stack);
    res.status(err.status || 500).json({
        message: err.message,
        error: app.get('env') === 'development' ? err : {}
    });
});
process.on('uncaughtException', function (err) {
    console.error('Uncaught Exception:', err.stack);
});
// Warm connection pool on launch
var connPool = require('./utils/connections');
var monitoring = require('./utils/monitoring');
app.locals.dbConnections = {};
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
            monitoring.serverMonitoring(db, app.locals.dbConnections);
            monitoring.phoenixMonitoring(db);
            // Repeat monitor query ticker every 30 seconds
            setInterval(function () {
                monitoring.serverMonitoring(db, app.locals.dbConnections);
                monitoring.phoenixMonitoring(db);
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
