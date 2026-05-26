import express, { Express, Request, Response, NextFunction } from 'express';
import path from "path";
import { traceMongoApiMiddleware } from '../agent/tracing';

const apiRoute = require('../routes/api');

export function setupRoutes(app: Express, app_context: string) {
    // Trace all /api/ requests as OpenInference RETRIEVAL spans in Arize Phoenix
    app.use('/api', traceMongoApiMiddleware);

    // Mount JSON API routes
    if (app_context !== '') {
        app.use(app_context, apiRoute);
    } else {
        app.use('/', apiRoute);
    }

    // Serve client production static files from client/dist
    const distPath = path.join(__dirname, '../../../client/dist');
    app.use(app_context + '/', express.static(distPath));

    // Fallback to client SPA for non-API route hits
    app.get('*', function (req: Request, res: Response, next: NextFunction) {
        if (req.path.startsWith('/api/')) {
            return next();
        }
        res.sendFile(path.join(distPath, 'index.html'));
    });
}
