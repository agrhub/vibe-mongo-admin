import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import _ from "lodash";
import * as common from "./common.js";
import * as bsonify from "./bsonify.js";
import { BSON } from "mongodb";
const ejson = BSON.EJSON;

const router = Router();

// ================= DOCUMENTS CRUD =================

// Paginated documents search
router.post('/api/:conn/:db/:coll/documents', function (req: Request, res: Response) {
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

    var query_obj: any = {};
    var validQuery = true;
    var queryMessage = '';

    if (req.body.query) {
        try {
            query_obj = bsonify.parse(req.body.query);
        } catch (e: any) {
            validQuery = false;
            queryMessage = e.toString();
            query_obj = {};
        }
    }

    if (req.body.columnFilters && typeof req.body.columnFilters === 'object') {
        const filterConditions: any[] = [];
        Object.entries(req.body.columnFilters).forEach(([key, val]) => {
            if (val && typeof val === 'string' && val.trim()) {
                // If filtering by _id, match exactly if it looks like ObjectId, otherwise match as string regex
                if (key === '_id') {
                    if (BSON.ObjectId.isValid(val.trim())) {
                        filterConditions.push({ _id: new BSON.ObjectId(val.trim()) });
                    } else {
                        filterConditions.push({ _id: { $regex: val.trim(), $options: 'i' } });
                    }
                } else {
                    filterConditions.push({ [key]: { $regex: val.trim(), $options: 'i' } });
                }
            }
        });
        if (filterConditions.length > 0) {
            if (Object.keys(query_obj).length > 0) {
                query_obj = { $and: [query_obj, ...filterConditions] };
            } else {
                query_obj = filterConditions.length === 1 ? filterConditions[0] : { $and: filterConditions };
            }
        }
    }

    var sort_obj: any = {};
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
        .then(function (result: any) {
            mongo_db.collection(req.params.coll).find({}, { skip: skip, limit: docs_per_page }).toArray()
                .then(function (simpleSearchFields: any) {
                    var fields: any[] = [];
                    if (simpleSearchFields) {
                        for (var i = 0; i < simpleSearchFields.length; i++) {
                            var doc = simpleSearchFields[i];
                            for (var key in doc) {
                                if (key === '__v') continue;
                                fields.push(key);
                            }
                        }
                    }

                    fields = fields.filter(function (item, pos) {
                        return fields.indexOf(item) === pos;
                    });

                    // get total docs count matching query using countDocuments
                    mongo_db.collection(req.params.coll).countDocuments(query_obj)
                        .then(function (doc_count: any) {
                            var return_data = {
                                data: result || [],
                                fields: fields,
                                total_docs: doc_count || 0,
                                validQuery: validQuery,
                                queryMessage: queryMessage
                            };
                            res.status(200).json(return_data);
                        })
                        .catch(function (err3: any) {
                            console.error(err3);
                            res.status(500).json(err3);
                        });
                })
                .catch(function (err2: any) {
                    console.error(err2);
                    res.status(500).json(err2);
                });
        })
        .catch(function (err: any) {
            console.error(err);
            res.status(500).json(err);
        });
});

// Single document get (for editing)
router.get('/api/:conn/:db/:coll/document/:id', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    common.get_id_type(mongo_db, req.params.coll, req.params.id, function (err: any, result: any) {
        if (err || !result.doc) {
            return res.status(404).json({ 'msg': 'Document not found' });
        }

        var images: any[] = [];
        _.forOwn(result.doc, function (value: any, key: any) {
            if (value && typeof value === 'string' && value.startsWith('data:image')) {
                images.push({ 'field': key, 'src': value });
            }
        });

        var videos: any[] = [];
        _.forOwn(result.doc, function (value: any, key: any) {
            if (value && typeof value === 'string' && value.startsWith('data:video')) {
                videos.push({ 'field': key, 'src': value, 'type': value.split(';')[0].replace('data:', '') });
            }
        });

        var audio: any[] = [];
        _.forOwn(result.doc, function (value: any, key: any) {
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
router.post('/api/:conn/:db/:coll/document/insert', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    var eJsonData: any;
    try {
        eJsonData = bsonify.parse(req.body.objectData);
    } catch (e) {
        console.error('Syntax error: ' + e);
        return res.status(400).json({ 'msg': 'Syntax error. Please check the syntax' });
    }

    if (_.isArray(eJsonData) === true) {
        mongo_db.collection(req.params.coll).insertMany(eJsonData)
            .then(function (docs: any) {
                var docId = docs && docs.insertedIds ? docs.insertedIds[0] : '';
                res.status(200).json({ 'msg': 'Documents successfully added', 'doc_id': docId });
            })
            .catch(function (err: any) {
                console.error('Error inserting documents', err);
                res.status(400).json({ 'msg': 'Error inserting documents' + ': ' + err });
            });
    } else {
        // Use insertOne or replaceOne depending on presence of _id for mock/legacy compatibility
        const col = mongo_db.collection(req.params.coll);
        const savePromise = eJsonData._id
            ? col.replaceOne({ _id: eJsonData._id }, eJsonData, { upsert: true })
            : col.insertOne(eJsonData);

        savePromise
            .then(function (docs: any) {
                var docId = docs && docs.insertedId ? docs.insertedId : (eJsonData._id || '');
                res.status(200).json({ 'msg': 'Document successfully added', 'doc_id': docId });
            })
            .catch(function (err: any) {
                console.error('Error inserting document', err);
                res.status(400).json({ 'msg': 'Error inserting document' + ': ' + err });
            });
    }
});

// Edit existing document
router.post('/api/:conn/:db/:coll/document/edit', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    var eJsonData: any;
    try {
        eJsonData = bsonify.parse(req.body.objectData);
    } catch (e) {
        console.error('Syntax error: ' + e);
        return res.status(400).json({ 'msg': 'Syntax error. Please check the syntax' });
    }

    if (!eJsonData._id) {
        return res.status(400).json({ 'msg': 'Error updating document: Missing _id field' });
    }

    mongo_db.collection(req.params.coll).replaceOne({ _id: eJsonData._id }, eJsonData, { upsert: true })
        .then(function (doc: any) {
            res.status(200).json({ 'msg': 'Document successfully updated' });
        })
        .catch(function (err: any) {
            console.error('Error updating document: ' + err);
            res.status(400).json({ 'msg': 'Error updating document' + ': ' + err });
        });
});

// Delete single document
router.post('/api/:conn/:db/:coll/document/delete', function (req: Request, res: Response) {
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

    common.get_id_type(mongo_db, req.params.coll, doc_id, function (err: Error, result: any) {
        if (result && result.doc) {
            mongo_db.collection(req.params.coll).deleteOne({ _id: result.doc_id_type })
                .then(function (docs: any) {
                    if (docs.deletedCount === 0) {
                        res.status(400).json({ 'msg': 'Error deleting document: Cannot find document by Id' });
                    } else {
                        res.status(200).json({ 'msg': 'Document successfully deleted' });
                    }
                })
                .catch(function (err2: Error) {
                    console.error('Error deleting document: ' + err2);
                    res.status(400).json({ 'msg': 'Error deleting document' + ': ' + err2.message });
                });
        } else {
            res.status(400).json({ 'msg': 'Cannot find document by Id' });
        }
    });
});

// Mass delete documents
router.post('/api/:conn/:db/:coll/document/mass_delete', function (req: Request, res: Response) {
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
        } catch (e) {
            validQuery = false;
            query_obj = {};
        }
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    if (validQuery) {
        mongo_db.collection(req.params.coll).deleteMany(query_obj)
            .then(function (docs: any) {
                if (docs.deletedCount === 0) {
                    res.status(400).json({ 'msg': 'Error deleting document(s): Invalid query specified' });
                } else {
                    res.status(200).json({ 'msg': 'Document(s) successfully deleted' });
                }
            })
            .catch(function (err: any) {
                console.error('Error deleting document(s): ' + err);
                res.status(400).json({ 'msg': 'Error deleting document(s)' + ': ' + 'Invalid query specified' });
            });
    } else {
        res.status(400).json({ 'msg': 'Error deleting document(s)' + ': ' + 'Invalid query specified' });
    }
});

export default router;
