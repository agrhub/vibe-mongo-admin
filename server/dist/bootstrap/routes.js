"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupRoutes = setupRoutes;
const express_1 = __importDefault(require("express"));
const path_1 = __importDefault(require("path"));
const tracing_1 = require("../agent/tracing");
const apiRoute = require('../routes/api');
function setupRoutes(app, app_context) {
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
    const distPath = path_1.default.join(__dirname, '../../../client/dist');
    app.use(app_context + '/', express_1.default.static(distPath));
    // Fallback to client SPA for non-API route hits
    app.get('*', function (req, res, next) {
        if (req.path.startsWith('/api/')) {
            return next();
        }
        res.sendFile(path_1.default.join(distPath, 'index.html'));
    });
}
