import { mongoService } from '../services/MongoService';
import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import * as common from './common.js';
import { databaseService } from '../services/DatabaseService';
import { erdMapperService } from '../services/ErdMapperService';

const router = Router();

// ================= CONNECTION STATUS & DATABASES =================

// Database status & backup list
router.get('/api/:conn/stats', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    const conn_string = connection_list[req.params.conn].connString;
    const uri = common.parseMongoUri(conn_string);

    if (uri.database) {
        return res.status(200).json({ redirectDb: uri.database });
    }

    const mongo_client = connection_list[req.params.conn].client;
    const mongo_native = connection_list[req.params.conn].native;

    try {
        const stats = await databaseService.getDatabaseStats(mongo_client, mongo_native, uri);
        res.status(200).json(stats);
    } catch (err: any) {
        res.status(500).json({ msg: 'Error getting stats', err: err.message });
    }
});

// List of databases
router.get('/api/:conn/databases', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    const conn_string = connection_list[req.params.conn].connString;
    const uri = common.parseMongoUri(conn_string);
    const mongo_client = connection_list[req.params.conn].client;

    try {
        const db_list = await databaseService.getDatabasesList(mongo_client, uri);
        res.status(200).json({ db_list: db_list });
    } catch (err: any) {
        res.status(400).json({ 'msg': 'Error listing databases', 'err': err });
    }
});

// Database level stats, collections and users
router.get('/api/:conn/:db/stats', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    const mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    try {
        const details = await databaseService.getDatabaseDetails(mongo_db, req.params.db);
        res.status(200).json(details);
    } catch (err: any) {
        res.status(500).json({ msg: 'Error getting database details', err: err.message });
    }
});

// Create new database
router.post('/api/:conn/db/create', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    const db_name = req.body.db_name;
    if (!db_name || db_name.indexOf(' ') >= 0 || db_name.indexOf('.') >= 0) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    const mongo_client = connection_list[req.params.conn].client;

    try {
        const result = await databaseService.createDatabase(mongo_client, db_name);
        res.status(200).json(result);
    } catch (err: any) {
        console.error('Error creating database: ' + err);
        res.status(400).json({ 'msg': 'Error creating database: ' + err });
    }
});

// Delete database
router.post('/api/:conn/db/delete', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    const db_name = req.body.db_name;
    if (!db_name) {
        return res.status(400).json({ 'msg': 'Missing database name' });
    }

    const mongo_client = connection_list[req.params.conn].client;

    try {
        const result = await databaseService.deleteDatabase(mongo_client, db_name);
        res.status(200).json(result);
    } catch (err: any) {
        console.error('Error deleting database: ' + err);
        res.status(400).json({ 'msg': 'Error deleting database: ' + err });
    }
});

// Rename database
router.post('/api/:conn/db/rename', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    const old_db_name = req.body.old_db_name;
    const new_db_name = req.body.new_db_name;

    if (!old_db_name || !new_db_name) {
        return res.status(400).json({ 'msg': 'Missing old or new database name' });
    }

    if (new_db_name.indexOf(' ') >= 0 || new_db_name.indexOf('.') >= 0) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    const mongo_client = connection_list[req.params.conn].client;

    try {
        const result = await databaseService.renameDatabase(mongo_client, old_db_name, new_db_name);
        res.status(200).json(result);
    } catch (err: any) {
        console.error('Error renaming database: ' + err);
        res.status(400).json({ 'msg': 'Error renaming database: ' + err.message });
    }
});

// =============== AI-POWERED ANALYSIS ===============

router.post('/api/:conn/:db/ai-analysis', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    const mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    const customPrompt = req.body.customPrompt || '';

    try {
        const analysis = await databaseService.performAiAnalysis(mongo_db, req.params.db, customPrompt);
        res.status(200).json(analysis);
    } catch (e: any) {
        console.error('AI Database Analysis Error:', e);
        res.status(500).json({ msg: e.message || 'Internal error' });
    }
});

// Database-wide ERD Relation Mapping Endpoint
router.get('/api/:conn/:db/erd', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    const mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    try {
        const erdData = await erdMapperService.mapDatabaseErd(mongo_db, req.params.db);
        res.status(200).json(erdData);
    } catch (err: any) {
        console.error('[Database ERD Mapping] Error:', err);
        res.status(500).json({ msg: 'Error generating Database ERD: ' + (err.message || 'Unknown error') });
    }
});

export default router;
