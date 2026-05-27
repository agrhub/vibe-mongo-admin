import { Router, Request as ExpressRequest, Response, NextFunction } from 'express';
type Request = ExpressRequest<any>;
const router = Router();

// Session check middleware
router.all('/api/*', function (req: Request, res: Response, next: NextFunction) {
    var passwordConf = req.nconf.app.get('app');

    // Check if auth is configured
    if (passwordConf && passwordConf.hasOwnProperty('password')) {
        // Allow login/logout and status check without auth session
        if (req.path === '/api/auth/login' || req.path === '/api/auth/logout' || req.path === '/api/auth/status' || req.path === '/api/locales' || req.path === '/api/monitoring/trigger') {
            next();
        } else {
            if (req.session.loggedIn) {
                next();
            } else {
                res.status(401).json({ 'msg': 'Unauthorized. Please login.' });
            }
        }
    } else {
        next();
    }
});

// Import sub-routers
import authRouter from './auth.js';
import connectionsRouter from './connections.js';
import databasesRouter from './databases.js';
import backupsRouter from './backups.js';
import collectionsRouter from './collections.js';
import indexesRouter from './indexes.js';
import usersRouter from './users.js';
import documentsRouter from './documents.js';
import monitoringRouter from './monitoring.js';
import agentRouter from './agent.js';

// Mount sub-routers
router.use(authRouter);
router.use(connectionsRouter);
router.use(databasesRouter);
router.use(backupsRouter);
router.use(collectionsRouter);
router.use(indexesRouter);
router.use(usersRouter);
router.use(documentsRouter);
router.use(monitoringRouter);
router.use(agentRouter);

module.exports = router;
