import { mongoService } from '../services/MongoService';
import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import { collectionService } from '../services/CollectionService';

const router = Router();

// ================= COLLECTIONS =================

// Create collection
router.post('/api/:conn/:db/collection/create', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    const collection_name = req.body.collection_name;
    if (!collection_name) {
        return res.status(400).json({ 'msg': 'Missing collection name' });
    }

    const mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    try {
        const result = await collectionService.createCollection(mongo_db, collection_name);
        res.status(200).json(result);
    } catch (err: any) {
        console.error('Error creating collection: ' + err);
        res.status(400).json({ 'msg': 'Error creating collection: ' + err });
    }
});

// Rename collection
router.post('/api/:conn/:db/:coll/rename', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    const new_collection_name = req.body.new_collection_name;
    if (!new_collection_name) {
        return res.status(400).json({ 'msg': 'Missing new collection name' });
    }

    const mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    try {
        const result = await collectionService.renameCollection(mongo_db, req.params.coll, new_collection_name);
        res.status(200).json(result);
    } catch (err: any) {
        console.error('Error renaming collection: ' + err);
        res.status(400).json({ 'msg': 'Error renaming collection: ' + err });
    }
});

// Delete collection
router.post('/api/:conn/:db/collection/delete', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    const collection_name = req.body.collection_name;
    if (!collection_name) {
        return res.status(400).json({ 'msg': 'Missing collection name' });
    }

    const mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    try {
        const result = await collectionService.deleteCollection(mongo_db, collection_name);
        res.status(200).json(result);
    } catch (err: any) {
        console.error('Error deleting collection: ' + err);
        res.status(400).json({ 'msg': 'Error deleting collection: ' + err });
    }
});

// Export collection
router.get('/api/:conn/:db/:coll/export', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    const excludedID = req.query.excludedID === 'true';
    const mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    try {
        const data = await collectionService.exportCollection(mongo_db, req.params.coll, excludedID);
        res.set({ 'Content-Disposition': 'attachment; filename=' + req.params.coll + '.json', 'Content-Type': 'application/json' });
        res.send(JSON.stringify(data, null, 2));
    } catch (err: any) {
        res.status(400).json({ 'msg': 'Export error', 'err': err.message });
    }
});

// New schema endpoint
router.get('/api/:conn/:db/:coll/schema', async function (req, res) {
  const connection_list = mongoService.getConnections();
  if (!connection_list || !connection_list[req.params.conn]) {
    return res.status(400).json({ msg: 'Invalid connection' });
  }
  const mongo_db = connection_list[req.params.conn].client.db(req.params.db);
  
  try {
    const fields = await collectionService.getSchema(mongo_db, req.params.coll);
    res.status(200).json({ fields });
  } catch (err: any) {
    console.error('Schema error:', err);
    res.status(500).json({ msg: 'Error retrieving schema' });
  }
});

// New analysis endpoint
router.get('/api/:conn/:db/:coll/analysis', async function (req, res) {
  const connection_list = mongoService.getConnections();
  if (!connection_list || !connection_list[req.params.conn]) {
    return res.status(400).json({ msg: 'Invalid connection' });
  }
  const mongo_db = connection_list[req.params.conn].client.db(req.params.db);
  
  try {
    const analysis = await collectionService.getAnalysis(mongo_db, req.params.coll);
    res.status(200).json({ analysis });
  } catch (err: any) {
    console.error('Analysis error:', err);
    res.status(500).json({ msg: 'Error retrieving analysis' });
  }
});

// =============== AI-POWERED ANALYSIS ===============

router.post('/api/:conn/:db/:coll/ai-analysis', async function (req: Request, res: Response) {
  const connection_list = mongoService.getConnections();
  if (!connection_list || !connection_list[req.params.conn]) {
    return res.status(400).json({ msg: 'Invalid connection' });
  }

  const mongo_db = connection_list[req.params.conn].client.db(req.params.db);
  const collName = req.params.coll;
  const customPrompt = req.body.customPrompt || '';

  try {
    const analysis = await collectionService.performAiAnalysis(mongo_db, req.params.db, collName, customPrompt);
    res.status(200).json(analysis);
  } catch (err: any) {
    console.error('[AI Analysis] Error:', err);
    res.status(500).json({ msg: 'Error performing AI analysis: ' + (err.message || 'Unknown error') });
  }
});

export default router;
