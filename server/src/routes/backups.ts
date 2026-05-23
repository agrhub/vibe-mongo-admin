import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { BSON } from "mongodb";
const ejson = BSON.EJSON;

const router = Router();

// Storage setup for backup uploads
const backupPath = path.join(__dirname, '../../backups');
if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
}
const upload = multer({ dest: backupPath });

// Download a backup
router.get('/api/:conn/backup/:filename/download', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    var backupFile = req.params.filename;
    if (!backupFile || backupFile.indexOf('/') > -1 || backupFile.indexOf('\\') > -1 || backupFile.indexOf('..') > -1) {
        return res.status(400).json({ 'msg': 'Invalid backup filename' });
    }

    var fileFullPath = path.join(backupPath, backupFile);
    if (fs.existsSync(fileFullPath)) {
        res.download(fileFullPath, backupFile);
    } else {
        res.status(404).json({ 'msg': 'Backup file not found' });
    }
});

// Delete a backup
router.delete('/api/:conn/backup/:filename', function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    var backupFile = req.params.filename;
    if (!backupFile || backupFile.indexOf('/') > -1 || backupFile.indexOf('\\') > -1 || backupFile.indexOf('..') > -1) {
        return res.status(400).json({ 'msg': 'Invalid backup filename' });
    }

    var fileFullPath = path.join(backupPath, backupFile);
    if (fs.existsSync(fileFullPath)) {
        try {
            fs.unlinkSync(fileFullPath);
            res.status(200).json({ 'msg': 'Backup successfully deleted' });
        } catch (e) {
            console.error('Delete backup error:', e);
            res.status(500).json({ 'msg': 'Error deleting backup file' });
        }
    } else {
        res.status(404).json({ 'msg': 'Backup file not found' });
    }
});

// Upload a backup
router.post('/api/:conn/backup/upload', upload.single('backupFile'), async function (req: Request, res: Response) {
    var connection_list = req.app.locals.dbConnections;
    if (!connection_list || !connection_list[req.params.conn]) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    if (!req.file) {
        return res.status(400).json({ 'msg': 'No file uploaded' });
    }

    var originalName = req.file.originalname;
    if (!originalName || originalName.indexOf('/') > -1 || originalName.indexOf('\\') > -1 || originalName.indexOf('..') > -1) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 'msg': 'Invalid backup filename' });
    }

    if (!originalName.endsWith('.zip')) {
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ 'msg': 'Only .zip backup files are allowed' });
    }

    const isProd = process.env.NODE_ENV === 'production';
    var targetPath = path.join(backupPath, originalName + (isProd ? '?nolock=1' : ''));

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
    let success = false;
    let lastError = null;

    try {
        if (fs.existsSync(targetPath)) fs.unlinkSync(targetPath);
    } catch (err) { }

    for (let i = 0; i < 5; i++) {
        try {
            fs.renameSync(req.file.path, targetPath);
            success = true;
            break;
        } catch (e) {
            lastError = e;
            await delay(200);
        }
    }

    if (success) {
        return res.status(200).json({ 'msg': 'Backup successfully uploaded' });
    } else {
        try {
            fs.copyFileSync(req.file.path, targetPath);
            try { fs.unlinkSync(req.file.path); } catch (e) { }
            return res.status(200).json({ 'msg': 'Backup successfully uploaded' });
        } catch (copyError) {
            console.error('Upload backup error:', lastError || copyError);
            return res.status(500).json({ 'msg': 'Error saving uploaded file' });
        }
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

        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath);
        }

        const isProd = process.env.NODE_ENV === 'production';
        var zipFileName = db_name + '_backup_' + Date.now() + '.zip' + (isProd ? '?nolock=1' : '');
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

    var backupFilePath = path.join(backupPath, backupFile);
    if (!fs.existsSync(backupFilePath)) {
        // If not found in root backups directory, check under db_name directory
        var altPath = path.join(backupPath, db_name, backupFile);
        if (fs.existsSync(altPath)) {
            backupFilePath = altPath;
        } else {
            return res.status(400).json({ 'msg': 'Backup file/folder not found: ' + backupFile });
        }
    }

    try {
        var mongo_db = conn.client.db(db_name);
        var collectionsData: any = {}; // collName -> Array of docs

        var isZip = backupFilePath.includes('.zip');
        if (isZip) {
            var AdmZip = require('adm-zip');
            var zip = new AdmZip(backupFilePath);
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
            var files = fs.readdirSync(backupFilePath);
            files.forEach(function (file) {
                if (file.endsWith('.json') && file !== 'metadata.json') {
                    var collName = file.replace('.json', '');
                    var fileContent = fs.readFileSync(path.join(backupFilePath, file), 'utf8');
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
