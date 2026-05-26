import { mongoService } from '../services/MongoService';
import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import * as common from './common';
import { connectionStore } from '@/services/ConnectionStore';

const router = Router();

// ================= CONNECTIONS CONFIGURATION =================

// Get active connection configurations
router.get('/api/connections', async function (req: Request, res: Response) {
    try {
        const savedConnections = await connectionStore.listConnections();
        const connection_list: any = {};
        savedConnections.forEach(conn => {
            connection_list[conn.name] = {
                connection_string: conn.uri,
                connection_options: {}
            };
        });
        res.status(200).json({
            connections: common.order_object(connection_list)
        });
    } catch (err: any) {
        res.status(500).json({ 'msg': err.message || err });
    }
});

// Add connection
router.post('/api/connections/add', async function (req: Request, res: Response) {
    const connPool = require('@/utils/connections');

    var conn_name = req.body.name;
    var conn_string = req.body.string;
    var conn_options_str = req.body.options || '{}';

    if (!conn_name || !conn_string) {
        return res.status(400).json({ 'msg': 'Config error: Connection name and connection string are required' });
    }

    try {
        const existing = await connectionStore.getConnection(conn_name);
        if (existing) {
            return res.status(400).json({ 'msg': 'Config error: A connection by that name already exists' });
        }

        common.parseMongoUri(conn_string);
        var options = {};
        try {
            options = JSON.parse(conn_options_str);
        } catch (err) {
            return res.status(400).json({ 'msg': 'Error in connection options' + ': ' + err });
        }

        connPool.addConnection({ connName: conn_name, connString: conn_string, connOptions: options }, req.app, async function (err: any, data: any) {
            if (err) {
                console.error('DB Connect error: ' + err);
                res.status(400).json({ 'msg': 'Config error' + ': ' + err });
            } else {
                try {
                    await connectionStore.saveConnection(conn_name, conn_string);
                    const savedConnections = await connectionStore.listConnections();
                    const connection_list: any = {};
                    savedConnections.forEach(conn => {
                        connection_list[conn.name] = {
                            connection_string: conn.uri,
                            connection_options: {}
                        };
                    });
                    res.status(200).json({ 'msg': 'Config successfully added', 'connections': connection_list });
                } catch (dbErr: any) {
                    res.status(400).json({ 'msg': 'Config error' + ': ' + (dbErr.message || dbErr) });
                }
            }
        });
    } catch (err: any) {
        res.status(400).json({ 'msg': 'Config error' + ': ' + (err.message || err) });
    }
});

// Update connection
router.post('/api/connections/update', async function (req: Request, res: Response) {
    const connPool = require('@/utils/connections');

    var curr_config = req.body.curr_config;
    var conn_name = req.body.conn_name;
    var conn_string = req.body.conn_string;

    if (!curr_config || !conn_name || !conn_string) {
        return res.status(400).json({ 'msg': 'Missing parameters' });
    }

    try {
        common.parseMongoUri(conn_string);

        var current_options = {};

        connPool.addConnection({ connName: conn_name, connString: conn_string, connOptions: current_options }, req.app, async function (err: any, data: any) {
            if (err) {
                console.error('DB Connect error: ' + err);
                res.status(400).json({ 'msg': 'Config error' + ': ' + err });
            } else {
                try {
                    const existingRecord = await connectionStore.getConnection(curr_config);
                    if (existingRecord && existingRecord.id) {
                        await connectionStore.deleteConnection(existingRecord.id);
                    }

                    if (curr_config !== conn_name) {
                        connPool.removeConnection(curr_config, req.app);
                    }

                    await connectionStore.saveConnection(conn_name, conn_string);
                    res.status(200).json({ 'msg': 'Config successfully updated', 'name': conn_name, 'string': conn_string });
                } catch (dbErr: any) {
                    res.status(400).json({ 'msg': 'Config error' + ': ' + (dbErr.message || dbErr) });
                }
            }
        });
    } catch (err: any) {
        res.status(400).json({ 'msg': 'Config error' + ': ' + (err.message || err) });
    }
});

// Delete connection
router.post('/api/connections/delete', async function (req: Request, res: Response) {
    const connPool = require('@/utils/connections');
    var curr_config = req.body.curr_config;

    if (!curr_config) {
        return res.status(400).json({ 'msg': 'Missing connection name' });
    }

    try {
        const existingRecord = await connectionStore.getConnection(curr_config);
        if (existingRecord && existingRecord.id) {
            await connectionStore.deleteConnection(existingRecord.id);
        }

        connPool.removeConnection(curr_config, req.app);
        res.status(200).json({ 'msg': 'Config successfully deleted' });
    } catch (err: any) {
        res.status(400).json({ 'msg': 'Config error' + ': ' + (err.message || err) });
    }
});

// Sidebar tree list
router.get('/api/:conn/sidebar', function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    var mongo_client = connection_list[req.params.conn].client;
    common.get_sidebar_list(mongo_client, null, function (err: any, sidebar_list: any) {
        if (err) {
            res.status(400).json({ 'msg': 'Error getting sidebar', 'err': err });
        } else {
            res.status(200).json({ sidebar_list: sidebar_list });
        }
    });
});

export default router;
