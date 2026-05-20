import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import path from 'path';
import fs from 'fs';
import * as common from './common.js';
import { BSON } from "mongodb";
const ejson = BSON.EJSON;

const router = Router();

// ================= CONNECTION STATUS & DATABASES =================

// Database status & backup list
router.get('/api/:conn/stats', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    var conn_string = connection_list[req.params.conn].connString;
    var uri = common.parseMongoUri(conn_string);

    if (uri.database) {
        return res.status(200).json({ redirectDb: uri.database });
    }

    // Pass MongoClient for cross-db operations (status + stats)
    var mongo_client = connection_list[req.params.conn].client;
    var mongo_native = connection_list[req.params.conn].native;

    common.get_db_status(mongo_native, function (err: Error, db_status: any) {
        common.get_backups(function (err2: Error, backup_list: any) {
            common.get_db_stats(mongo_client, null, function (err3: Error, db_stats: any) {
                common.get_db_list(uri, mongo_client, function (err4: Error, db_list: any) {
                    var adminDb = mongo_client.db('admin').admin();
                    adminDb.listDatabases()
                        .then((result: any) => {
                            const sizeMap: Record<string, number> = {};
                            if (result && result.databases) {
                                result.databases.forEach((d: any) => {
                                    sizeMap[d.name] = d.sizeOnDisk || 0;
                                });
                            }

                            const enrichedList = (db_list || []).map((name: string) => {
                                let size = sizeMap[name] || 0;
                                if (size === 0 && db_stats && db_stats[name]) {
                                    Object.keys(db_stats[name]).forEach(collName => {
                                        if (db_stats[name][collName] && db_stats[name][collName].Storage) {
                                            size += db_stats[name][collName].Storage;
                                        }
                                    });
                                }
                                return {
                                    name: name,
                                    sizeOnDisk: size
                                };
                            });

                            res.status(200).json({
                                db_stats: db_stats,
                                db_status: db_status,
                                db_list: enrichedList,
                                backup_list: backup_list
                            });
                        })
                        .catch(() => {
                            const enrichedList = (db_list || []).map((name: string) => {
                                let size = 0;
                                if (db_stats && db_stats[name]) {
                                    Object.keys(db_stats[name]).forEach(collName => {
                                        if (db_stats[name][collName] && db_stats[name][collName].Storage) {
                                            size += db_stats[name][collName].Storage;
                                        }
                                    });
                                }
                                return {
                                    name: name,
                                    sizeOnDisk: size
                                };
                            });

                            res.status(200).json({
                                db_stats: db_stats,
                                db_status: db_status,
                                db_list: enrichedList,
                                backup_list: backup_list
                            });
                        });
                });
            });
        });
    });
});

// List of databases
router.get('/api/:conn/databases', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    var conn_string = connection_list[req.params.conn].connString;
    var uri = common.parseMongoUri(conn_string);
    var mongo_client = connection_list[req.params.conn].client;

    common.get_db_list(uri, mongo_client, function (err: Error, db_list: any) {
        if (err) {
            res.status(400).json({ 'msg': 'Error listing databases', 'err': err });
        } else {
            res.status(200).json({ db_list: db_list });
        }
    });
});

// Database level stats, collections and users
router.get('/api/:conn/:db/stats', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection name' });
    }

    if (req.params.db.indexOf(' ') > -1) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(req.params.db);

    common.get_db_stats(mongo_db, req.params.db, function (err: Error, db_stats: any) {
        common.get_backups(function (err2: Error, backup_list: any) {
            mongo_db.command({ usersInfo: 1 })
                .then(function (conn_users: any) {
                    mongo_db.listCollections().toArray()
                        .then(function (collection_list: any) {
                            res.status(200).json({
                                db_stats: db_stats ? db_stats[req.params.db] : {},
                                conn_users: conn_users,
                                coll_list: common.cleanCollections(collection_list),
                                backup_list: backup_list || []
                            });
                        })
                        .catch(function (err3: any) {
                            res.status(200).json({
                                db_stats: db_stats ? db_stats[req.params.db] : {},
                                conn_users: conn_users,
                                coll_list: [],
                                backup_list: backup_list || []
                            });
                        });
                })
                .catch(function (err2: any) {
                    // If usersInfo command is unauthorized (common on Atlas) or fails, swallow the error and pass null
                    mongo_db.listCollections().toArray()
                        .then(function (collection_list: any) {
                            res.status(200).json({
                                db_stats: db_stats ? db_stats[req.params.db] : {},
                                conn_users: null,
                                coll_list: common.cleanCollections(collection_list),
                                backup_list: backup_list || []
                            });
                        })
                        .catch(function (err3: any) {
                            res.status(200).json({
                                db_stats: db_stats ? db_stats[req.params.db] : {},
                                conn_users: null,
                                coll_list: [],
                                backup_list: backup_list || []
                            });
                        });
                });
        });
    });
});

// Create new database
router.post('/api/:conn/db/create', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    var db_name = req.body.db_name;
    if (!db_name || db_name.indexOf(' ') >= 0 || db_name.indexOf('.') >= 0) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(db_name);

    // Creating database by saving dummy collection doc
    mongo_db.collection('test').insertOne({})
        .then(function (docs: any) {
            res.status(200).json({ 'msg': 'Database successfully created' });
        })
        .catch(function (err: Error) {
            console.error('Error creating database: ' + err);
            res.status(400).json({ 'msg': 'Error creating database' + ': ' + err });
        });
});

// Delete database
router.post('/api/:conn/db/delete', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    var db_name = req.body.db_name;
    if (!db_name) {
        return res.status(400).json({ 'msg': 'Missing database name' });
    }

    var mongo_db = connection_list[req.params.conn].client.db(db_name);

    mongo_db.dropDatabase()
        .then(function (result: any) {
            res.status(200).json({ 'msg': 'Database successfully deleted', 'db_name': db_name });
        })
        .catch(function (err: Error) {
            console.error('Error deleting database: ' + err);
            res.status(400).json({ 'msg': 'Error deleting database' + ': ' + err });
        });
});

// Rename database (by copying all collections to a new database and dropping the old one)
router.post('/api/:conn/db/rename', async function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    var old_db_name = req.body.old_db_name;
    var new_db_name = req.body.new_db_name;

    if (!old_db_name || !new_db_name) {
        return res.status(400).json({ 'msg': 'Missing old or new database name' });
    }

    if (new_db_name.indexOf(' ') >= 0 || new_db_name.indexOf('.') >= 0) {
        return res.status(400).json({ 'msg': 'Invalid database name' });
    }

    try {
        var client = connection_list[req.params.conn].client;
        var old_db = client.db(old_db_name);
        var new_db = client.db(new_db_name);

        // Get list of collections in the old database
        var collections = await old_db.listCollections().toArray();

        if (collections.length === 0) {
            // If empty db, we can just drop it and create the new one
            await new_db.collection('test').insertOne({});
            await old_db.dropDatabase();
            return res.status(200).json({ 'msg': 'Database successfully renamed' });
        }

        for (var col of collections) {
            if (col.type === 'view') continue; // Skip views

            // Use $out aggregation to copy collection to the new database
            await old_db.collection(col.name).aggregate([
                { $out: { db: new_db_name, coll: col.name } }
            ]).toArray();
        }

        // Drop the old database
        await old_db.dropDatabase();

        res.status(200).json({ 'msg': 'Database successfully renamed' });
    } catch (err: any) {
        console.error('Error renaming database: ' + err);
        res.status(400).json({ 'msg': 'Error renaming database' + ': ' + err.message });
    }
});

// Backup a database
router.post('/api/:conn/:db/backup', async function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;

    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    var db_name = req.params.db;
    var conn = connection_list[req.params.conn];

    try {
        var mongo_db = conn.client.db(db_name);
        var collections = await mongo_db.listCollections().toArray();

        var keepObjectId = req.body.keepObjectId !== false;

        var AdmZip = require('adm-zip');
        var zip = new AdmZip();

        // Read all collections
        for (var col of collections) {
            if (col.type === 'view') continue; // Skip views

            var docs = await mongo_db.collection(col.name).find({}).toArray();

            if (!keepObjectId) {
                docs = docs.map(function (doc: any) {
                    if (doc._id) {
                        delete doc._id;
                    }
                    return doc;
                });
            }

            var serialized = ejson.stringify(docs, undefined, 2);
            zip.addFile(col.name + '.json', Buffer.from(serialized, 'utf8'));
        }

        // Add metadata
        var metadata = {
            database: db_name,
            backupDate: new Date().toISOString(),
            keepObjectId: keepObjectId,
            collections: collections.filter((c: any) => c.type !== 'view').map((c: any) => c.name)
        };
        zip.addFile('metadata.json', Buffer.from(JSON.stringify(metadata, null, 2), 'utf8'));

        var backupPath = path.join(__dirname, '../../../backups');
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath);
        }

        var zipFileName = db_name + '_backup_' + Date.now() + '.zip';
        var zipFilePath = path.join(backupPath, zipFileName);

        zip.writeZip(zipFilePath);

        res.status(200).json({ 'msg': 'Database successfully backed up' + ': ' + zipFileName });
    } catch (err: any) {
        console.error('Backup DB error: ', err);
        res.status(400).json({ 'msg': 'Unable to backup database' + ': ' + err.message });
    }
});

// Restore a database
router.post('/api/:conn/:db/restore', async function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;

    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    var db_name = req.params.db;
    var conn = connection_list[req.params.conn];

    var backupFile = req.body.backupFile;
    var restoreMode = req.body.restoreMode || 'replace'; // replace, upsert, insert

    if (!backupFile) {
        return res.status(400).json({ 'msg': 'Backup file parameter (backupFile) is required' });
    }

    var backupPath = path.join(__dirname, '../../../backups', backupFile);
    if (!fs.existsSync(backupPath)) {
        // If not found in root backups directory, check under db_name directory
        var altPath = path.join(__dirname, '../../../backups', db_name, backupFile);
        if (fs.existsSync(altPath)) {
            backupPath = altPath;
        } else {
            return res.status(400).json({ 'msg': 'Backup file/folder not found: ' + backupFile });
        }
    }

    try {
        var mongo_db = conn.client.db(db_name);
        var collectionsData: any = {}; // collName -> Array of docs

        var isZip = backupPath.endsWith('.zip');
        if (isZip) {
            var AdmZip = require('adm-zip');
            var zip = new AdmZip(backupPath);
            var zipEntries = zip.getEntries();

            zipEntries.forEach(function (entry: any) {
                if (entry.entryName.endsWith('.json') && entry.entryName !== 'metadata.json') {
                    var collName = entry.entryName.replace('.json', '');
                    var fileContent = entry.getData().toString('utf8');
                    try {
                        collectionsData[collName] = ejson.parse(fileContent);
                    } catch (e) {
                        console.error('Error parsing collection ' + collName + ' from zip: ', e);
                    }
                }
            });
        } else {
            // Backward compatibility for standard directory backups
            var files = fs.readdirSync(backupPath);
            files.forEach(function (file) {
                if (file.endsWith('.json') && file !== 'metadata.json') {
                    var collName = file.replace('.json', '');
                    var fileContent = fs.readFileSync(path.join(backupPath, file), 'utf8');
                    try {
                        collectionsData[collName] = ejson.parse(fileContent);
                    } catch (e) {
                        console.error('Error parsing collection ' + collName + ' from folder: ', e);
                    }
                }
            });
        }

        // Perform restore operations
        for (var collName in collectionsData) {
            var docs = collectionsData[collName];
            if (!Array.isArray(docs)) continue;

            var collection = mongo_db.collection(collName);

            if (restoreMode === 'replace') {
                // Drop collection if exists (or simply delete all documents)
                await collection.deleteMany({}).catch(() => { });
                if (docs.length > 0) {
                    await collection.insertMany(docs);
                }
            } else if (restoreMode === 'upsert') {
                // Upsert by _id (if _id is present), otherwise insert
                for (var doc of docs) {
                    if (doc._id) {
                        await collection.replaceOne({ _id: doc._id }, doc, { upsert: true });
                    } else {
                        await collection.insertOne(doc);
                    }
                }
            } else if (restoreMode === 'insert') {
                // Insert only, skipping existing ObjectIds
                if (docs.length > 0) {
                    await collection.insertMany(docs, { ordered: false }).catch(function (bulkErr: any) {
                        // Ignore duplicate key errors silently, throw other write errors
                        if (bulkErr.name !== 'MongoBulkWriteError' && bulkErr.code !== 11000) {
                            throw bulkErr;
                        }
                    });
                }
            }
        }

        res.status(200).json({ 'msg': 'Database successfully restored' });
    } catch (err: any) {
        console.error('Restore DB error: ', err);
        res.status(400).json({ 'msg': 'Unable to restore database' + ': ' + err.message });
    }
});

export default router;
