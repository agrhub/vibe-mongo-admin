"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const MongoService_1 = require("../services/MongoService");
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const mongodb_1 = require("mongodb");
const ejson = mongodb_1.BSON.EJSON;
const router = (0, express_1.Router)();
// Storage setup for backup uploads
const backupPath = path_1.default.join(__dirname, '../../data/backups');
if (!fs_1.default.existsSync(backupPath)) {
    fs_1.default.mkdirSync(backupPath, { recursive: true });
}
const upload = (0, multer_1.default)({ dest: backupPath });
// Download a backup
router.get('/api/:conn/backup/:filename/download', function (req, res) {
    const connection_list = MongoService_1.mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }
    var backupFile = req.params.filename;
    if (!backupFile || backupFile.indexOf('/') > -1 || backupFile.indexOf('\\') > -1 || backupFile.indexOf('..') > -1) {
        return res.status(400).json({ 'msg': 'Invalid backup filename' });
    }
    var fileFullPath = path_1.default.join(backupPath, backupFile);
    if (fs_1.default.existsSync(fileFullPath)) {
        res.download(fileFullPath, backupFile);
    }
    else {
        res.status(404).json({ 'msg': 'Backup file not found' });
    }
});
// Delete a backup
router.delete('/api/:conn/backup/:filename', function (req, res) {
    const connection_list = MongoService_1.mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }
    var backupFile = req.params.filename;
    if (!backupFile || backupFile.indexOf('/') > -1 || backupFile.indexOf('\\') > -1 || backupFile.indexOf('..') > -1) {
        return res.status(400).json({ 'msg': 'Invalid backup filename' });
    }
    var fileFullPath = path_1.default.join(backupPath, backupFile);
    if (fs_1.default.existsSync(fileFullPath)) {
        try {
            fs_1.default.unlinkSync(fileFullPath);
            res.status(200).json({ 'msg': 'Backup successfully deleted' });
        }
        catch (e) {
            console.error('Delete backup error:', e);
            res.status(500).json({ 'msg': 'Error deleting backup file' });
        }
    }
    else {
        res.status(404).json({ 'msg': 'Backup file not found' });
    }
});
// Upload a backup
router.post('/api/:conn/backup/upload', upload.single('backupFile'), async function (req, res) {
    const connection_list = MongoService_1.mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        if (req.file)
            fs_1.default.unlinkSync(req.file.path);
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }
    if (!req.file) {
        return res.status(400).json({ 'msg': 'No file uploaded' });
    }
    var originalName = req.file.originalname;
    if (!originalName || originalName.indexOf('/') > -1 || originalName.indexOf('\\') > -1 || originalName.indexOf('..') > -1) {
        fs_1.default.unlinkSync(req.file.path);
        return res.status(400).json({ 'msg': 'Invalid backup filename' });
    }
    if (!originalName.endsWith('.zip')) {
        fs_1.default.unlinkSync(req.file.path);
        return res.status(400).json({ 'msg': 'Only .zip backup files are allowed' });
    }
    var targetPath = path_1.default.join(backupPath, originalName);
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    let success = false;
    let lastError = null;
    try {
        if (fs_1.default.existsSync(targetPath))
            fs_1.default.unlinkSync(targetPath);
    }
    catch (err) { }
    for (let i = 0; i < 5; i++) {
        try {
            fs_1.default.renameSync(req.file.path, targetPath);
            success = true;
            break;
        }
        catch (e) {
            lastError = e;
            await delay(200);
        }
    }
    if (success) {
        return res.status(200).json({ 'msg': 'Backup successfully uploaded' });
    }
    else {
        try {
            fs_1.default.copyFileSync(req.file.path, targetPath);
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch (e) { }
            return res.status(200).json({ 'msg': 'Backup successfully uploaded' });
        }
        catch (copyError) {
            console.error('Upload backup error:', lastError || copyError);
            return res.status(500).json({ 'msg': 'Error saving uploaded file' });
        }
    }
});
// Backup a database
router.post('/api/:conn/:db/backup', async function (req, res) {
    const connection_list = MongoService_1.mongoService.getConnections();
    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }
    var db_name = req.params.db;
    var conn = connection_list[req.params.conn];
    const os = require('os');
    const tmpDir = path_1.default.join(os.tmpdir(), 'vibemongo_tmp_' + Date.now());
    const localZipFilePath = path_1.default.join(os.tmpdir(), db_name + '_backup_' + Date.now() + '.zip');
    try {
        var mongo_db = conn.client.db(db_name);
        var collections = await mongo_db.listCollections().toArray();
        var keepObjectId = req.body.keepObjectId !== false;
        // Create temporary directory
        fs_1.default.mkdirSync(tmpDir, { recursive: true });
        // Stream each collection directly to its JSON file
        for (var col of collections) {
            if (col.type === 'view')
                continue; // Skip views
            const colFilePath = path_1.default.join(tmpDir, col.name + '.json');
            const writeStream = fs_1.default.createWriteStream(colFilePath, { encoding: 'utf8' });
            // Write opening bracket
            writeStream.write('[\n');
            const cursor = mongo_db.collection(col.name).find({});
            let isFirst = true;
            for await (const doc of cursor) {
                if (!keepObjectId) {
                    if (doc._id) {
                        delete doc._id;
                    }
                }
                const serialized = ejson.stringify(doc);
                let canWrite = true;
                if (isFirst) {
                    isFirst = false;
                    canWrite = writeStream.write('  ' + serialized);
                }
                else {
                    canWrite = writeStream.write(',\n  ' + serialized);
                }
                // Handle stream backpressure to prevent RAM allocation spikes
                if (!canWrite) {
                    await new Promise((resolve) => writeStream.once('drain', resolve));
                }
            }
            // Write closing bracket
            writeStream.write('\n]');
            // Wait for write stream to finish
            await new Promise((resolve, reject) => {
                writeStream.end((err) => {
                    if (err)
                        reject(err);
                    else
                        resolve();
                });
            });
        }
        // Add metadata
        var metadata = {
            database: db_name,
            backupDate: new Date().toISOString(),
            keepObjectId: keepObjectId,
            collections: collections.filter((c) => c.type !== 'view').map((c) => c.name)
        };
        fs_1.default.writeFileSync(path_1.default.join(tmpDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');
        const archiver = require('archiver');
        const outputStream = fs_1.default.createWriteStream(localZipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });
        const zipPromise = new Promise((resolve, reject) => {
            outputStream.on('close', () => resolve());
            outputStream.on('error', (err) => reject(err));
            archive.on('error', (err) => reject(err));
        });
        // Pipe archive stream directly to disk (O(1) Memory!)
        archive.pipe(outputStream);
        // Append files
        archive.file(path_1.default.join(tmpDir, 'metadata.json'), { name: 'metadata.json' });
        for (var col of collections) {
            if (col.type === 'view')
                continue;
            archive.file(path_1.default.join(tmpDir, col.name + '.json'), { name: col.name + '.json' });
        }
        // Finalize/finalize the archive
        await archive.finalize();
        await zipPromise;
        // Copy finalized ZIP to mounted backupPath
        if (!fs_1.default.existsSync(backupPath)) {
            fs_1.default.mkdirSync(backupPath, { recursive: true });
        }
        const zipFileName = db_name + '_backup_' + Date.now() + '.zip';
        const finalZipFilePath = path_1.default.join(backupPath, zipFileName);
        fs_1.default.copyFileSync(localZipFilePath, finalZipFilePath);
        res.status(200).json({ 'msg': 'Database successfully backed up: ' + zipFileName });
    }
    catch (err) {
        console.error('Backup DB error: ', err);
        res.status(400).json({ 'msg': 'Unable to backup database: ' + err.message });
    }
    finally {
        // Clean up temporary files
        try {
            if (fs_1.default.existsSync(tmpDir)) {
                fs_1.default.rmSync(tmpDir, { recursive: true, force: true });
            }
        }
        catch (e) {
            console.error('Error cleaning up backup temp files:', e);
        }
        try {
            if (fs_1.default.existsSync(localZipFilePath)) {
                fs_1.default.unlinkSync(localZipFilePath);
            }
        }
        catch (e) {
            console.error('Error cleaning up local zip file:', e);
        }
    }
});
// Restore a database
router.post('/api/:conn/:db/restore', async function (req, res) {
    const connection_list = MongoService_1.mongoService.getConnections();
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
    var backupFilePath = path_1.default.join(backupPath, backupFile);
    if (!fs_1.default.existsSync(backupFilePath)) {
        // If not found in root backups directory, check under db_name directory
        var altPath = path_1.default.join(backupPath, db_name, backupFile);
        if (fs_1.default.existsSync(altPath)) {
            backupFilePath = altPath;
        }
        else {
            return res.status(400).json({ 'msg': 'Backup file/folder not found: ' + backupFile });
        }
    }
    const os = require('os');
    const tmpRestoreDir = path_1.default.join(os.tmpdir(), 'vibemongo_restore_tmp_' + Date.now());
    const readline = require('readline');
    try {
        var mongo_db = conn.client.db(db_name);
        var isZip = backupFilePath.includes('.zip');
        if (isZip) {
            const unzipper = require('unzipper');
            // Extract via standard stream piping to avoid holding decompressed content in RAM (O(1) Memory!)
            await fs_1.default.createReadStream(backupFilePath)
                .pipe(unzipper.Extract({ path: tmpRestoreDir }))
                .promise();
        }
        const targetDir = isZip ? tmpRestoreDir : backupFilePath;
        const files = fs_1.default.readdirSync(targetDir);
        // Helper to process a single collection file line-by-line to avoid loading massive arrays into RAM
        async function restoreCollectionFile(collName, filePath) {
            const collection = mongo_db.collection(collName);
            if (restoreMode === 'replace') {
                await collection.deleteMany({}).catch(() => { });
            }
            const fileStream = fs_1.default.createReadStream(filePath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });
            let batch = [];
            const BATCH_SIZE = 500;
            for await (const line of rl) {
                let trimmed = line.trim();
                // Skip brackets and empty lines
                if (trimmed === '[' || trimmed === ']' || trimmed === '')
                    continue;
                // Strip leading comma if present
                if (trimmed.startsWith(',')) {
                    trimmed = trimmed.substring(1).trim();
                }
                // Strip trailing comma if present
                if (trimmed.endsWith(',')) {
                    trimmed = trimmed.substring(0, trimmed.length - 1).trim();
                }
                if (trimmed === '[' || trimmed === ']' || trimmed === '')
                    continue;
                try {
                    const doc = ejson.parse(trimmed);
                    batch.push(doc);
                    if (batch.length >= BATCH_SIZE) {
                        if (restoreMode === 'replace' || restoreMode === 'insert') {
                            await collection.insertMany(batch, { ordered: false }).catch((bulkErr) => {
                                if (bulkErr.name !== 'MongoBulkWriteError' && bulkErr.code !== 11000) {
                                    throw bulkErr;
                                }
                            });
                        }
                        else if (restoreMode === 'upsert') {
                            for (const d of batch) {
                                if (d._id) {
                                    await collection.replaceOne({ _id: d._id }, d, { upsert: true });
                                }
                                else {
                                    await collection.insertOne(d);
                                }
                            }
                        }
                        batch = [];
                    }
                }
                catch (e) {
                    console.error(`Error parsing line in collection ${collName}:`, e.message);
                }
            }
            // Insert remaining documents
            if (batch.length > 0) {
                if (restoreMode === 'replace' || restoreMode === 'insert') {
                    await collection.insertMany(batch, { ordered: false }).catch((bulkErr) => {
                        if (bulkErr.name !== 'MongoBulkWriteError' && bulkErr.code !== 11000) {
                            throw bulkErr;
                        }
                    });
                }
                else if (restoreMode === 'upsert') {
                    for (const d of batch) {
                        if (d._id) {
                            await collection.replaceOne({ _id: d._id }, d, { upsert: true });
                        }
                        else {
                            await collection.insertOne(d);
                        }
                    }
                }
            }
        }
        // Process all collection files sequentially
        for (const file of files) {
            if (file.endsWith('.json') && file !== 'metadata.json') {
                const collName = file.replace('.json', '');
                const filePath = path_1.default.join(targetDir, file);
                await restoreCollectionFile(collName, filePath);
            }
        }
        res.status(200).json({ 'msg': 'Database successfully restored' });
    }
    catch (err) {
        console.error('Restore DB error: ', err);
        res.status(400).json({ 'msg': 'Unable to restore database' + ': ' + err.message });
    }
    finally {
        // Clean up temporary files
        try {
            if (fs_1.default.existsSync(tmpRestoreDir)) {
                fs_1.default.rmSync(tmpRestoreDir, { recursive: true, force: true });
            }
        }
        catch (e) {
            console.error('Error cleaning up restore temp folder:', e);
        }
    }
});
exports.default = router;
