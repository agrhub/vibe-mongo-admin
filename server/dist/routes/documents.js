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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const lodash_1 = __importDefault(require("lodash"));
const common = __importStar(require("./common.js"));
const bsonify = __importStar(require("./bsonify.js"));
const mongodb_1 = require("mongodb");
const ejson = mongodb_1.BSON.EJSON;
const router = (0, express_1.Router)();
// ================= DOCUMENTS CRUD =================
// Paginated documents search
router.post('/api/:conn/:db/:coll/documents', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
    var docs_per_page = parseInt(req.body.docsPerPage) || 5;
    var page = parseInt(req.body.page) || 1;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }
    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }
    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    var skip = 0;
    if (page > 1) {
        skip = (page - 1) * docs_per_page;
    }
    var query_obj = {};
    var validQuery = true;
    var queryMessage = '';
    if (req.body.query) {
        try {
            query_obj = bsonify.parse(req.body.query);
        }
        catch (e) {
            validQuery = false;
            queryMessage = e.toString();
            query_obj = {};
        }
    }
    if (req.body.columnFilters && typeof req.body.columnFilters === 'object') {
        const filterConditions = [];
        Object.entries(req.body.columnFilters).forEach(([key, val]) => {
            if (val && typeof val === 'string' && val.trim()) {
                // If filtering by _id, match exactly if it looks like ObjectId, otherwise match as string regex
                if (key === '_id') {
                    if (mongodb_1.BSON.ObjectId.isValid(val.trim())) {
                        filterConditions.push({ _id: new mongodb_1.BSON.ObjectId(val.trim()) });
                    }
                    else {
                        filterConditions.push({ _id: { $regex: val.trim(), $options: 'i' } });
                    }
                }
                else {
                    filterConditions.push({ [key]: { $regex: val.trim(), $options: 'i' } });
                }
            }
        });
        if (filterConditions.length > 0) {
            if (Object.keys(query_obj).length > 0) {
                query_obj = { $and: [query_obj, ...filterConditions] };
            }
            else {
                query_obj = filterConditions.length === 1 ? filterConditions[0] : { $and: filterConditions };
            }
        }
    }
    var sort_obj = {};
    if (req.body.sort && typeof req.body.sort === 'object') {
        sort_obj = req.body.sort;
    }
    if (!validQuery) {
        return res.status(200).json({
            data: [],
            fields: [],
            total_docs: 0,
            validQuery: false,
            queryMessage: queryMessage
        });
    }
    mongo_db.collection(req.params.coll).find(query_obj, { skip: skip, limit: docs_per_page }).sort(sort_obj).toArray()
        .then(function (result) {
        mongo_db.collection(req.params.coll).find({}, { skip: skip, limit: docs_per_page }).toArray()
            .then(function (simpleSearchFields) {
            var fields = [];
            if (simpleSearchFields) {
                for (var i = 0; i < simpleSearchFields.length; i++) {
                    var doc = simpleSearchFields[i];
                    for (var key in doc) {
                        if (key === '__v')
                            continue;
                        fields.push(key);
                    }
                }
            }
            fields = fields.filter(function (item, pos) {
                return fields.indexOf(item) === pos;
            });
            // get total docs count matching query using countDocuments
            mongo_db.collection(req.params.coll).countDocuments(query_obj)
                .then(function (doc_count) {
                var return_data = {
                    data: result || [],
                    fields: fields,
                    total_docs: doc_count || 0,
                    validQuery: validQuery,
                    queryMessage: queryMessage
                };
                res.status(200).json(return_data);
            })
                .catch(function (err3) {
                console.error(err3);
                res.status(500).json(err3);
            });
        })
            .catch(function (err2) {
            console.error(err2);
            res.status(500).json(err2);
        });
    })
        .catch(function (err) {
        console.error(err);
        res.status(500).json(err);
    });
});
// Single document get (for editing)
router.get('/api/:conn/:db/:coll/document/:id', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }
    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }
    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    common.get_id_type(mongo_db, req.params.coll, req.params.id, function (err, result) {
        if (err || !result.doc) {
            return res.status(404).json({ 'msg': 'Document not found' });
        }
        var images = [];
        lodash_1.default.forOwn(result.doc, function (value, key) {
            if (value && typeof value === 'string' && value.startsWith('data:image')) {
                images.push({ 'field': key, 'src': value });
            }
        });
        var videos = [];
        lodash_1.default.forOwn(result.doc, function (value, key) {
            if (value && typeof value === 'string' && value.startsWith('data:video')) {
                videos.push({ 'field': key, 'src': value, 'type': value.split(';')[0].replace('data:', '') });
            }
        });
        var audio = [];
        lodash_1.default.forOwn(result.doc, function (value, key) {
            if (value && typeof value === 'string' && value.startsWith('data:audio')) {
                audio.push({ 'field': key, 'src': value });
            }
        });
        res.status(200).json({
            doc: bsonify.stringify(result.doc, null, '    '),
            images_fields: images,
            video_fields: videos,
            audio_fields: audio
        });
    });
});
// Insert new document(s)
router.post('/api/:conn/:db/:coll/document/insert', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }
    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }
    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    var eJsonData;
    try {
        eJsonData = bsonify.parse(req.body.objectData);
    }
    catch (e) {
        console.error('Syntax error: ' + e);
        return res.status(400).json({ 'msg': 'Syntax error. Please check the syntax' });
    }
    if (lodash_1.default.isArray(eJsonData) === true) {
        mongo_db.collection(req.params.coll).insertMany(eJsonData)
            .then(function (docs) {
            var docId = docs && docs.insertedIds ? docs.insertedIds[0] : '';
            res.status(200).json({ 'msg': 'Documents successfully added', 'doc_id': docId });
        })
            .catch(function (err) {
            console.error('Error inserting documents', err);
            res.status(400).json({ 'msg': 'Error inserting documents' + ': ' + err });
        });
    }
    else {
        // Use insertOne or replaceOne depending on presence of _id for mock/legacy compatibility
        const col = mongo_db.collection(req.params.coll);
        const savePromise = eJsonData._id
            ? col.replaceOne({ _id: eJsonData._id }, eJsonData, { upsert: true })
            : col.insertOne(eJsonData);
        savePromise
            .then(function (docs) {
            var docId = docs && docs.insertedId ? docs.insertedId : (eJsonData._id || '');
            res.status(200).json({ 'msg': 'Document successfully added', 'doc_id': docId });
        })
            .catch(function (err) {
            console.error('Error inserting document', err);
            res.status(400).json({ 'msg': 'Error inserting document' + ': ' + err });
        });
    }
});
// Edit existing document
router.post('/api/:conn/:db/:coll/document/edit', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }
    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }
    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    var eJsonData;
    try {
        eJsonData = bsonify.parse(req.body.objectData);
    }
    catch (e) {
        console.error('Syntax error: ' + e);
        return res.status(400).json({ 'msg': 'Syntax error. Please check the syntax' });
    }
    if (!eJsonData._id) {
        return res.status(400).json({ 'msg': 'Error updating document: Missing _id field' });
    }
    mongo_db.collection(req.params.coll).replaceOne({ _id: eJsonData._id }, eJsonData, { upsert: true })
        .then(function (doc) {
        res.status(200).json({ 'msg': 'Document successfully updated' });
    })
        .catch(function (err) {
        console.error('Error updating document: ' + err);
        res.status(400).json({ 'msg': 'Error updating document' + ': ' + err });
    });
});
// Delete single document
router.post('/api/:conn/:db/:coll/document/delete', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }
    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }
    var doc_id = req.body.doc_id;
    if (!doc_id) {
        return res.status(400).json({ 'msg': 'Missing document ID' });
    }
    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    common.get_id_type(mongo_db, req.params.coll, doc_id, function (err, result) {
        if (result && result.doc) {
            mongo_db.collection(req.params.coll).deleteOne({ _id: result.doc_id_type })
                .then(function (docs) {
                if (docs.deletedCount === 0) {
                    res.status(400).json({ 'msg': 'Error deleting document: Cannot find document by Id' });
                }
                else {
                    res.status(200).json({ 'msg': 'Document successfully deleted' });
                }
            })
                .catch(function (err2) {
                console.error('Error deleting document: ' + err2);
                res.status(400).json({ 'msg': 'Error deleting document' + ': ' + err2.message });
            });
        }
        else {
            res.status(400).json({ 'msg': 'Cannot find document by Id' });
        }
    });
});
// Mass delete documents
router.post('/api/:conn/:db/:coll/document/mass_delete', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }
    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }
    var query_obj = {};
    var validQuery = true;
    if (req.body.query) {
        try {
            query_obj = bsonify.parse(req.body.query);
        }
        catch (e) {
            validQuery = false;
            query_obj = {};
        }
    }
    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);
    if (validQuery) {
        mongo_db.collection(req.params.coll).deleteMany(query_obj)
            .then(function (docs) {
            if (docs.deletedCount === 0) {
                res.status(400).json({ 'msg': 'Error deleting document(s): Invalid query specified' });
            }
            else {
                res.status(200).json({ 'msg': 'Document(s) successfully deleted' });
            }
        })
            .catch(function (err) {
            console.error('Error deleting document(s): ' + err);
            res.status(400).json({ 'msg': 'Error deleting document(s)' + ': ' + 'Invalid query specified' });
        });
    }
    else {
        res.status(400).json({ 'msg': 'Error deleting document(s)' + ': ' + 'Invalid query specified' });
    }
});
exports.default = router;
