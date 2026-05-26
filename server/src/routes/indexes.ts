import { mongoService } from '../services/MongoService';
import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;

const router = Router();

// ================= INDEXES =================

// Get indexes
router.get('/api/:conn/:db/:coll/indexes', function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    mongo_db.collection(req.params.coll).indexes()
        .then(function (coll_indexes: any) {
            res.status(200).json({ coll_indexes: coll_indexes });
        })
        .catch(function (err: any) {
            res.status(400).json({ 'msg': 'Error getting indexes', 'err': err });
        });
});

// Create index
router.post('/api/:conn/:db/:coll/index/create', function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var keys_str = req.body.keys;
    var unique_bool = req.body.unique === true || req.body.unique === 'true';
    var sparse_bool = req.body.sparse === true || req.body.sparse === 'true';

    if (!keys_str) {
        return res.status(400).json({ 'msg': 'Index keys are required' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    var options = { unique: unique_bool, background: true, sparse: sparse_bool };

    var keys_obj = {};
    try {
        keys_obj = JSON.parse(keys_str);
    } catch (e) {
        return res.status(400).json({ 'msg': 'Invalid JSON syntax for keys' });
    }

    mongo_db.collection(req.params.coll).createIndex(keys_obj, options)
        .then(function (index: any) {
            res.status(200).json({ 'msg': 'Index successfully created' });
        })
        .catch(function (err: any) {
            console.error('Error creating index: ' + err);
            res.status(400).json({ 'msg': 'Error creating Index' + ': ' + err });
        });
});

// Drop index
router.post('/api/:conn/:db/:coll/index/drop', function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var index_name = req.body.index_name;
    if (!index_name) {
        return res.status(400).json({ 'msg': 'Missing index name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    mongo_db.collection(req.params.coll).dropIndex(index_name)
        .then(function (index: any) {
            res.status(200).json({ 'msg': 'Index successfully dropped' });
        })
        .catch(function (err: any) {
            console.error('Error dropping Index: ' + err);
            res.status(400).json({ 'msg': 'Error dropping Index' + ': ' + err });
        });
});

export default router;
