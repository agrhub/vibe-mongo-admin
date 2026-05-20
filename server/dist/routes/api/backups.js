"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const multer_1 = __importDefault(require("multer"));
const router = (0, express_1.Router)();
// Storage setup for backup uploads
const backupPath = path_1.default.join(__dirname, '../../../backups');
if (!fs_1.default.existsSync(backupPath)) {
    fs_1.default.mkdirSync(backupPath, { recursive: true });
}
const upload = (0, multer_1.default)({ dest: backupPath });
// Download a backup
router.get('/api/:conn/backup/:filename/download', function (req, res) {
    var connection_list = req.app.locals.dbConnections;
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
    var connection_list = req.app.locals.dbConnections;
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
    var connection_list = req.app.locals.dbConnections;
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
exports.default = router;
