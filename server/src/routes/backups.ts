import { mongoService } from '../services/MongoService';
import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { BSON } from "mongodb";
const ejson = BSON.EJSON;

const router = Router();

// Storage setup for backup uploads
const backupPath = path.join(__dirname, '../../data/backups');
if (!fs.existsSync(backupPath)) {
    fs.mkdirSync(backupPath, { recursive: true });
}
const upload = multer({ dest: backupPath });

// Download a backup
router.get('/api/:conn/backup/:filename/download', function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();
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
    const connection_list = mongoService.getConnections();
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
    const connection_list = mongoService.getConnections();
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

    var targetPath = path.join(backupPath, originalName);

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
    const connection_list = mongoService.getConnections();

    if (!connection_list || !connection_list[req.params.conn]) {
        return res.status(400).json({ 'msg': 'Invalid connection' });
    }

    var db_name = req.params.db;
    var conn = connection_list[req.params.conn];

    const os = require('os');
    const tmpDir = path.join(os.tmpdir(), 'vibemongo_tmp_' + Date.now());
    const localZipFilePath = path.join(os.tmpdir(), db_name + '_backup_' + Date.now() + '.zip');

    try {
        var mongo_db = conn.client.db(db_name);
        var collections = await mongo_db.listCollections().toArray();

        var keepObjectId = req.body.keepObjectId !== false;

        // Create temporary directory
        fs.mkdirSync(tmpDir, { recursive: true });

        // Stream each collection directly to its JSON file
        for (var col of collections) {
            if (col.type === 'view') continue; // Skip views

            const colFilePath = path.join(tmpDir, col.name + '.json');
            const writeStream = fs.createWriteStream(colFilePath, { encoding: 'utf8' });

            // Write opening bracket
            writeStream.write('[\n');

            const cursor = mongo_db.collection(col.name).find({});
            let isFirst = true;

            for await (const doc of cursor) {
                if (!keepObjectId) {
                    if (doc._id) {
                        delete (doc as any)._id;
                    }
                }

                const serialized = ejson.stringify(doc);
                let canWrite = true;
                if (isFirst) {
                    isFirst = false;
                    canWrite = writeStream.write('  ' + serialized);
                } else {
                    canWrite = writeStream.write(',\n  ' + serialized);
                }

                // Handle stream backpressure to prevent RAM allocation spikes
                if (!canWrite) {
                    await new Promise<void>((resolve) => writeStream.once('drain', resolve));
                }
            }

            // Write closing bracket
            writeStream.write('\n]');

            // Wait for write stream to finish
            await new Promise<void>((resolve, reject) => {
                writeStream.end((err: any) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        }

        // Add metadata
        var metadata = {
            database: db_name,
            backupDate: new Date().toISOString(),
            keepObjectId: keepObjectId,
            collections: collections.filter((c: any) => c.type !== 'view').map((c: any) => c.name)
        };
        fs.writeFileSync(path.join(tmpDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

        const archiver = require('archiver');
        const outputStream = fs.createWriteStream(localZipFilePath);
        const archive = archiver('zip', { zlib: { level: 9 } });

        const zipPromise = new Promise<void>((resolve, reject) => {
            outputStream.on('close', () => resolve());
            outputStream.on('error', (err: any) => reject(err));
            archive.on('error', (err: any) => reject(err));
        });

        // Pipe archive stream directly to disk (O(1) Memory!)
        archive.pipe(outputStream);

        // Append files
        archive.file(path.join(tmpDir, 'metadata.json'), { name: 'metadata.json' });
        for (var col of collections) {
            if (col.type === 'view') continue;
            archive.file(path.join(tmpDir, col.name + '.json'), { name: col.name + '.json' });
        }

        // Finalize/finalize the archive
        await archive.finalize();
        await zipPromise;

        // Copy finalized ZIP to mounted backupPath
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }
        const zipFileName = db_name + '_backup_' + Date.now() + '.zip';
        const finalZipFilePath = path.join(backupPath, zipFileName);
        fs.copyFileSync(localZipFilePath, finalZipFilePath);

        res.status(200).json({ 'msg': 'Database successfully backed up: ' + zipFileName });
    } catch (err: any) {
        console.error('Backup DB error: ', err);
        res.status(400).json({ 'msg': 'Unable to backup database: ' + err.message });
    } finally {
        // Clean up temporary files
        try {
            if (fs.existsSync(tmpDir)) {
                fs.rmSync(tmpDir, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('Error cleaning up backup temp files:', e);
        }
        try {
            if (fs.existsSync(localZipFilePath)) {
                fs.unlinkSync(localZipFilePath);
            }
        } catch (e) {
            console.error('Error cleaning up local zip file:', e);
        }
    }
});

// Restore a database
router.post('/api/:conn/:db/restore', async function (req: Request, res: Response) {
    const connection_list = mongoService.getConnections();

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

    const os = require('os');
    const tmpRestoreDir = path.join(os.tmpdir(), 'vibemongo_restore_tmp_' + Date.now());
    const readline = require('readline');

    try {
        var mongo_db = conn.client.db(db_name);

        var isZip = backupFilePath.includes('.zip');
        if (isZip) {
            const unzipper = require('unzipper');
            // Extract via standard stream piping to avoid holding decompressed content in RAM (O(1) Memory!)
            await fs.createReadStream(backupFilePath)
                .pipe(unzipper.Extract({ path: tmpRestoreDir }))
                .promise();
        }

        const targetDir = isZip ? tmpRestoreDir : backupFilePath;
        const files = fs.readdirSync(targetDir);

        // Helper to process a single collection file line-by-line to avoid loading massive arrays into RAM
        async function restoreCollectionFile(collName: string, filePath: string) {
            const collection = mongo_db.collection(collName);

            if (restoreMode === 'replace') {
                await collection.deleteMany({}).catch(() => { });
            }

            const fileStream = fs.createReadStream(filePath);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            let batch: any[] = [];
            const BATCH_SIZE = 500;

            for await (const line of rl) {
                let trimmed = line.trim();
                // Skip brackets and empty lines
                if (trimmed === '[' || trimmed === ']' || trimmed === '') continue;
                
                // Strip leading comma if present
                if (trimmed.startsWith(',')) {
                    trimmed = trimmed.substring(1).trim();
                }
                
                // Strip trailing comma if present
                if (trimmed.endsWith(',')) {
                    trimmed = trimmed.substring(0, trimmed.length - 1).trim();
                }
                
                if (trimmed === '[' || trimmed === ']' || trimmed === '') continue;

                try {
                    const doc = ejson.parse(trimmed);
                    batch.push(doc);

                    if (batch.length >= BATCH_SIZE) {
                        if (restoreMode === 'replace' || restoreMode === 'insert') {
                            await collection.insertMany(batch, { ordered: false }).catch((bulkErr: any) => {
                                if (bulkErr.name !== 'MongoBulkWriteError' && bulkErr.code !== 11000) {
                                    throw bulkErr;
                                }
                            });
                        } else if (restoreMode === 'upsert') {
                            for (const d of batch) {
                                if (d._id) {
                                    await collection.replaceOne({ _id: d._id }, d, { upsert: true });
                                } else {
                                    await collection.insertOne(d);
                                }
                            }
                        }
                        batch = [];
                    }
                } catch (e: any) {
                    console.error(`Error parsing line in collection ${collName}:`, e.message);
                }
            }

            // Insert remaining documents
            if (batch.length > 0) {
                if (restoreMode === 'replace' || restoreMode === 'insert') {
                    await collection.insertMany(batch, { ordered: false }).catch((bulkErr: any) => {
                        if (bulkErr.name !== 'MongoBulkWriteError' && bulkErr.code !== 11000) {
                            throw bulkErr;
                        }
                    });
                } else if (restoreMode === 'upsert') {
                    for (const d of batch) {
                        if (d._id) {
                            await collection.replaceOne({ _id: d._id }, d, { upsert: true });
                        } else {
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
                const filePath = path.join(targetDir, file);
                await restoreCollectionFile(collName, filePath);
            }
        }

        res.status(200).json({ 'msg': 'Database successfully restored' });
    } catch (err: any) {
        console.error('Restore DB error: ', err);
        res.status(400).json({ 'msg': 'Unable to restore database' + ': ' + err.message });
    } finally {
        // Clean up temporary files
        try {
            if (fs.existsSync(tmpRestoreDir)) {
                fs.rmSync(tmpRestoreDir, { recursive: true, force: true });
            }
        } catch (e) {
            console.error('Error cleaning up restore temp folder:', e);
        }
    }
});

export default router;
