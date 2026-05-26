import express, { Express, Request, Response, NextFunction } from 'express';
import logger from "morgan";
import cookieParser from "cookie-parser";
import session from "express-session";

export function setupMiddlewares(app: Express, nconfStores: any, app_context: string, db: any) {
    app.use(logger('dev'));
    app.use(express.json({ limit: '1gb' }));
    app.use(express.urlencoded({ extended: false, limit: '1gb' }));
    app.use(cookieParser());

    // CORS configuration (highly useful for frontend hot reloading in development)
    app.use(function (req: Request, res: Response, next: NextFunction) {
        var origin = req.headers.origin;
        if (origin) {
            res.header("Access-Control-Allow-Origin", origin);
        } else {
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
    app.use(session({
        secret: '858SGTUyX8w1L6JNm1m93Cvm8uX1QX2D',
        resave: true,
        saveUninitialized: true
    }));

    // Make helper components accessible to routing context with dynamic localization
    app.use(function (req: any, res: Response, next: NextFunction) {
        req.nconf = nconfStores;
        req.app_context = app_context;
        req.db = db;
        next();
    });
}

export function setupErrorHandlers(app: Express) {
    // catch 404 and forward to error handler
    app.use(function (req: Request, res: Response, next: NextFunction) {
        var err: any = new Error('Not Found');
        err.status = 404;
        next(err);
    });

    // Error handlers
    app.use(function (err: any, req: Request, res: Response, next: NextFunction) {
        console.error(err.stack);
        res.status(err.status || 500).json({
            message: err.message,
            error: app.get('env') === 'development' ? err : {}
        });
    });
}
