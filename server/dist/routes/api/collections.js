"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
// ================= COLLECTIONS =================
// Create collection
router.post('/api/:conn/:db/collection/create', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }
    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }
    var collection_name = req.body.collection_name;
    if (!collection_name) {
        return res.status(400).json({ 'msg': 'Missing collection name' });
    }
    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    mongo_db.createCollection(collection_name)
        .then(function (coll) {
        res.status(200).json({ 'msg': 'Collection successfully created' });
    })
        .catch(function (err) {
        console.error('Error creating collection: ' + err);
        res.status(400).json({ 'msg': 'Error creating collection' + ': ' + err });
    });
});
// Rename collection
router.post('/api/:conn/:db/:coll/rename', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }
    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }
    var new_collection_name = req.body.new_collection_name;
    if (!new_collection_name) {
        return res.status(400).json({ 'msg': 'Missing new collection name' });
    }
    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    mongo_db.collection(req.params.coll).rename(new_collection_name, { 'dropTarget': false })
        .then(function (coll_name) {
        res.status(200).json({ 'msg': 'Collection successfully renamed' });
    })
        .catch(function (err) {
        console.error('Error renaming collection: ' + err);
        res.status(400).json({ 'msg': 'Error renaming collection' + ': ' + err });
    });
});
// Delete collection
router.post('/api/:conn/:db/collection/delete', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }
    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }
    var collection_name = req.body.collection_name;
    if (!collection_name) {
        return res.status(400).json({ 'msg': 'Missing collection name' });
    }
    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    mongo_db.dropCollection(collection_name)
        .then(function (coll) {
        res.status(200).json({ 'msg': 'Collection successfully deleted', 'coll_name': collection_name });
    })
        .catch(function (err) {
        console.error('Error deleting collection: ' + err);
        res.status(400).json({ 'msg': 'Error deleting collection' + ': ' + err });
    });
});
// Export collection
router.get('/api/:conn/:db/:coll/export', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }
    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }
    var excludedID = req.query.excludedID === 'true';
    var exportID = {};
    if (excludedID) {
        exportID = { '_id': 0 };
    }
    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    mongo_db.collection(req.params.coll).find({}, exportID).toArray()
        .then(function (data) {
        if (data !== '') {
            res.set({ 'Content-Disposition': 'attachment; filename=' + req.params.coll + '.json', 'Content-Type': 'application/json' });
            res.send(JSON.stringify(data, null, 2));
        }
        else {
            res.status(400).json({ 'msg': 'Export error: Collection not found' });
        }
    })
        .catch(function (err) {
        res.status(400).json({ 'msg': 'Export error', 'err': err });
    });
});
exports.default = router;
