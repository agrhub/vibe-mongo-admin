import { Router, Request as ExpressRequest, Response } from 'express';
type Request = ExpressRequest<any>;
import path from 'path';
import fs from 'fs';
import multer from 'multer';

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

export default router;
