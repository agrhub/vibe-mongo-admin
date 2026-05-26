"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupMiddlewares = setupMiddlewares;
exports.setupErrorHandlers = setupErrorHandlers;
const express_1 = __importDefault(require("express"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const express_session_1 = __importDefault(require("express-session"));
function setupMiddlewares(app, nconfStores, app_context, db) {
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
        req.nconf = nconfStores;
        req.app_context = app_context;
        req.db = db;
        next();
    });
}
function setupErrorHandlers(app) {
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
}
