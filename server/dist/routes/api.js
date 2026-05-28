"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// Session check middleware
router.all('/api/*', function (req, res, next) {
    var passwordConf = req.nconf.app.get('app');
    // Check if auth is configured
    if (passwordConf && passwordConf.hasOwnProperty('password')) {
        // Allow login/logout and status check without auth session
        if (req.path === '/api/auth/login' || req.path === '/api/auth/logout' || req.path === '/api/auth/status' || req.path === '/api/locales' || req.path === '/api/monitoring/trigger') {
            next();
        }
        else {
            if (req.session.loggedIn) {
                next();
            }
            else {
                res.status(401).json({ 'msg': 'Unauthorized. Please login.' });
            }
        }
    }
    else {
        next();
    }
});
// Import sub-routers
const auth_js_1 = __importDefault(require("./auth.js"));
const connections_js_1 = __importDefault(require("./connections.js"));
const databases_js_1 = __importDefault(require("./databases.js"));
const backups_js_1 = __importDefault(require("./backups.js"));
const collections_js_1 = __importDefault(require("./collections.js"));
const indexes_js_1 = __importDefault(require("./indexes.js"));
const users_js_1 = __importDefault(require("./users.js"));
const documents_js_1 = __importDefault(require("./documents.js"));
const monitoring_js_1 = __importDefault(require("./monitoring.js"));
const agent_js_1 = __importDefault(require("./agent.js"));
const webhooks_js_1 = __importDefault(require("./webhooks.js"));
const migrations_js_1 = __importDefault(require("./migrations.js"));
// Mount sub-routers
router.use(auth_js_1.default);
router.use(connections_js_1.default);
router.use(databases_js_1.default);
router.use(backups_js_1.default);
router.use(collections_js_1.default);
router.use(indexes_js_1.default);
router.use(users_js_1.default);
router.use(documents_js_1.default);
router.use(monitoring_js_1.default);
router.use(agent_js_1.default);
router.use(webhooks_js_1.default);
router.use(migrations_js_1.default);
module.exports = router;
