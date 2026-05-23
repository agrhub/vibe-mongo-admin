"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const common = __importStar(require("./common"));
const ConnectionStore_1 = require("../services/ConnectionStore");
const router = (0, express_1.Router)();
// ================= CONNECTIONS CONFIGURATION =================
// Get active connection configurations
router.get('/api/connections', async function (req, res) {
    try {
        const savedConnections = await ConnectionStore_1.connectionStore.listConnections();
        const connection_list = {};
        savedConnections.forEach(conn => {
            connection_list[conn.name] = {
                connection_string: conn.uri,
                connection_options: {}
            };
        });
        res.status(200).json({
            connections: common.order_object(connection_list)
        });
    }
    catch (err) {
        res.status(500).json({ 'msg': err.message || err });
    }
});
// Add connection
router.post('/api/connections/add', async function (req, res) {
    const connPool = require('../utils/connections');
    var conn_name = req.body.name;
    var conn_string = req.body.string;
    var conn_options_str = req.body.options || '{}';
    if (!conn_name || !conn_string) {
        return res.status(400).json({ 'msg': 'Config error: Connection name and connection string are required' });
    }
    try {
        const existing = await ConnectionStore_1.connectionStore.getConnection(conn_name);
        if (existing) {
            return res.status(400).json({ 'msg': 'Config error: A connection by that name already exists' });
        }
        common.parseMongoUri(conn_string);
        var options = {};
        try {
            options = JSON.parse(conn_options_str);
        }
        catch (err) {
            return res.status(400).json({ 'msg': 'Error in connection options' + ': ' + err });
        }
        connPool.addConnection({ connName: conn_name, connString: conn_string, connOptions: options }, req.app, async function (err, data) {
            if (err) {
                console.error('DB Connect error: ' + err);
                res.status(400).json({ 'msg': 'Config error' + ': ' + err });
            }
            else {
                try {
                    await ConnectionStore_1.connectionStore.saveConnection(conn_name, conn_string);
                    const savedConnections = await ConnectionStore_1.connectionStore.listConnections();
                    const connection_list = {};
                    savedConnections.forEach(conn => {
                        connection_list[conn.name] = {
                            connection_string: conn.uri,
                            connection_options: {}
                        };
                    });
                    res.status(200).json({ 'msg': 'Config successfully added', 'connections': connection_list });
                }
                catch (dbErr) {
                    res.status(400).json({ 'msg': 'Config error' + ': ' + (dbErr.message || dbErr) });
                }
            }
        });
    }
    catch (err) {
        res.status(400).json({ 'msg': 'Config error' + ': ' + (err.message || err) });
    }
});
// Update connection
router.post('/api/connections/update', async function (req, res) {
    const connPool = require('../utils/connections');
    var curr_config = req.body.curr_config;
    var conn_name = req.body.conn_name;
    var conn_string = req.body.conn_string;
    if (!curr_config || !conn_name || !conn_string) {
        return res.status(400).json({ 'msg': 'Missing parameters' });
    }
    try {
        common.parseMongoUri(conn_string);
        var current_options = {};
        connPool.addConnection({ connName: conn_name, connString: conn_string, connOptions: current_options }, req.app, async function (err, data) {
            if (err) {
                console.error('DB Connect error: ' + err);
                res.status(400).json({ 'msg': 'Config error' + ': ' + err });
            }
            else {
                try {
                    const existingRecord = await ConnectionStore_1.connectionStore.getConnection(curr_config);
                    if (existingRecord && existingRecord.id) {
                        await ConnectionStore_1.connectionStore.deleteConnection(existingRecord.id);
                    }
                    if (curr_config !== conn_name) {
                        connPool.removeConnection(curr_config, req.app);
                    }
                    await ConnectionStore_1.connectionStore.saveConnection(conn_name, conn_string);
                    res.status(200).json({ 'msg': 'Config successfully updated', 'name': conn_name, 'string': conn_string });
                }
                catch (dbErr) {
                    res.status(400).json({ 'msg': 'Config error' + ': ' + (dbErr.message || dbErr) });
                }
            }
        });
    }
    catch (err) {
        res.status(400).json({ 'msg': 'Config error' + ': ' + (err.message || err) });
    }
});
// Delete connection
router.post('/api/connections/delete', async function (req, res) {
    const connPool = require('../utils/connections');
    var curr_config = req.body.curr_config;
    if (!curr_config) {
        return res.status(400).json({ 'msg': 'Missing connection name' });
    }
    try {
        const existingRecord = await ConnectionStore_1.connectionStore.getConnection(curr_config);
        if (existingRecord && existingRecord.id) {
            await ConnectionStore_1.connectionStore.deleteConnection(existingRecord.id);
        }
        connPool.removeConnection(curr_config, req.app);
        res.status(200).json({ 'msg': 'Config successfully deleted' });
    }
    catch (err) {
        res.status(400).json({ 'msg': 'Config error' + ': ' + (err.message || err) });
    }
});
// Sidebar tree list
router.get('/api/:conn/sidebar', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }
    var mongo_client = connection_list[req.params.conn].client;
    common.get_sidebar_list(mongo_client, null, function (err, sidebar_list) {
        if (err) {
            res.status(400).json({ 'msg': 'Error getting sidebar', 'err': err });
        }
        else {
            res.status(200).json({ sidebar_list: sidebar_list });
        }
    });
});
exports.default = router;
