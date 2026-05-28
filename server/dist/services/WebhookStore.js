"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookStore = exports.WebhookStore = void 0;
const sqlite3_1 = __importDefault(require("sqlite3"));
const sqlite_1 = require("sqlite");
const path_1 = __importDefault(require("path"));
const isProd = process.env.NODE_ENV === 'production';
const DB_PATH = path_1.default.join(__dirname, '../../data', isProd ? 'connections.db?nolock=1' : 'connections.db');
class WebhookStore {
    dbPromise = null;
    async getDb() {
        if (!this.dbPromise) {
            const dbFilename = 'file:' + DB_PATH;
            this.dbPromise = (0, sqlite_1.open)({
                filename: dbFilename,
                driver: sqlite3_1.default.Database,
                mode: sqlite3_1.default.OPEN_READWRITE | sqlite3_1.default.OPEN_CREATE | sqlite3_1.default.OPEN_URI
            }).then(async (db) => {
                // Initialize schema
                await db.exec(`
          CREATE TABLE IF NOT EXISTS webhooks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            connName TEXT UNIQUE NOT NULL,
            url TEXT NOT NULL,
            slowQueries INTEGER DEFAULT 1,
            systemSpikes INTEGER DEFAULT 1,
            connectionFailures INTEGER DEFAULT 1,
            createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);
                // Safely add column if not exists
                try {
                    await db.exec('ALTER TABLE webhooks ADD COLUMN email TEXT DEFAULT ""');
                }
                catch (e) { }
                try {
                    await db.exec('ALTER TABLE webhooks ADD COLUMN smtpHost TEXT DEFAULT ""');
                }
                catch (e) { }
                try {
                    await db.exec('ALTER TABLE webhooks ADD COLUMN smtpPort INTEGER DEFAULT 587');
                }
                catch (e) { }
                try {
                    await db.exec('ALTER TABLE webhooks ADD COLUMN smtpSecure INTEGER DEFAULT 0');
                }
                catch (e) { }
                try {
                    await db.exec('ALTER TABLE webhooks ADD COLUMN smtpUser TEXT DEFAULT ""');
                }
                catch (e) { }
                try {
                    await db.exec('ALTER TABLE webhooks ADD COLUMN smtpPass TEXT DEFAULT ""');
                }
                catch (e) { }
                try {
                    await db.exec('ALTER TABLE webhooks ADD COLUMN smtpSender TEXT DEFAULT ""');
                }
                catch (e) { }
                try {
                    await db.exec('ALTER TABLE webhooks ADD COLUMN enableGrouping INTEGER DEFAULT 1');
                }
                catch (e) { }
                try {
                    await db.exec('ALTER TABLE webhooks ADD COLUMN groupWindow INTEGER DEFAULT 5');
                }
                catch (e) { }
                return db;
            });
        }
        return this.dbPromise;
    }
    async getWebhook(connName) {
        const db = await this.getDb();
        const row = await db.get('SELECT * FROM webhooks WHERE connName = ?', connName);
        if (!row)
            return null;
        return row;
    }
    async saveWebhook(connName, url, slowQueries, systemSpikes, connectionFailures, email = '', smtpHost = '', smtpPort = 587, smtpSecure = 0, smtpUser = '', smtpPass = '', smtpSender = '', enableGrouping = 1, groupWindow = 5) {
        const db = await this.getDb();
        const existing = await db.get('SELECT id FROM webhooks WHERE connName = ?', connName);
        if (existing) {
            await db.run(`UPDATE webhooks SET 
          url = ?, 
          slowQueries = ?, 
          systemSpikes = ?, 
          connectionFailures = ?, 
          email = ?, 
          smtpHost = ?, 
          smtpPort = ?, 
          smtpSecure = ?, 
          smtpUser = ?, 
          smtpPass = ?, 
          smtpSender = ?,
          enableGrouping = ?,
          groupWindow = ?
        WHERE connName = ?`, url, slowQueries, systemSpikes, connectionFailures, email, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpSender, enableGrouping, groupWindow, connName);
            return {
                id: existing.id,
                connName,
                url,
                slowQueries,
                systemSpikes,
                connectionFailures,
                email,
                smtpHost,
                smtpPort,
                smtpSecure,
                smtpUser,
                smtpPass,
                smtpSender,
                enableGrouping,
                groupWindow
            };
        }
        else {
            const result = await db.run(`INSERT INTO webhooks (
          connName, 
          url, 
          slowQueries, 
          systemSpikes, 
          connectionFailures, 
          email, 
          smtpHost, 
          smtpPort, 
          smtpSecure, 
          smtpUser, 
          smtpPass, 
          smtpSender,
          enableGrouping,
          groupWindow
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, connName, url, slowQueries, systemSpikes, connectionFailures, email, smtpHost, smtpPort, smtpSecure, smtpUser, smtpPass, smtpSender, enableGrouping, groupWindow);
            return {
                id: result.lastID,
                connName,
                url,
                slowQueries,
                systemSpikes,
                connectionFailures,
                email,
                smtpHost,
                smtpPort,
                smtpSecure,
                smtpUser,
                smtpPass,
                smtpSender,
                enableGrouping,
                groupWindow
            };
        }
    }
    async deleteWebhook(connName) {
        const db = await this.getDb();
        const result = await db.run('DELETE FROM webhooks WHERE connName = ?', connName);
        return (result.changes ?? 0) > 0;
    }
}
exports.WebhookStore = WebhookStore;
exports.webhookStore = new WebhookStore();
